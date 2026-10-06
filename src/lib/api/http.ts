import { NextResponse } from "next/server";

import { ModelCallError } from "@/lib/ai/pipeline";
import { MissingApiKeyError } from "@/lib/ai/provider";
import { ExtractError } from "@/lib/parsing/extract-text";
import type { ApiError } from "@/lib/types";

/**
 * HTTP 层统一工具：错误映射 + JSON 报文。
 * 目标：所有路由的失败响应形状一致，前端只需处理 ApiError。
 */

type ApiErrorCode = NonNullable<ApiError["code"]>;

/** 请求参数不合法（缺字段、空文本等） */
export class BadRequestError extends Error {
  code: ApiErrorCode;

  constructor(message: string, code: ApiErrorCode = "BAD_REQUEST") {
    super(message);
    this.name = "BadRequestError";
    this.code = code;
  }
}

/** 成功响应 */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

/** 把任意异常映射为标准 ApiError 响应 */
export function fail(error: unknown) {
  if (error instanceof MissingApiKeyError) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: "MISSING_API_KEY" },
      { status: 400 },
    );
  }

  if (error instanceof ExtractError) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }

  if (error instanceof BadRequestError) {
    return NextResponse.json<ApiError>(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }

  if (error instanceof ModelCallError) {
    // 502：上游模型服务的问题，不是调用方的问题
    return NextResponse.json<ApiError>(
      { error: error.message, code: "MODEL_FAILED" },
      { status: 502 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json<ApiError>(
      { error: "请求体不是合法 JSON", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  // 兜底：打日志便于排查，对外不暴露堆栈
  console.error("[jobfit] 未处理异常:", error);
  return NextResponse.json<ApiError>(
    {
      error: "服务端处理失败，请稍后重试；若持续失败请查看服务端日志。",
      code: "UNKNOWN",
    },
    { status: 500 },
  );
}

/** 读取 JSON 请求体，非法时抛 BadRequestError */
export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequestError("请求体不是合法 JSON");
  }
}

/** 校验文本字段非空 */
export function requireText(
  value: unknown,
  fieldName: string,
  minLength = 20,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`${fieldName} 不能为空`, "EMPTY_INPUT");
  }
  if (value.trim().length < minLength) {
    throw new BadRequestError(
      `${fieldName} 太短（至少 ${minLength} 字），无法进行有效分析`,
      "EMPTY_INPUT",
    );
  }
  return value.trim();
}

/**
 * 判断 FormData 中的值是否为文件。
 * 不用 `instanceof File`：不同运行时的 File 实现可能不一致。
 */
export function isFileLike(value: unknown): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as File;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.arrayBuffer === "function" &&
    candidate.size > 0
  );
}
