import type {
  DimensionKey,
  JdProfile,
  MatchReport,
  RawScoreDimension,
  ResumeProfile,
  ScoreDimension,
} from "@/lib/types";

/**
 * 确定性评分层。
 *
 * 模型负责"语义判断"，本地负责"算术与纪律"：
 * 1) 权重固定为 技能覆盖 40% / 经验相关 30% / 关键词 20% / 教育年限 10%；
 * 2) 总分由本地按权重计算，避免模型心算错；
 * 3) 用确定性的关键词覆盖率给模型分数做锚定，偏差过大时向客观值收敛，
 *    以抑制"讨好式打分"（这是 LLM 打分最常见的失效模式）。
 */

export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  skillCoverage: 0.4,
  experienceRelevance: 0.3,
  keywordCoverage: 0.2,
  educationSeniority: 0.1,
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  skillCoverage: "技能覆盖",
  experienceRelevance: "经验相关",
  keywordCoverage: "关键词覆盖",
  educationSeniority: "教育/年限",
};

/** 模型分数与客观值允许的最大偏差；超过则向客观值收敛一半 */
const ANCHOR_TOLERANCE = 35;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/* ==================== 文本归一化与术语命中 ==================== */

/** 简历全文拼接（用于关键词/技能命中判定） */
export function resumeToHaystack(resume: ResumeProfile): string {
  return [
    resume.summary ?? "",
    resume.skills.join(" "),
    resume.experiences
      .map((e) =>
        [e.company, e.title, ...(e.bullets ?? [])].filter(Boolean).join(" "),
      )
      .join(" "),
    resume.projects
      .map((p) =>
        [p.name, p.role, p.description, ...(p.bullets ?? []), ...(p.tech ?? [])]
          .filter(Boolean)
          .join(" "),
      )
      .join(" "),
    resume.education
      .map((e) => [e.school, e.degree, e.major].filter(Boolean).join(" "))
      .join(" "),
    resume.quantified.join(" "),
  ]
    .join("\n")
    .toLowerCase();
}

/**
 * 判断术语是否出现在文本中。
 *
 * 规则：
 * - 中日韩术语直接子串匹配；
 * - 拉丁术语用词边界匹配，避免 "Go" 命中 "Google"；
 * - 以 + / # 结尾的术语（C++、C#）后边界额外允许数字，否则 "熟悉 C++11" 会被判为缺失；
 * - 以 . / # / + 开头的术语（.NET）前边界放宽，否则 "ASP.NET" 会被判为缺失；
 * - 空白与斜杠视为等价，覆盖 "node.js" / "node js"、"CI/CD" / "CI CD" 这类写法差异。
 */
export function containsTerm(haystack: string, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return false;
  const h = haystack.toLowerCase();

  const isLatin = /^[a-z0-9+#.\-/_ ]+$/i.test(t);
  if (!isLatin) {
    return h.includes(t);
  }

  const normalized = t.replace(/[\s/]+/g, " ");
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.replace(/ /g, "[\\s/]*");

  const head = /^[.#+]/.test(normalized) ? "" : "(^|[^a-z0-9_])";
  const tail = /[+#]$/.test(normalized)
    ? "([^a-z0-9_]|\\d|$)"
    : "([^a-z0-9_]|$)";

  return new RegExp(`${head}${flexible}${tail}`, "i").test(h);
}

/* ==================== 客观信号 ==================== */

export interface DeterministicSignals {
  /** 技能覆盖率 0-100（must 权重 2，nice 权重 1） */
  skillCoverage: number;
  /** 关键词覆盖率 0-100 */
  keywordCoverage: number;
  /** 命中的 must 技能 */
  hitMust: string[];
  /** 缺失的 must 技能 */
  missMust: string[];
  /** 缺失的关键词 */
  missKeywords: string[];
}

/** 本地计算技能/关键词覆盖率，作为模型分数的锚 */
export function computeDeterministicSignals(
  resume: ResumeProfile,
  jd: JdProfile,
): DeterministicSignals {
  const haystack = resumeToHaystack(resume);

  const hitMust: string[] = [];
  const missMust: string[] = [];
  let weightSum = 0;
  let hitWeight = 0;

  for (const item of jd.skillsRequired ?? []) {
    const w = item.importance === "must" ? 2 : 1;
    weightSum += w;
    const hit = containsTerm(haystack, item.skill);
    if (hit) {
      hitWeight += w;
      if (item.importance === "must") hitMust.push(item.skill);
    } else if (item.importance === "must") {
      missMust.push(item.skill);
    }
  }

  const missKeywords: string[] = [];
  for (const kw of jd.keywords ?? []) {
    if (!containsTerm(haystack, kw)) missKeywords.push(kw);
  }
  const keywordTotal = (jd.keywords ?? []).length;

  return {
    skillCoverage: weightSum > 0 ? clamp((hitWeight / weightSum) * 100) : 60,
    keywordCoverage:
      keywordTotal > 0
        ? clamp(((keywordTotal - missKeywords.length) / keywordTotal) * 100)
        : 60,
    hitMust,
    missMust,
    missKeywords,
  };
}

/* ==================== 维度整理 ==================== */

/**
 * 规范化模型返回的维度数组：
 * - 补齐 label 与 weight（权重是产品决定，不由模型给出）；
 * - 补齐缺失维度（用确定性的兜底值）；
 * - 去重（同 key 取先出现的）；
 * - clamp 到 0-100 并取整；
 * - 对 skillCoverage / keywordCoverage 做锚定收敛。
 */
export function normalizeDimensions(
  raw: RawScoreDimension[],
  signals: DeterministicSignals,
): ScoreDimension[] {
  const byKey = new Map<DimensionKey, ScoreDimension>();

  for (const dim of raw ?? []) {
    if (!byKey.has(dim.key)) {
      byKey.set(dim.key, {
        ...dim,
        score: clamp(dim.score),
        weight: DIMENSION_WEIGHTS[dim.key] ?? 0,
        label: DIMENSION_LABELS[dim.key] ?? dim.key,
        evidence: dim.evidence ?? [],
      });
    }
  }

  (Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]).forEach((key) => {
    if (byKey.has(key)) return;
    // 模型漏掉的维度：用本地确定性值兜底，避免总分被虚高
    const fallback =
      key === "skillCoverage"
        ? signals.skillCoverage
        : key === "keywordCoverage"
          ? signals.keywordCoverage
          : 60;

    byKey.set(key, {
      key,
      label: DIMENSION_LABELS[key],
      weight: DIMENSION_WEIGHTS[key],
      score: fallback,
      rationale:
        key === "skillCoverage" || key === "keywordCoverage"
          ? "模型未返回该维度，已使用本地关键词匹配结果作为兜底分。"
          : "模型未返回该维度，已按中性值 60 兜底，建议重新分析。",
      evidence: [],
    });
  });

  // 锚定：模型分数与客观覆盖率偏差过大时向客观值靠拢
  const anchor = (key: DimensionKey, objective: number) => {
    const dim = byKey.get(key)!;
    if (Math.abs(dim.score - objective) <= ANCHOR_TOLERANCE) return;
    const pulled = clamp((dim.score + objective) / 2);
    if (pulled === dim.score) return;
    byKey.set(key, {
      ...dim,
      score: pulled,
      rationale: `${dim.rationale}（本地关键词校验值为 ${objective}，已按偏差修正。）`,
    });
  };

  anchor("skillCoverage", signals.skillCoverage);
  anchor("keywordCoverage", signals.keywordCoverage);

  return (
    ["skillCoverage", "experienceRelevance", "keywordCoverage", "educationSeniority"] as DimensionKey[]
  ).map((k) => byKey.get(k)!);
}

/** 按权重计算总分（0-100 整数） */
export function computeTotalScore(dimensions: ScoreDimension[]): number {
  const weightSum = dimensions.reduce(
    (sum, d) => sum + (DIMENSION_WEIGHTS[d.key] ?? 0),
    0,
  );
  if (weightSum <= 0) return 0;
  const weighted = dimensions.reduce(
    (sum, d) => sum + d.score * (DIMENSION_WEIGHTS[d.key] ?? 0),
    0,
  );
  return clamp(weighted / weightSum);
}

/** 模型返回的报告：缺 totalScore 与补齐后的维度字段 */
export type RawMatchReport = Omit<MatchReport, "totalScore" | "dimensions"> & {
  dimensions: RawScoreDimension[];
};

/** 组装最终 MatchReport：模型语义 + 本地总分 */
export function finalizeMatchReport(
  raw: RawMatchReport,
  resume: ResumeProfile,
  jd: JdProfile,
): MatchReport {
  const signals = computeDeterministicSignals(resume, jd);
  const dimensions = normalizeDimensions(raw.dimensions ?? [], signals);

  return {
    ...raw,
    dimensions,
    strongMatches: raw.strongMatches ?? [],
    missingSkills: [...(raw.missingSkills ?? [])].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    ),
    weakMatches: raw.weakMatches ?? [],
    risks: raw.risks ?? [],
    totalScore: computeTotalScore(dimensions),
  };
}

function severityRank(s: string): number {
  return s === "high" ? 3 : s === "medium" ? 2 : s === "low" ? 1 : 0;
}
