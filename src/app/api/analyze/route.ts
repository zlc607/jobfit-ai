import { fail, ok, requireText } from "@/lib/api/http";
import { readAnalyzeInput } from "@/lib/api/request";
import {
  generateAssets,
  getModelId,
  matchResumeToJd,
  parseJd,
  parseResume,
} from "@/lib/ai/pipeline";
import { shortId } from "@/lib/utils";
import type { AnalyzeResponse, AnalyzeResult } from "@/lib/types";

/**
 * POST /api/analyze —— 一步到位的编排接口（首页「开始分析」调用它）
 * 入参（二选一）：
 *   - multipart/form-data：jd=<JD文本>&resumeFile=<文件> 或 jd=<JD文本>&resumeText=<简历文本>
 *   - application/json：{ jd: string, resume: string }
 * 出参：{ result: AnalyzeResult }
 *
 * 流程：解析简历 + 解析 JD（并行） -> 匹配分析 -> 生成三件套（并行）。
 * 全部在内存中完成，不落盘、不写库。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { jdText, resumeText, resumeFileName, resumeSource } =
      await readAnalyzeInput(req);

    requireText(jdText, "职位描述", 30);
    requireText(resumeText, "简历内容", 30);

    // 1) 两份画像并行解析，省一次往返时间
    const [resume, jd] = await Promise.all([
      parseResume(resumeText),
      parseJd(jdText),
    ]);

    // 2) 匹配分析（内含本地确定性加权）
    const match = await matchResumeToJd(resume, jd, {
      resumeText,
      jdText,
    });

    // 3) 生成定制内容
    const generation = await generateAssets(resume, jd, match, { resumeText });

    const result: AnalyzeResult = {
      id: shortId("an_"),
      createdAt: Date.now(),
      title: `${jd.title || "未命名岗位"}${jd.company ? ` @ ${jd.company}` : ""}`,
      resumeSource,
      resumeFileName,
      resume,
      jd,
      match,
      generation,
      model: getModelId(),
    };

    return ok<AnalyzeResponse>({ result });
  } catch (error) {
    return fail(error);
  }
}
