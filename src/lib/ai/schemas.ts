import { z } from "zod";

/**
 * 所有 LLM 结构化输出的 Zod schema。
 * 设计原则：
 * 1) 字段名与 src/lib/types.ts 一一对应；
 * 2) 用 .describe() 给模型写清约束（json mode 下 schema 会注入 prompt）；
 * 3) 尽量用 string 而非 enum，避免部分兼容端点对 enum 支持不佳导致解析失败。
 */

/* ============================ 通用 ============================ */

/**
 * 证据引用。要求 quote 逐字来自原文，便于前端做定位高亮。
 */
export const evidenceSchema = z.object({
  source: z
    .enum(["resume", "jd"])
    .describe("证据来源：resume 表示来自简历，jd 表示来自职位描述"),
  quote: z
    .string()
    .min(2)
    .max(200)
    .describe("原文摘录，必须逐字摘自对应来源，不要改写、不要总结、不要编造"),
});

/* ============================ 简历 ============================ */

export const resumeSchema = z.object({
  name: z.string().describe("候选人姓名；简历中未出现则填空字符串"),
  contact: z.object({
    email: z.string().describe("邮箱，没有则空字符串"),
    phone: z.string().describe("电话，没有则空字符串"),
    location: z.string().describe("所在城市，没有则空字符串"),
    links: z.array(z.string()).describe("个人主页/GitHub/LinkedIn 等链接，没有则空数组"),
  }),
  summary: z
    .string()
    .describe("用 2-3 句话概括候选人定位与核心优势；基于原文归纳，不要添加原文没有的经历"),
  skills: z
    .array(z.string())
    .describe("技能关键词列表，逐个短词，如 React、TypeScript、Kubernetes"),
  experiences: z
    .array(
      z.object({
        company: z.string().describe("公司名称"),
        title: z.string().describe("职位名称"),
        start: z.string().describe("开始时间，如 2021.03；不确定则空字符串"),
        end: z.string().describe("结束时间，如 至今；不确定则空字符串"),
        bullets: z
          .array(z.string())
          .describe("该段经历的职责与成果，逐条保留原文，不要合并、不要润色"),
      }),
    )
    .describe("工作经历，按时间倒序"),
  projects: z
    .array(
      z.object({
        name: z.string().describe("项目名称"),
        role: z.string().describe("担任角色，没有则空字符串"),
        description: z.string().describe("一句话说明项目是什么"),
        bullets: z.array(z.string()).describe("项目中的具体工作与成果，保留原文"),
        tech: z.array(z.string()).describe("项目使用的技术栈"),
      }),
    )
    .describe("项目经历"),
  education: z
    .array(
      z.object({
        school: z.string().describe("学校名称"),
        degree: z.string().describe("学位，如 本科/硕士"),
        major: z.string().describe("专业"),
        start: z.string().describe("开始时间"),
        end: z.string().describe("毕业时间"),
      }),
    )
    .describe("教育经历"),
  quantified: z
    .array(z.string())
    .describe("所有带数字的量化成果原文，如“接口 P99 从 800ms 降到 120ms”"),
  totalYears: z
    .number()
    .nullable()
    .describe("由工作经历推算的总工作年限，无法判断时填 null"),
});

/* ============================ JD ============================ */

export const jdSchema = z.object({
  title: z.string().describe("职位名称"),
  company: z.string().describe("公司名称，未提及则空字符串"),
  location: z.string().describe("工作地点，未提及则空字符串"),
  seniority: z.string().describe("职级，如 初级/中级/高级/资深/专家；未提及则空字符串"),
  yearsRequired: z
    .number()
    .nullable()
    .describe("要求的年限（数字），未明确则填 null"),
  employmentType: z.string().describe("用工形式，如 全职/实习/外包；未提及则空字符串"),
  skillsRequired: z
    .array(
      z.object({
        skill: z.string().describe("技能关键词"),
        importance: z
          .enum(["must", "nice"])
          .describe("must 表示硬性要求（必须/精通/熟悉），nice 表示加分项（优先/了解）"),
      }),
    )
    .describe("JD 中出现的所有技能要求"),
  responsibilities: z.array(z.string()).describe("岗位职责，逐条列出"),
  qualifications: z.array(z.string()).describe("任职要求，逐条列出"),
  bonus: z.array(z.string()).describe("加分项、优先条件"),
  keywords: z
    .array(z.string())
    .describe("后续用于关键词覆盖度比对的核心关键词，10-25 个，可为技能、领域、方法论"),
});

/* ============================ 匹配分析 ============================ */

export const matchSchema = z.object({
  dimensions: z
    .array(
      z.object({
        key: z
          .enum([
            "skillCoverage",
            "experienceRelevance",
            "keywordCoverage",
            "educationSeniority",
          ])
          .describe(
            "维度标识：skillCoverage=技能覆盖，experienceRelevance=经验相关，keywordCoverage=关键词覆盖，educationSeniority=教育年限",
          ),
        // 字段顺序即模型生成顺序：先写证据、再写差距与依据、最后给分。
        // 这让分数"被证据推出来"，而不是先拍一个分数再补理由（后者是分数漂移的主因）。
        evidence: z
          .array(evidenceSchema)
          .describe(
            "【第一步 必填】先列证据：支撑该维度判断的原文摘录。简历侧与 JD 侧各至少 1 条。写分数之前必须先写完这里，且不得出现 evidence 之外的新事实",
          ),
        gap: z
          .array(z.string())
          .describe(
            "该维度上具体差在哪里：JD 要求但简历未体现、或证据明显薄弱的项，逐条写清；确实没有差距则返回空数组",
          ),
        rationale: z
          .string()
          .describe(
            "【第二步】基于上面的 evidence 与 gap 归纳判断依据，2-3 句，须点名具体技能或经历，不得引入新事实",
          ),
        score: z
          .number()
          .min(0)
          .max(100)
          .describe(
            "【第三步】最后给分：0-100 的整数。分数必须与 evidence/gap 的强弱一致，宁低勿高，严禁讨好式打分",
          ),
      }),
    )
    .describe(
      "必须且只能包含 4 个维度，按 skillCoverage、experienceRelevance、keywordCoverage、educationSeniority 的顺序输出",
    ),
  strongMatches: z
    .array(
      z.object({
        point: z.string().describe("强匹配点，一句话，明确到具体技能或经历"),
        evidence: z
          .array(evidenceSchema)
          .describe("简历侧与 JD 侧各至少 1 条原文证据"),
      }),
    )
    .describe("强匹配点，3-6 条"),
  missingSkills: z
    .array(
      z.object({
        skill: z.string().describe("简历中缺失或被明显弱化的技能"),
        severity: z
          .enum(["high", "medium", "low"])
          .describe("high=JD 硬性要求且简历完全没有；medium=JD 要求但简历证据薄弱；low=加分项缺失"),
        suggestion: z
          .string()
          .describe("补救建议，只能建议补充真实经历或调整表达，禁止建议编造经历"),
        evidence: z.array(evidenceSchema).describe("证明该技能被 JD 要求的原文"),
      }),
    )
    .describe("缺失技能，1-6 条，按严重度倒序"),
  weakMatches: z
    .array(
      z.object({
        point: z.string().describe("弱匹配点"),
        reason: z.string().describe("为什么算弱匹配：领域不同、深度不足、时间久远、缺少数据等"),
        evidence: z.array(evidenceSchema).describe("相关原文证据"),
      }),
    )
    .describe("弱匹配点，1-5 条"),
  risks: z
    .array(
      z.object({
        risk: z.string().describe("风险提示，例如频繁跳槽、资历高于岗位、行业跨度大"),
        why: z.string().describe("为什么这是风险"),
        mitigation: z.string().describe("如何在简历或面试中化解"),
      }),
    )
    .describe("风险提示，0-4 条；没有问题则返回空数组"),
  summary: z.string().describe("给候选人的一句话总评 + 一条最优先改进建议，80 字以内"),
});

/* ============================ 生成内容 ============================ */

export const tailoredBulletsSchema = z.object({
  items: z
    .array(
      z.object({
        original: z
          .string()
          .describe("简历中的原始描述原文；若为整合多条，则用“ / ”连接相关原文"),
        tailored: z
          .string()
          .describe(
            "定制后的 bullet，严格使用 XYZ 结构：通过 X（做法/技术），实现 Y（结果），带来 Z（业务价值或数字）。只重组强化真实经历，禁止新增未发生的事实；缺数字时用【】标注待补充",
          ),
        targets: z.array(z.string()).describe("该 bullet 对应的 JD 要求关键词"),
        evidence: z
          .array(evidenceSchema)
          .describe("该 bullet 所依据的简历原文证据"),
      }),
    )
    .describe("定制 bullet 列表，6-10 条，覆盖最相关的经历"),
  notes: z
    .array(z.string())
    .describe("生成说明：哪些是语言重组、哪些地方建议你补充真实数据，2-5 条"),
});

export const coverLetterSchema = z.object({
  salutation: z.string().describe("称呼，中文如“尊敬的招聘经理”"),
  body: z
    .string()
    .describe(
      "Cover Letter 正文，中文不超过 300 字（英文不超过 200 词），3-4 段：为什么这个岗位/公司、最相关的 2 项经历与量化成果、你能带来的价值、简短收尾。禁止编造经历，禁止空话套话",
    ),
  signOff: z.string().describe("落款，如“此致\\n敬礼\\n[姓名]”"),
});

export const interviewPackSchema = z.object({
  questions: z
    .array(
      z.object({
        category: z
          .enum(["技术", "行为", "岗位理解", "反向提问"])
          .describe("问题类别"),
        question: z.string().describe("面试问题原文（模拟面试官口吻）"),
        intent: z.string().describe("面试官问这道题想考察什么"),
        answerOutline: z
          .array(z.string())
          .describe("回答思路，3-5 个要点，必须能引用候选人真实经历"),
        evidence: z
          .array(evidenceSchema)
          .describe("可用于作答的简历原文素材"),
        followUps: z.array(z.string()).describe("可能的追问，1-3 条"),
      }),
    )
    .describe("面试问题列表，恰好 10 条：技术类约 5 条，行为类约 3 条，岗位理解 1 条，反向提问 1 条"),
});

/* ============================ 说明 ============================ */

/**
 * schema 的推断类型由 `z.infer` 在使用处就地取得（见 src/lib/ai/pipeline.ts），
 * 领域模型类型统一以 src/lib/types.ts 为唯一契约，避免出现两套类型定义。
 */
