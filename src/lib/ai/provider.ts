import { createOpenAI } from "@ai-sdk/openai";

/**
 * 模型接入层。
 * 支持任意 OpenAI 兼容接口：官方 OpenAI、DeepSeek、通义、Moonshot、vLLM、Ollama、One-API 等。
 * 只要填入 OPENAI_BASE_URL + OPENAI_API_KEY + MODEL 即可切换。
 */

export const DEFAULT_MODEL = "gpt-4o-mini";
export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

/**
 * 默认采样温度。
 * 评分/解析这类任务要的是"确定性判断"，不是"文采"：
 * 温度越高，同一份 JD + 简历每次得到的分数越飘。
 */
export const DEFAULT_TEMPERATURE = 0.2;

/**
 * 默认采样种子。
 * DeepSeek 与 OpenAI 的 chat/completions 都接受 seed；固定种子后，
 * 相同输入 + 相同温度 + 相同模型会尽量产生相同输出。
 * 这是"连跑 3 次分数波动 < 5 分"的第一道保障（第二道是 scoring.ts 的本地加权）。
 */
export const DEFAULT_SEED = 42;

/** 缺少 API Key 时抛出，路由层据此返回 400 + MISSING_API_KEY */
export class MissingApiKeyError extends Error {
  constructor() {
    super("未配置 OPENAI_API_KEY，请在 .env.local 中填写后重启服务");
    this.name = "MissingApiKeyError";
  }
}

/** 当前使用的模型 id */
export function getModelId(): string {
  return process.env.MODEL?.trim() || DEFAULT_MODEL;
}

/** 规范化 baseURL：去空白、去末尾斜杠 */
export function getBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL?.trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/** 生成温度：评分/解析任务默认低温，保证稳定；可用 MODEL_TEMPERATURE 覆盖 */
export function getTemperature(fallback = DEFAULT_TEMPERATURE): number {
  const raw = Number(process.env.MODEL_TEMPERATURE);
  if (Number.isFinite(raw) && raw >= 0 && raw <= 2) return raw;
  return fallback;
}

/**
 * 采样种子（非负整数）。
 * - 不设 MODEL_SEED：使用默认 42，评分可复现；
 * - MODEL_SEED=off / none / random：不发 seed，交回上游随机
 *   （上游不支持 seed 参数、或确实需要多样输出时用）；
 * - MODEL_SEED=<非负整数>：使用指定种子。
 */
export function getSeed(
  fallback: number | undefined = DEFAULT_SEED,
): number | undefined {
  const raw = (process.env.MODEL_SEED ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "off" || raw === "none" || raw === "random") return undefined;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * 结构化输出的获取通道。
 *
 * - `auto`（默认）：先用 `response_format: json_object`；若上游拒绝（思考模型、
 *   部分第三方网关），自动降级为"纯文本 + 本地提取校验"，无需用户改配置；
 * - `json`：只用 response_format，失败即报错；
 * - `tool`：用 function calling 强制 schema（需要模型支持 tool_choice）；
 * - `text`：完全不依赖 response_format 与工具调用，由本地从文本里提取 JSON 再校验。
 *
 * 背景：推理/思考类模型会拒绝 `tool_choice`（"Thinking mode does not support
 * this tool_choice"），另一些网关不支持 `response_format`。这两种情况 auto 都能兜住。
 *
 * deepseek-chat（V3）本身直接支持 response_format: json_object，
 * 因此它走的是优先级最高的 json 通道，不会触发降级。
 */
export type ObjectMode = "auto" | "json" | "tool" | "text";

export function getObjectMode(): ObjectMode {
  const raw = (process.env.MODEL_OBJECT_MODE ?? "").trim().toLowerCase();
  if (raw === "auto" || raw === "json" || raw === "tool" || raw === "text") {
    return raw;
  }
  return "auto";
}

/**
 * 获取语言模型实例。
 * compatibility 默认 "compatible"：使用 chat/completions 协议，
 * 兼容性最好；直连 OpenAI 官方且需要 strict structured outputs 时
 * 可设 MODEL_COMPATIBILITY=strict。
 */
export function getModel() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new MissingApiKeyError();

  const compatibility =
    process.env.MODEL_COMPATIBILITY?.trim() === "strict"
      ? ("strict" as const)
      : ("compatible" as const);

  const client = createOpenAI({
    apiKey,
    baseURL: getBaseUrl(),
    compatibility,
  });

  return client(getModelId());
}
