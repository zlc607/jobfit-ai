import type {
  AnalyzeResult,
  Evidence,
  MatchReport,
  QuestionCategory,
} from "@/lib/types";
import { DIMENSION_LABELS } from "@/lib/scoring";
import { normalizeNewlines, scoreLevel } from "@/lib/utils";

/**
 * 结果 → Markdown。
 * 用于「一键复制 Markdown」与「下载 .md」。此文件是导出契约，改动需同步 README。
 */

/** 把证据数组渲染成一行紧凑引用 */
function renderEvidence(evidence: Evidence[] | undefined): string {
  if (!evidence?.length) return "";
  return evidence
    .map((e) => {
      const quote = e.quote.replace(/\s+/g, " ").trim();
      return `${e.source === "resume" ? "简历" : "JD"}：「${quote}」`;
    })
    .join("；");
}

function renderMatchSection(match: MatchReport): string {
  const level = scoreLevel(match.totalScore);
  const lines: string[] = [];

  lines.push("## 一、匹配总览");
  lines.push("");
  lines.push(`**总分：${match.totalScore} / 100 —— ${level.label}**`);
  lines.push("");
  lines.push(`> ${match.summary}`);
  lines.push("");
  lines.push("| 维度 | 得分 | 权重 | 判断依据 |");
  lines.push("| --- | --- | --- | --- |");
  for (const dim of match.dimensions) {
    lines.push(
      `| ${DIMENSION_LABELS[dim.key] ?? dim.label} | ${dim.score} | ${Math.round(
        dim.weight * 100,
      )}% | ${dim.rationale.replace(/\|/g, "/").replace(/\n/g, " ")} |`,
    );
  }
  lines.push("");

  if (match.strongMatches.length) {
    lines.push("## 二、强匹配点");
    lines.push("");
    for (const item of match.strongMatches) {
      lines.push(`- **${item.point}**`);
      const ev = renderEvidence(item.evidence);
      if (ev) lines.push(`  - 依据：${ev}`);
    }
    lines.push("");
  }

  if (match.missingSkills.length) {
    lines.push("## 三、缺失与差距");
    lines.push("");
    for (const item of match.missingSkills) {
      const tag =
        item.severity === "high"
          ? "🔴 严重"
          : item.severity === "medium"
            ? "🟡 中等"
            : "🟢 轻微";
      lines.push(`- ${tag} **${item.skill}** —— ${item.suggestion}`);
      const ev = renderEvidence(item.evidence);
      if (ev) lines.push(`  - JD 要求：${ev}`);
    }
    lines.push("");
  }

  if (match.weakMatches.length) {
    lines.push("## 四、弱匹配点");
    lines.push("");
    for (const item of match.weakMatches) {
      lines.push(`- **${item.point}** —— ${item.reason}`);
      const ev = renderEvidence(item.evidence);
      if (ev) lines.push(`  - 依据：${ev}`);
    }
    lines.push("");
  }

  if (match.risks.length) {
    lines.push("## 五、风险提示");
    lines.push("");
    for (const item of match.risks) {
      lines.push(`- **${item.risk}**`);
      lines.push(`  - 原因：${item.why}`);
      lines.push(`  - 应对：${item.mitigation}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** 生成完整 Markdown 报告 */
export function resultToMarkdown(result: AnalyzeResult): string {
  const { resume, jd, match, generation } = result;
  const lines: string[] = [];
  const time = new Date(result.createdAt).toLocaleString("zh-CN");

  lines.push(`# JobFit AI 求职匹配报告`);
  lines.push("");
  lines.push(
    `> 岗位：**${jd.title}**${jd.company ? ` @ ${jd.company}` : ""}　|　生成时间：${time}　|　模型：\`${result.model}\``,
  );
  lines.push("");

  // ---- 匹配分析 ----
  lines.push(renderMatchSection(match));

  // ---- 定制 bullet ----
  lines.push("## 六、定制简历 Bullet（XYZ 结构）");
  lines.push("");
  lines.push("> 原则：只重组与强化简历中的真实经历，不新增任何未发生的事实。");
  lines.push("");
  generation.bullets.items.forEach((item, idx) => {
    lines.push(`${idx + 1}. **${item.tailored}**`);
    lines.push(`   - 原始表述：${item.original}`);
    if (item.targets.length)
      lines.push(`   - 命中要求：${item.targets.join("、")}`);
    const ev = renderEvidence(item.evidence);
    if (ev) lines.push(`   - 证据：${ev}`);
  });
  lines.push("");
  if (generation.bullets.notes.length) {
    lines.push("**生成说明：**");
    lines.push("");
    for (const note of generation.bullets.notes) lines.push(`- ${note}`);
    lines.push("");
  }

  // ---- Cover Letter ----
  lines.push("## 七、Cover Letter");
  lines.push("");
  lines.push(`**${normalizeNewlines(generation.coverLetter.salutation)}**`);
  lines.push("");
  lines.push(normalizeNewlines(generation.coverLetter.body));
  lines.push("");
  lines.push(
    normalizeNewlines(generation.coverLetter.signOff).replace(/\n/g, "  \n"),
  );
  lines.push("");
  lines.push(`*（正文 ${generation.coverLetter.wordCount} 字）*`);
  lines.push("");

  // ---- 面试问题 ----
  lines.push("## 八、面试问题预测（共 10 题）");
  lines.push("");
  const grouped = groupByCategory(generation.interview.questions);
  for (const [category, questions] of grouped) {
    lines.push(`### ${category}`);
    lines.push("");
    questions.forEach((q, idx) => {
      lines.push(`${idx + 1}. **${q.question}**`);
      lines.push(`   - 考察点：${q.intent}`);
      if (q.answerOutline.length) {
        lines.push(`   - 回答思路：`);
        for (const point of q.answerOutline) lines.push(`     - ${point}`);
      }
      const ev = renderEvidence(q.evidence);
      if (ev) lines.push(`   - 可用素材：${ev}`);
      if (q.followUps.length)
        lines.push(`   - 可能追问：${q.followUps.join("；")}`);
    });
    lines.push("");
  }

  // ---- 附录 ----
  lines.push("## 附录：候选人结构化画像");
  lines.push("");
  lines.push(`- 姓名：${resume.name || "（未提供）"}`);
  lines.push(
    `- 联系方式：${[resume.contact?.email, resume.contact?.phone, resume.contact?.location]
      .filter(Boolean)
      .join(" / ") || "（未提供）"}`,
  );
  lines.push(`- 技能：${resume.skills.join("、") || "（未提取到）"}`);
  lines.push(
    `- 工作年限：${resume.totalYears ? `${resume.totalYears} 年` : "（未识别）"}`,
  );
  lines.push("");
  lines.push(
    `- JD 硬性技能：${
      jd.skillsRequired
        .filter((s) => s.importance === "must")
        .map((s) => s.skill)
        .join("、") || "（未识别）"
    }`,
  );
  lines.push(`- JD 加分项：${jd.bonus.join("、") || "（无）"}`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(
    "*本报告由 JobFit AI 生成，结论基于大模型分析，可能存在偏差；简历原文未被上传至任何第三方存储（除你自行配置的模型接口）。*",
  );

  return lines.join("\n");
}

function groupByCategory<T extends { category: QuestionCategory }>(
  items: T[],
): [QuestionCategory, T[]][] {
  const order: QuestionCategory[] = ["技术", "行为", "岗位理解", "反向提问"];
  const map = new Map<QuestionCategory, T[]>();
  for (const item of items) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return order
    .filter((c) => map.has(c))
    .map((c) => [c, map.get(c)!] as [QuestionCategory, T[]]);
}

/** 单独导出 bullet 段落，便于只复制这一块 */
export function bulletsToMarkdown(result: AnalyzeResult): string {
  return result.generation.bullets.items
    .map((item) => `- ${item.tailored}`)
    .join("\n");
}

/** 单独导出 Cover Letter 纯文本（可直接粘贴进邮件） */
export function coverLetterToText(result: AnalyzeResult): string {
  const { salutation, body, signOff } = result.generation.coverLetter;
  return `${normalizeNewlines(salutation)}\n\n${normalizeNewlines(
    body,
  )}\n\n${normalizeNewlines(signOff)}`;
}
