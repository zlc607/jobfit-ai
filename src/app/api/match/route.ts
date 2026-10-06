import { z } from "zod";

import { BadRequestError, fail, ok, readJsonBody } from "@/lib/api/http";
import { matchResumeToJd } from "@/lib/ai/pipeline";
import { jdSchema, resumeSchema } from "@/lib/ai/schemas";
import type { MatchResponse } from "@/lib/types";

/**
 * POST /api/match
 * 入参：{ resume: ResumeProfile, jd: JdProfile, resumeText?: string, jdText?: string }
 * 出参：{ match: MatchReport }
 *
 * 入参用 Zod 校验，保证前端传来的画像结构可信（也防止绕过解析步骤时结构错乱）。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  resume: resumeSchema,
  jd: jdSchema,
  resumeText: z.string().optional(),
  jdText: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<unknown>(req);
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestError(
        `请求参数不合法：${issue?.path.join(".") || "body"} ${issue?.message ?? ""}`.trim(),
      );
    }

    const { resume, jd, resumeText, jdText } = parsed.data;
    const match = await matchResumeToJd(resume, jd, { resumeText, jdText });

    return ok<MatchResponse>({ match });
  } catch (error) {
    return fail(error);
  }
}
