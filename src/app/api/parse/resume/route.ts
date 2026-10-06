import { fail, ok, requireText } from "@/lib/api/http";
import { readResumeInput } from "@/lib/api/request";
import { parseResume } from "@/lib/ai/pipeline";
import { MAX_INPUT_CHARS } from "@/lib/ai/prompts";
import type { ParseResumeResponse } from "@/lib/types";

/**
 * POST /api/parse/resume
 * 入参（二选一）：
 *   - multipart/form-data：file=<PDF|DOCX|TXT|MD> 或 text=<简历文本>
 *   - application/json：{ text: string, fileName?: string }
 * 出参：{ resume: ResumeProfile, meta: {...} }
 *
 * meta.text 是清洗后的原文，回传给调用方用于后续步骤的证据摘录；
 * 服务端不缓存、不落库，请求结束即释放。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const input = await readResumeInput(req);
    const resumeText = requireText(input.resumeText, "简历内容", 30);
    const resume = await parseResume(resumeText);

    const payload: ParseResumeResponse = {
      resume,
      meta: {
        source: input.resumeSource,
        fileName: input.resumeFileName,
        charCount: resumeText.length,
        text: resumeText.slice(0, MAX_INPUT_CHARS),
      },
    };

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
