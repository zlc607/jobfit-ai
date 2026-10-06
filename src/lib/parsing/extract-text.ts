import { Buffer } from "node:buffer";

/**
 * 文件文本提取：PDF / DOCX / TXT / MD。
 *
 * 约束：解析全部在服务端内存中完成，写完响应即释放，
 * 不写磁盘、不写数据库（见 README 隐私说明）。
 */

/** 单文件大小上限 5MB（前端 react-dropzone 用同一数值，见 resume-input.tsx） */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export type FileKind = "pdf" | "docx" | "text";

export interface ExtractResult {
  text: string;
  fileName: string;
  kind: FileKind;
  /** 原始文本长度（清理前） */
  rawLength: number;
}

/** 不支持的格式 / 内容为空时抛出，路由层据此返回 4xx */
export class ExtractError extends Error {
  code: "UNSUPPORTED_FILE" | "PARSE_FAILED" | "EMPTY_INPUT";

  constructor(code: ExtractError["code"], message: string) {
    super(message);
    this.name = "ExtractError";
    this.code = code;
  }
}

/** 按扩展名判断文件类型 */
export function detectKind(fileName: string): FileKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text";
  throw new ExtractError(
    "UNSUPPORTED_FILE",
    `不支持的文件类型：${fileName}。请上传 PDF、DOCX、TXT 或 MD 文件，或直接粘贴简历文本。`,
  );
}

/**
 * 文本清洗：
 * - 统一换行、压缩连续空格与空行；
 * - 修复 PDF 常见的行末连字符断词；
 * - 去掉孤立页码行。
 */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")
    .split("\n")
    .filter((line) => !/^\s*\d{1,3}\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // 从 lib 路径导入，绕开 pdf-parse 入口文件的本地测试文件读取逻辑
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
  const parsed = await pdfParse(buffer);
  return parsed.text ?? "";
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

/** 从 Buffer 提取文本（服务端入口） */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ExtractResult> {
  const kind = detectKind(fileName);

  let raw: string;
  try {
    if (kind === "pdf") raw = await extractPdf(buffer);
    else if (kind === "docx") raw = await extractDocx(buffer);
    else raw = buffer.toString("utf8");
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    throw new ExtractError(
      "PARSE_FAILED",
      `文件解析失败：${fileName}。若是扫描版 PDF（图片型），文本无法提取，请改用粘贴文本。`,
    );
  }

  const rawLength = raw.length;
  const text = normalizeText(raw);

  if (text.length < 30) {
    throw new ExtractError(
      "EMPTY_INPUT",
      "未能从文件中提取到有效文本（可能是扫描件或图片型 PDF），请直接粘贴简历文本。",
    );
  }

  return { text, fileName, kind, rawLength };
}

/** 从 Web File 提取文本（在 route handler 中使用） */
export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ExtractError(
      "UNSUPPORTED_FILE",
      `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请压缩到 5MB 以内。`,
    );
  }
  const arrayBuffer = await file.arrayBuffer();
  return extractTextFromBuffer(Buffer.from(arrayBuffer), file.name);
}
