import { generateObject, generateText } from "ai";
import type { z } from "zod";

import {
  buildBulletsPrompt,
  buildCoverLetterPrompt,
  buildInterviewPrompt,
  buildJdParsePrompt,
  buildMatchPrompt,
  buildResumeParsePrompt,
  JD_SYSTEM,
  MATCH_SYSTEM,
  RESUME_SYSTEM,
  TAILORED_BULLETS_SYSTEM,
  COVER_LETTER_SYSTEM,
  INTERVIEW_SYSTEM,
} from "@/lib/ai/prompts";
import {
  getModel,
  getModelId,
  getObjectMode,
  getSeed,
  getTemperature,
  MissingApiKeyError,
} from "@/lib/ai/provider";
import {
  coverLetterSchema,
  interviewPackSchema,
  jdSchema,
  matchSchema,
  resumeSchema,
  tailoredBulletsSchema,
} from "@/lib/ai/schemas";
import { finalizeMatchReport } from "@/lib/scoring";
import type {
  CoverLetter,
  GenerationResult,
  InterviewPack,
  JdProfile,
  MatchReport,
  ResumeProfile,
  TailoredBullets,
} from "@/lib/types";

/**
 * 业务编排层（pipeline）。
 *
 * API Routes 只负责 HTTP 解析与错误映射，真正的流程都在这里，
 * 这样 /api/analyze 一条龙与 /api/parse/*、/api/match、/api/generate 单步调用共用同一套实现，
 * 不会出现两套逻辑漂移。
 *
 * 稳定性由三层共同保证：
 * 1) 采样参数：低温（默认 0.2）+ 固定 seed（默认 42），见 provider.ts；
 * 2) Prompt：先列证据、再给分数，并带评分校准分档，见 prompts.ts；
 * 3) 本地确定性层：总分与维度纪律在 scoring.ts 里算，不交给模型心算。
 */

/** 单次模型调用失败时抛出的统一错误 */
export class ModelCallError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ModelCallError";
    this.cause = cause;
  }
}

/**
 * 把上游报错翻译成"用户能照做"的提示。
 * 结构化输出是这个项目最容易踩兼容性坑的地方，所以这里单独识别。
 */
function diagnose(detail: string): string {
  if (/tool_choice/i.test(detail)) {
    return "当前模型不接受 tool_choice（思考/推理模型常见）。默认的 MODEL_OBJECT_MODE=auto 会自动改走 JSON 通道；如果你手工把它设成了 tool，请改回 auto 或设为 text。";
  }
  if (/response_format|json_object|json mode/i.test(detail)) {
    return "当前接口不支持 response_format（JSON 输出模式）。把 MODEL_OBJECT_MODE 设为 text 可完全绕开该能力，改由本地从文本中提取并校验 JSON。";
  }
  if (/reasoning_content|thinking/i.test(detail)) {
    return "该模型把内容放在思考字段里，正文为空。请换成非思考模式的模型（如 deepseek-chat），或设置 MODEL_OBJECT_MODE=text 后重试。";
  }
  if (/401|invalid api key|unauthorized|authentication/i.test(detail)) {
    return "API Key 无效或未授权，请检查 OPENAI_API_KEY 是否与 OPENAI_BASE_URL 属于同一个服务商。";
  }
  if (/404|model.*not.*found|does not exist/i.test(detail)) {
    return "模型名不存在，请核对 MODEL 的拼写（注意大小写与版本后缀）。";
  }
  if (/429|rate limit/i.test(detail)) {
    return "触发上游限流，稍后重试或换模型/提高配额。";
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|fetch failed|ENOTFOUND/i.test(detail)) {
    return "连接不上模型接口，请确认 OPENAI_BASE_URL 可达（本地模型需先启动服务）。";
  }
  if (/JSON|zod|parse|expected|invalid/i.test(detail)) {
    return "模型返回的内容不符合要求的 JSON 结构。可换一个更强的模型，或把 MODEL_OBJECT_MODE 设为 text 让本地负责提取校验。";
  }
  return "请检查 OPENAI_API_KEY / OPENAI_BASE_URL / MODEL 是否正确，以及该模型是否支持结构化输出。";
}

async function callModel<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // 配置类错误原样上抛：前端要拿到 MISSING_API_KEY 才能给出"去配 .env.local"的提示，
    // 包装成"模型调用失败"会把用户引到错误的方向。
    if (error instanceof MissingApiKeyError) throw error;

    const detail = error instanceof Error ? error.message : String(error);
    throw new ModelCallError(
      `${label}失败：${detail}\n\n${diagnose(detail)}`,
      error,
    );
  }
}

/* ==================== 结构化输出统一入口 ==================== */

function tryParseObject(text: string): unknown {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 从 `start`（必须是 `{`）开始做 JSON 感知的括号配平扫描，
 * 返回完整对象的字符串；未闭合返回 null。
 * 需要识别字符串与转义，否则 `{"a":"}"}` 这类内容会被截错。
 */
function sliceBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

/**
 * 从模型返回的文本里提取 JSON。
 * 用于 `text` 通道：不依赖 response_format、也不依赖工具调用，
 * 适配那些两种能力都没有的思考型模型与第三方网关。
 *
 * 思考模型经常在正文前后夹带解释文字，所以这里不是简单截取首尾大括号，
 * 而是逐个 `{` 起点做括号配平并尝试解析，取第一个能解析成功的对象。
 */
function extractJson(raw: string): unknown {
  let text = raw.trim();

  // 去掉 ```json ... ``` 代码围栏
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();

  const direct = tryParseObject(text);
  if (direct !== undefined) return direct;

  // 限制尝试次数，避免超长文本下的 O(n²) 退化
  let attempts = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "{") continue;
    if ((attempts += 1) > 200) break;

    const candidate = sliceBalancedObject(text, i);
    if (!candidate) continue;

    const parsed = tryParseObject(candidate);
    if (parsed !== undefined) return parsed;
  }

  throw new Error(
    "模型未返回可解析的 JSON 对象（正文可能被解释性文字或截断破坏），请换用更强的模型，或设置 MODEL_OBJECT_MODE=json/tool 换一条通道。",
  );
}

interface StructuredOptions<T extends z.ZodTypeAny> {
  schema: T;
  system: string;
  prompt: string;
  temperature: number;
  /**
   * 采样种子。留空即取 getSeed()（默认 42）。
   * 显式传 undefined 不会关闭 seed：要关闭请设 MODEL_SEED=off。
   */
  seed?: number;
}

/**
 * 把 seed 收敛成"要么有、要么没有"的可 spread 片段。
 * 不写成 `{ seed: undefined }`：strict 模式下可选属性被显式赋 undefined 会报错，
 * 而且部分网关收到 `"seed": null` 会直接 400。
 */
function seedParam(seed: number | undefined): { seed?: number } {
  return seed === undefined ? {} : { seed };
}

/**
 * 上游拒绝结构化输出通道时的特征：
 * 思考模型拒 tool_choice、网关拒 response_format / json output 等。
 * 只匹配"服务端不支持该能力"，不匹配本地的 Zod 校验失败（那种降级也救不了）。
 */
function isFormatRejection(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error);
  return /tool_choice|response_format|json_object|json mode|structured ?output|thinking mode|does not support[^.]*\b(json|tool)/i.test(
    detail,
  );
}

/** 通道 A：response_format: json_object（deepseek-chat 走这条） */
async function generateViaJson<T extends z.ZodTypeAny>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const { object } = await generateObject({
    model: getModel(),
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
    ...seedParam(options.seed ?? getSeed()),
    mode: "json",
    maxRetries: 2,
  });

  return object as z.infer<T>;
}

/** 通道 B：function calling 强制 schema */
async function generateViaTool<T extends z.ZodTypeAny>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const { object } = await generateObject({
    model: getModel(),
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature,
    ...seedParam(options.seed ?? getSeed()),
    mode: "tool",
    maxRetries: 2,
  });

  return object as z.infer<T>;
}

/**
 * 通道 C：纯文本 + 本地提取校验。
 * 不向服务端要求任何结构化能力，兼容性最强；代价是依赖模型遵循 prompt，
 * 因此这里用 zod 做硬校验，不合格直接抛错交给上层重试/报错。
 */
async function generateViaText<T extends z.ZodTypeAny>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const { text } = await generateText({
    model: getModel(),
    system: `${options.system}

输出格式（必须严格遵守）：
- 只输出一个 JSON 对象，不要输出任何解释、前后缀或 markdown 代码块；
- 所有字符串字段用双引号，不要有尾随逗号。`,
    prompt: `${options.prompt}

再次强调：直接输出符合上述结构的 JSON 对象。`,
    temperature: options.temperature,
    ...seedParam(options.seed ?? getSeed()),
    maxRetries: 2,
  });

  return options.schema.parse(extractJson(text)) as z.infer<T>;
}

/**
 * 一旦确认"上游拒绝 JSON 通道"，就在本进程内记住，后续请求直接走文本通道。
 * 这是模型/网关级别的能力事实（不是用户偏好），所以进程内共享是正确的；
 * 否则每次生成都要先撞一次墙、多花一次往返和 token。
 */
let preferTextChannel = false;

/**
 * 一次结构化生成，按 MODEL_OBJECT_MODE 选择通道。
 * 默认 auto：先走 json 通道，被上游拒绝时自动降级为文本通道并记住，
 * 这样思考模型与受限网关都不需要用户手工改配置。
 *
 * deepseek-chat 支持 response_format: json_object，因此正常情况下始终走 json 通道，
 * 降级链（json → 纯文本 → 本地 Zod 校验）只是保险丝。
 */
async function generateStructured<T extends z.ZodTypeAny>(
  options: StructuredOptions<T>,
): Promise<z.infer<T>> {
  const mode = getObjectMode();

  if (mode === "text" || (mode === "auto" && preferTextChannel)) {
    return generateViaText(options);
  }
  if (mode === "tool") return generateViaTool(options);
  if (mode === "json") return generateViaJson(options);

  try {
    return await generateViaJson(options);
  } catch (error) {
    if (!isFormatRejection(error)) throw error;

    preferTextChannel = true;
    console.warn(
      "[jobfit] 上游拒绝 JSON 通道，后续请求改用文本通道：",
      error instanceof Error ? error.message.slice(0, 200) : error,
    );
    return generateViaText(options);
  }
}

/* ============================ 1. 解析 ============================ */

export async function parseResume(text: string): Promise<ResumeProfile> {
  return callModel("简历解析", () =>
    generateStructured({
      schema: resumeSchema,
      system: RESUME_SYSTEM,
      prompt: buildResumeParsePrompt(text),
      temperature: getTemperature(0.1),
      seed: getSeed(),
    }),
  );
}

export async function parseJd(text: string): Promise<JdProfile> {
  return callModel("JD 解析", () =>
    generateStructured({
      schema: jdSchema,
      system: JD_SYSTEM,
      prompt: buildJdParsePrompt(text),
      temperature: getTemperature(0.1),
      seed: getSeed(),
    }),
  );
}

/* ============================ 2. 匹配 ============================ */

export async function matchResumeToJd(
  resume: ResumeProfile,
  jd: JdProfile,
  options: { resumeText?: string; jdText?: string } = {},
): Promise<MatchReport> {
  return callModel("匹配分析", async () => {
    const object = await generateStructured({
      schema: matchSchema,
      system: MATCH_SYSTEM,
      prompt: buildMatchPrompt(resume, jd, options.resumeText, options.jdText),
      temperature: getTemperature(0.2),
      seed: getSeed(),
    });

    // 语义来自模型，总分与维度纪律由本地确定性层收口
    return finalizeMatchReport(object, resume, jd);
  });
}

/* ============================ 3. 生成 ============================ */

/** 中英混排字数统计：中日韩字符按字计，拉丁按词计 */
export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? [])
    .length;
  const latin = (text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length;
  return cjk + latin;
}

export async function generateAssets(
  resume: ResumeProfile,
  jd: JdProfile,
  match: MatchReport,
  options: { resumeText?: string } = {},
): Promise<GenerationResult> {
  const { resumeText } = options;

  // 三块内容互不依赖，并行调用：更快，且各自的 schema 更小、更不容易截断
  const [bullets, coverLetter, interview] = await Promise.all([
    callModel("定制 bullet 生成", () =>
      generateStructured({
        schema: tailoredBulletsSchema,
        system: TAILORED_BULLETS_SYSTEM,
        prompt: buildBulletsPrompt(resume, jd, match, resumeText),
        temperature: getTemperature(0.3),
        seed: getSeed(),
      }),
    ),

    callModel("Cover Letter 生成", async () => {
      const letter = await generateStructured({
        schema: coverLetterSchema,
        system: COVER_LETTER_SYSTEM,
        prompt: buildCoverLetterPrompt(resume, jd, match, resumeText),
        temperature: getTemperature(0.4),
        seed: getSeed(),
      });
      // 字数由本地统计，避免模型自报数字不准
      return { ...letter, wordCount: countWords(letter.body) };
    }),

    callModel("面试问题生成", () =>
      generateStructured({
        schema: interviewPackSchema,
        system: INTERVIEW_SYSTEM,
        prompt: buildInterviewPrompt(resume, jd, match, resumeText),
        temperature: getTemperature(0.4),
        seed: getSeed(),
      }),
    ),
  ]);

  return {
    bullets: bullets as TailoredBullets,
    coverLetter: coverLetter as CoverLetter,
    interview: interview as InterviewPack,
  };
}

/* ============================ 4. 当前模型标识 ============================ */

export { getModelId };
