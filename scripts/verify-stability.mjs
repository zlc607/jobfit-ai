#!/usr/bin/env node
/**
 * 评分稳定性验证脚本（零依赖，需要 Node 18+ 的内置 fetch）。
 *
 * 对同一份 JD + 简历连续跑 N 次完整分析，记录：
 *   - 每次的 totalScore 与四个维度分；
 *   - strongMatches / weakMatches 的条目文本；
 *   - 生成的 bullet 及其 original 溯源字段。
 * 最后算出总分极差与逐维极差，判断是否落在目标（< 5 分）内。
 *
 * 用法：
 *   1) 另开一个终端启动服务：npm run dev
 *   2) node scripts/verify-stability.mjs            # 默认 3 次，走 http://127.0.0.1:3000
 *      node scripts/verify-stability.mjs 5          # 跑 5 次
 *      node scripts/verify-stability.mjs 3 --url http://127.0.0.1:3001
 *
 * 结果会写到 exports/verify-stability-<时间戳>.json，便于存档与对比。
 * 输入固定取自 src/lib/sample-data.ts，保证多次运行用的是同一份素材。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const args = process.argv.slice(2);
const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 3);
const urlFlagIndex = args.indexOf("--url");
const BASE_URL =
  (urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : undefined) ??
  process.env.JOBFIT_URL ??
  "http://127.0.0.1:3000";

/** 从 sample-data.ts 里取出示例 JD 与简历，避免在两处维护同一份素材 */
function loadSample() {
  const source = readFileSync(resolve(ROOT, "src/lib/sample-data.ts"), "utf8");
  const pick = (name) => {
    const match = source.match(
      new RegExp(`export const ${name} = \`([\\s\\S]*?)\`;`),
    );
    if (!match) throw new Error(`sample-data.ts 里找不到 ${name}`);
    return match[1];
  };
  return { jd: pick("SAMPLE_JD"), resume: pick("SAMPLE_RESUME") };
}

async function analyzeOnce(jd, resume, index) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd, resume }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`第 ${index} 次失败（HTTP ${res.status}）：${text.slice(0, 500)}`);
  }

  const payload = JSON.parse(text);
  const { match, generation, model } = payload.result;
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `  第 ${index} 次：totalScore=${match.totalScore}  维度=[${match.dimensions
      .map((d) => `${d.label}:${d.score}`)
      .join(" ")}]  用时=${elapsed}s  模型=${model}`,
  );

  return {
    index,
    elapsedSeconds: Number(elapsed),
    model,
    totalScore: match.totalScore,
    dimensions: match.dimensions.map((d) => ({
      key: d.key,
      label: d.label,
      score: d.score,
      weight: d.weight,
      rationale: d.rationale,
      evidence: d.evidence.map((e) => `${e.source}:${e.quote}`),
      gap: d.gap ?? [],
    })),
    strongMatches: match.strongMatches.map((m) => m.point),
    weakMatches: match.weakMatches.map((m) => `${m.point}｜${m.reason}`),
    missingSkills: match.missingSkills.map((m) => `${m.skill}(${m.severity})`),
    bullets: generation.bullets.items.map((b) => ({
      original: b.original,
      tailored: b.tailored,
    })),
  };
}

function spread(values) {
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
}

/** 用简历原文校验 bullet 的溯源：original 必须在原文里逐字出现 */
function checkTraceability(bullets, resumeText) {
  const flat = resumeText.replace(/\s+/g, " ").trim();
  return bullets.map((b) => {
    const parts = b.original.split(" / ").map((p) => p.replace(/\s+/g, " ").trim());
    const missing = parts.filter((p) => p && !flat.includes(p));
    return {
      original: b.original,
      tailored: b.tailored,
      traceable: missing.length === 0,
      untraceableParts: missing,
    };
  });
}

async function main() {
  const { jd, resume } = loadSample();

  console.log(`目标服务：${BASE_URL}`);
  console.log(`运行次数：${runs}\n`);

  const records = [];
  for (let i = 1; i <= runs; i += 1) {
    records.push(await analyzeOnce(jd, resume, i));
  }

  const totals = records.map((r) => r.totalScore);
  const dimensionKeys = records[0].dimensions.map((d) => d.key);

  const dimensionSpread = dimensionKeys.map((key) => ({
    key,
    label: records[0].dimensions.find((d) => d.key === key).label,
    scores: records.map((r) => r.dimensions.find((d) => d.key === key).score),
    spread: spread(
      records.map((r) => r.dimensions.find((d) => d.key === key).score),
    ),
  }));

  const totalsSpread = spread(totals);
  const sameStrongMatches =
    new Set(records.map((r) => JSON.stringify(r.strongMatches))).size === 1;

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runs,
    model: records[0].model,
    totals,
    totalSpread: totalsSpread,
    dimensionSpread,
    sameStrongMatches,
    records,
    traceability: checkTraceability(records[0].bullets, resume),
  };

  mkdirSync(resolve(ROOT, "exports"), { recursive: true });
  const outFile = resolve(
    ROOT,
    `exports/verify-stability-${Date.now()}.json`,
  );
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== 汇总 ===");
  console.log(`总分：${totals.join(" / ")}   极差 = ${totalsSpread}`);
  for (const d of dimensionSpread) {
    console.log(`  ${d.label}：${d.scores.join(" / ")}   极差 = ${d.spread}`);
  }
  console.log(`strongMatches 三次完全一致：${sameStrongMatches ? "是" : "否"}`);
  console.log(
    `bullet 溯源：${report.traceability.filter((t) => t.traceable).length}/${
      report.traceability.length
    } 条 original 可在简历原文中逐字命中`,
  );
  const untraceable = report.traceability.filter((t) => !t.traceable);
  if (untraceable.length) {
    console.log("\n未能逐字命中的 original（需要人工确认是否被改写）：");
    for (const t of untraceable) {
      console.log(`  - ${t.original}`);
    }
  }
  console.log(`\n完整记录已写入：${outFile}`);
  console.log(`目标：总分极差 < 5 分 → ${totalsSpread < 5 ? "达标" : "未达标"}`);
}

main().catch((error) => {
  console.error(`\n验证失败：${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
