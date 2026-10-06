import { z } from "zod";

import { BadRequestError, fail, ok, readJsonBody } from "@/lib/api/http";
import { generateAssets } from "@/lib/ai/pipeline";
import { evidenceSchema, jdSchema, resumeSchema } from "@/lib/ai/schemas";
import type { GenerateResponse } from "@/lib/types";

/**
 * POST /api/generate
 * 入参：{ resume, jd, match, resumeText? }
 * 出参：{ generation: { bullets, coverLetter, interview } }
 *
 * 三块内容并行生成：定制 bullet / Cover Letter / 面试问题。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 入参里的 match 是「已完成本地加权」的报告：
 * 维度上带有 label / weight（模型输出的原始维度没有这两个字段）。
 * 若直接复用模型输出用的 matchSchema，这两个字段会被 Zod 剥掉，
 * 因此这里单独声明一份"成品种类"的校验规则。
 */
const finishedDimensionSchema = z.object({
  key: z.enum([
    "skillCoverage",
    "experienceRelevance",
    "keywordCoverage",
    "educationSeniority",
  ]),
  label: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  rationale: z.string(),
  evidence: z.array(evidenceSchema),
});

const bodySchema = z.object({
  resume: resumeSchema,
  jd: jdSchema,
  match: z.object({
    totalScore: z.number().min(0).max(100),
    dimensions: z.array(finishedDimensionSchema).min(1),
    strongMatches: z.array(
      z.object({
        point: z.string(),
        evidence: z.array(evidenceSchema),
      }),
    ),
    missingSkills: z.array(
      z.object({
        skill: z.string(),
        severity: z.enum(["high", "medium", "low"]),
        suggestion: z.string(),
        evidence: z.array(evidenceSchema),
      }),
    ),
    weakMatches: z.array(
      z.object({
        point: z.string(),
        reason: z.string(),
        evidence: z.array(evidenceSchema),
      }),
    ),
    risks: z.array(
      z.object({
        risk: z.string(),
        why: z.string(),
        mitigation: z.string(),
      }),
    ),
    summary: z.string(),
  }),
  resumeText: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<unknown>(req);
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestError(
        `请求参数不合法：${
          issue?.path.join(".") || "body"
        } ${issue?.message ?? ""}`.trim(),
      );
    }

    const { resume, jd, match, resumeText } = parsed.data;
    const generation = await generateAssets(resume, jd, match, { resumeText });

    return ok<GenerateResponse>({ generation });
  } catch (error) {
    return fail(error);
  }
}
