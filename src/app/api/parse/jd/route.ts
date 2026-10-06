import { fail, ok, readJsonBody, requireText } from "@/lib/api/http";
import { getModelId, parseJd } from "@/lib/ai/pipeline";
import type { ParseJdResponse } from "@/lib/types";

/**
 * POST /api/parse/jd
 * 入参：{ text: string }
 * 出参：{ jd: JdProfile, meta: {...} }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<{ text?: string }>(req);
    const jdText = requireText(body.text, "职位描述", 30);
    const jd = await parseJd(jdText);

    const payload: ParseJdResponse = {
      jd,
      meta: { charCount: jdText.length, model: getModelId() },
    };

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
