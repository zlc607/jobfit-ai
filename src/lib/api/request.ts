import { BadRequestError, isFileLike } from "@/lib/api/http";
import { extractTextFromFile } from "@/lib/parsing/extract-text";

/**
 * 请求输入解析：
 * 前端可能用 multipart（带文件）也可能用 JSON（纯文本），这里统一成内部结构。
 */

export interface ResumeInput {
  resumeText: string;
  resumeFileName?: string;
  resumeSource: "file" | "text";
}

export interface AnalyzeInput extends ResumeInput {
  jdText: string;
}

function isMultipart(req: Request): boolean {
  return (req.headers.get("content-type") ?? "").includes(
    "multipart/form-data",
  );
}

/**
 * 解析简历输入：
 * - multipart 且带 file 字段 -> 提取文件文本（PDF/DOCX/TXT/MD）
 * - multipart 且带 text 字段 -> 直接用粘贴文本
 * - JSON -> { text, fileName? }
 */
export async function readResumeInput(req: Request): Promise<ResumeInput> {
  if (isMultipart(req)) {
    const form = await req.formData();
    const file = form.get("file");
    const text = form.get("text");

    if (isFileLike(file)) {
      const extracted = await extractTextFromFile(file);
      return {
        resumeText: extracted.text,
        resumeFileName: extracted.fileName,
        resumeSource: "file",
      };
    }

    if (typeof text === "string" && text.trim()) {
      return { resumeText: text.trim(), resumeSource: "text" };
    }

    throw new BadRequestError(
      "请上传简历文件或粘贴简历文本",
      "EMPTY_INPUT",
    );
  }

  const body = await req.json().catch(() => null);
  const text = (body as { text?: unknown } | null)?.text;
  const fileName = (body as { fileName?: unknown } | null)?.fileName;

  if (typeof text !== "string" || !text.trim()) {
    throw new BadRequestError("text 字段不能为空", "EMPTY_INPUT");
  }

  return {
    resumeText: text.trim(),
    resumeFileName: typeof fileName === "string" ? fileName : undefined,
    resumeSource: "text",
  };
}

/** 解析「JD + 简历」组合输入（供 /api/analyze 使用） */
export async function readAnalyzeInput(req: Request): Promise<AnalyzeInput> {
  if (isMultipart(req)) {
    const form = await req.formData();
    const jd = form.get("jd");
    const text = form.get("resumeText");
    const file = form.get("resumeFile");

    if (typeof jd !== "string" || !jd.trim()) {
      throw new BadRequestError("请粘贴职位描述（JD）", "EMPTY_INPUT");
    }

    if (isFileLike(file)) {
      const extracted = await extractTextFromFile(file);
      return {
        jdText: jd.trim(),
        resumeText: extracted.text,
        resumeFileName: extracted.fileName,
        resumeSource: "file",
      };
    }

    if (typeof text === "string" && text.trim()) {
      return {
        jdText: jd.trim(),
        resumeText: text.trim(),
        resumeSource: "text",
      };
    }

    throw new BadRequestError("请上传简历文件或粘贴简历文本", "EMPTY_INPUT");
  }

  const body = await req.json().catch(() => null);
  const jdText = (body as { jd?: unknown } | null)?.jd;
  const resumeText = (body as { resume?: unknown } | null)?.resume;

  if (typeof jdText !== "string" || !jdText.trim()) {
    throw new BadRequestError("jd 字段不能为空", "EMPTY_INPUT");
  }
  if (typeof resumeText !== "string" || !resumeText.trim()) {
    throw new BadRequestError("resume 字段不能为空", "EMPTY_INPUT");
  }

  return {
    jdText: jdText.trim(),
    resumeText: resumeText.trim(),
    resumeSource: "text",
  };
}
