/**
 * 全项目共享类型定义。
 * 所有 LLM 结构化输出与前端状态都以此为准，Zod schema 与之一一对应（见 src/lib/ai/schemas.ts）。
 */

/* ============================ 简历 ============================ */

export interface ResumeContact {
  email?: string;
  phone?: string;
  location?: string;
  /** 个人主页 / GitHub / LinkedIn 等链接 */
  links?: string[];
}

export interface ResumeExperience {
  company: string;
  title: string;
  start?: string;
  end?: string;
  /** 原始职责描述（逐条，保留原文以便标注证据来源） */
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  role?: string;
  description?: string;
  bullets?: string[];
  tech?: string[];
}

export interface ResumeEducation {
  school: string;
  degree?: string;
  major?: string;
  start?: string;
  end?: string;
}

/** 结构化简历画像 */
export interface ResumeProfile {
  name?: string;
  contact?: ResumeContact;
  /** 职业概述 / 个人总结 */
  summary?: string;
  skills: string[];
  experiences: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  /** 量化成果（带数字的成就，如“QPS 提升 3 倍”） */
  quantified: string[];
  /** 总工作年限（模型估算，可能为 null） */
  totalYears?: number | null;
}

/* ============================ JD ============================ */

export type SkillImportance = "must" | "nice";

export interface JdSkill {
  skill: string;
  importance: SkillImportance;
}

/** 结构化职位画像 */
export interface JdProfile {
  title: string;
  company?: string;
  location?: string;
  /** 职级，如“高级 / 资深 / 初级” */
  seniority?: string;
  yearsRequired?: number | null;
  employmentType?: string;
  skillsRequired: JdSkill[];
  responsibilities: string[];
  qualifications: string[];
  /** 加分项 */
  bonus: string[];
  /** 用于关键词覆盖度计算的核心关键词 */
  keywords: string[];
}

/* ============================ 匹配分析 ============================ */

export type EvidenceSource = "resume" | "jd";

/** 每条结论必须带来源引用 */
export interface Evidence {
  source: EvidenceSource;
  /** 原文摘录（来自简历或 JD 的具体段落） */
  quote: string;
}

/** 四维评分：技能覆盖 40 / 经验相关 30 / 关键词 20 / 教育年限 10 */
export type DimensionKey =
  | "skillCoverage"
  | "experienceRelevance"
  | "keywordCoverage"
  | "educationSeniority";

/**
 * 模型返回的原始维度：只有语义判断，不含 label / weight。
 * label 与 weight 由服务端按固定规则补齐（见 src/lib/scoring.ts），
 * 这样"改权重"是改代码，而不是靠模型自觉。
 */
export interface RawScoreDimension {
  key: DimensionKey;
  /** 0-100（模型在列完 evidence/gap 之后才给出的结论值） */
  score: number;
  rationale: string;
  evidence: Evidence[];
  /**
   * 该维度上的具体差距（JD 要求但简历未体现、或证据薄弱）。
   * 可选：历史记录与本地兜底维度可能没有这个字段。
   */
  gap?: string[];
}

export interface ScoreDimension extends RawScoreDimension {
  label: string;
  /** 权重（0-1，四维合计 1） */
  weight: number;
}

export interface StrongMatch {
  point: string;
  evidence: Evidence[];
}

export interface MissingSkill {
  skill: string;
  /** high = JD 硬性要求但简历完全没有 */
  severity: "high" | "medium" | "low";
  suggestion: string;
  evidence: Evidence[];
}

export interface WeakMatch {
  point: string;
  /** 为什么算弱匹配 */
  reason: string;
  evidence: Evidence[];
}

export interface RiskItem {
  risk: string;
  why: string;
  mitigation: string;
}

/** 匹配报告：LLM 产出语义 + 服务端确定性加权得到 totalScore */
export interface MatchReport {
  totalScore: number;
  dimensions: ScoreDimension[];
  strongMatches: StrongMatch[];
  missingSkills: MissingSkill[];
  weakMatches: WeakMatch[];
  risks: RiskItem[];
  /** 一句话总结（给简历主人的直接建议） */
  summary: string;
}

/* ============================ 生成内容 ============================ */

export interface TailoredBullet {
  /** 简历中对应的原始 bullet（用于对齐，不造假） */
  original: string;
  /** 定制后的 XYZ 句式：通过 X，实现 Y，带来 Z */
  tailored: string;
  /** 命中的 JD 要求 */
  targets: string[];
  /** 支撑该 bullet 的简历原文证据 */
  evidence: Evidence[];
}

export interface TailoredBullets {
  items: TailoredBullet[];
  /** 生成说明：哪些内容是重组、哪些建议补充真实数据 */
  notes: string[];
}

export interface CoverLetter {
  /** 称呼，如“尊敬的招聘经理” */
  salutation: string;
  /** 正文，中文 300 字以内（英文按 200 词以内） */
  body: string;
  /** 落款 */
  signOff: string;
  /** 正文字数（服务端统计） */
  wordCount: number;
}

export type QuestionCategory = "技术" | "行为" | "岗位理解" | "反向提问";

export interface InterviewQuestion {
  category: QuestionCategory;
  question: string;
  /** 面试官问这道题的意图 */
  intent: string;
  /** 回答思路要点 */
  answerOutline: string[];
  /** 可引用的简历素材 */
  evidence: Evidence[];
  /** 追问方向 */
  followUps: string[];
}

export interface InterviewPack {
  questions: InterviewQuestion[];
}

/* ============================ 聚合结果 ============================ */

export interface GenerationResult {
  bullets: TailoredBullets;
  coverLetter: CoverLetter;
  interview: InterviewPack;
}

/** 一次完整分析（历史记录的存储单元） */
export interface AnalyzeResult {
  id: string;
  createdAt: number;
  /** 用户可读标题，如“高级前端工程师 @ 某公司” */
  title: string;
  /** 简历是否由文件上传（用于历史记录标识） */
  resumeSource: "file" | "text";
  resumeFileName?: string;
  resume: ResumeProfile;
  jd: JdProfile;
  match: MatchReport;
  generation: GenerationResult;
  /** 使用的模型，便于复现 */
  model: string;
}

/* ============================ 历史记录 ============================ */

/** localStorage 中保留的最大条数 */
export const HISTORY_LIMIT = 10;

/** 历史索引项（不含大字段，列表渲染用） */
export interface HistoryItem {
  id: string;
  createdAt: number;
  title: string;
  score: number;
  model: string;
}

/* ============================ API 报文 ============================ */

export interface ApiError {
  error: string;
  /** 机器可读错误码，前端据此做差异化提示 */
  code?:
    | "MISSING_API_KEY"
    | "EMPTY_INPUT"
    | "UNSUPPORTED_FILE"
    | "PARSE_FAILED"
    | "MODEL_FAILED"
    | "BAD_REQUEST"
    | "UNKNOWN";
}

export interface ParseResumeResponse {
  resume: ResumeProfile;
  meta: {
    source: "file" | "text";
    fileName?: string;
    charCount: number;
    /**
     * 服务端提取并清洗后的简历原文（已按上限截断）。
     * 回传给浏览器是为了让后续的 match / generate 步骤能引用原文、
     * 逐字摘录证据；服务端不留存任何副本。
     */
    text: string;
  };
}

export interface ParseJdResponse {
  jd: JdProfile;
  meta: { charCount: number; model: string };
}

export interface MatchResponse {
  match: MatchReport;
}

export interface GenerateResponse {
  generation: GenerationResult;
}

export interface AnalyzeResponse {
  result: AnalyzeResult;
}
