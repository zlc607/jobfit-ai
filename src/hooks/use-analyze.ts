"use client";

import * as React from "react";

import type {
  AnalyzeResult,
  ApiError,
  GenerationResult,
  JdProfile,
  MatchReport,
  ResumeProfile,
} from "@/lib/types";
import { shortId } from "@/lib/utils";

/**
 * 分析流程状态机。
 *
 * 为什么前端分 4 步调用而不是直接用 /api/analyze？
 * 1) 进度是真实的：每一步的状态、耗时、失败点都可观测；
 * 2) 解析结果可复用：调整 JD 后不必重新解析简历；
 * 3) 单独一步失败时不必整体重跑，省 token 也省等待。
 * （/api/analyze 作为一次性编排接口保留给 API 调用方。）
 */

export type AnalyzeStage =
  | "idle"
  | "parsing"
  | "matching"
  | "generating"
  | "done"
  | "error";

export interface AnalyzeState {
  stage: AnalyzeStage;
  /** 当前阶段的中文提示 */
  message: string;
  /** 已耗时（秒），用于给用户预期 */
  elapsed: number;
  result: AnalyzeResult | null;
  error: string | null;
  errorCode: ApiError["code"] | null;
}

const INITIAL_STATE: AnalyzeState = {
  stage: "idle",
  message: "",
  elapsed: 0,
  result: null,
  error: null,
  errorCode: null,
};

export interface AnalyzeParams {
  jdText: string;
  resumeText: string;
  /** 可选的文件（走 multipart 上传，由服务端提取文本） */
  resumeFile?: File | null;
  resumeFileName?: string;
  resumeSource: "file" | "text";
}

/**
 * 统一解析响应。
 * 兼容网关/反代异常时可能返回 HTML 或空体，因此先看 Content-Type，
 * 否则会把"上游 502 HTML"误报成"服务端返回了空响应"，用户无从排查。
 */
async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? ((await res.json().catch(() => null)) as
        | (T & Partial<ApiError>)
        | null)
    : null;

  if (!res.ok) {
    const message =
      payload?.error ??
      (isJson
        ? `请求失败（HTTP ${res.status}）`
        : `服务端返回了非 JSON 响应（HTTP ${res.status}），通常是网关异常或请求体过大`);
    const error = new Error(message) as Error & { code?: ApiError["code"] };
    error.code =
      payload?.code ??
      (res.status === 502 || res.status === 504 ? "MODEL_FAILED" : "UNKNOWN");
    throw error;
  }

  if (!payload) {
    throw new Error("服务端返回了空响应或非 JSON 格式");
  }

  return payload as T;
}

export function useAnalyze() {
  const [state, setState] = React.useState<AnalyzeState>(INITIAL_STATE);
  const [isRunning, setIsRunning] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  const timerRef = React.useRef<number | null>(null);
  /** 同步防重入：setState 是异步的，不能靠闭包里的 isRunning 判断 */
  const runningRef = React.useRef(false);
  /** 请求令牌：取消或重开后，旧请求的所有状态写入全部失效 */
  const requestIdRef = React.useRef(0);

  // 计时器：让用户看到"已经跑了多久"，而不是干等
  const startTimer = React.useCallback((reqId: number) => {
    // 自清理：避免任何路径下出现两个并行的 interval
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      setState((prev) =>
        prev.stage === "idle" || prev.stage === "done" || prev.stage === "error"
          ? prev
          : {
              ...prev,
              elapsed:
                reqId === requestIdRef.current
                  ? Math.round((Date.now() - started) / 1000)
                  : prev.elapsed,
            },
      );
    }, 1000);
  }, []);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      stopTimer();
      abortRef.current?.abort();
    },
    [stopTimer],
  );

  const cancel = React.useCallback(() => {
    // 令牌自增：旧请求后续的 setState 全部被 isCurrent 拦掉
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    stopTimer();
    setIsRunning(false);
    setState((prev) => ({
      ...prev,
      stage: "idle",
      message: "",
      elapsed: 0,
    }));
  }, [stopTimer]);

  const reset = React.useCallback(() => {
    requestIdRef.current += 1;
    runningRef.current = false;
    stopTimer();
    setState(INITIAL_STATE);
  }, [stopTimer]);

  const analyze = React.useCallback(
    async (params: AnalyzeParams): Promise<AnalyzeResult | null> => {
      if (runningRef.current) return null;

      const reqId = requestIdRef.current + 1;
      requestIdRef.current = reqId;
      runningRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsRunning(true);
      setState({
        stage: "parsing",
        message: "正在解析职位描述与简历…",
        elapsed: 0,
        result: null,
        error: null,
        errorCode: null,
      });
      startTimer(reqId);

      const signal = controller.signal;
      const isCurrent = () => reqId === requestIdRef.current;

      /** 只在请求仍然有效时更新阶段状态 */
      const patch = (partial: Partial<AnalyzeState>) => {
        if (!isCurrent()) return;
        setState((prev) => ({ ...prev, ...partial }));
      };

      const finish = () => {
        if (!isCurrent()) return;
        stopTimer();
        runningRef.current = false;
        setIsRunning(false);
        abortRef.current = null;
      };

      try {
        // ---------- 1) 解析：JD 与简历并行 ----------
        const jdRequest = fetch("/api/parse/jd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: params.jdText }),
          signal,
        }).then((res) =>
          parseResponse<{ jd: JdProfile; meta: { model: string } }>(res),
        );

        const resumeRequest = params.resumeFile
          ? (() => {
              const form = new FormData();
              form.append("file", params.resumeFile as File);
              return fetch("/api/parse/resume", {
                method: "POST",
                body: form,
                signal,
              }).then((res) =>
                parseResponse<{
                  resume: ResumeProfile;
                  meta: { text: string };
                }>(res),
              );
            })()
          : fetch("/api/parse/resume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: params.resumeText,
                fileName: params.resumeFileName,
              }),
              signal,
            }).then((res) =>
              parseResponse<{ resume: ResumeProfile; meta: { text: string } }>(
                res,
              ),
            );

        const [jdPayload, resumePayload] = await Promise.all([
          jdRequest,
          resumeRequest,
        ]);

        if (!isCurrent()) return null;

        const jd = jdPayload.jd;
        const resume = resumePayload.resume;
        // 文件模式下前端本地没有文本，用服务端提取的原文供后续步骤摘录证据
        const resumeSourceText = resumePayload.meta?.text || params.resumeText;

        // ---------- 2) 匹配分析 ----------
        patch({
          stage: "matching",
          message: "正在做匹配评分与差距分析…",
        });

        const matchPayload = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume,
            jd,
            resumeText: resumeSourceText,
            jdText: params.jdText,
          }),
          signal,
        }).then((res) => parseResponse<{ match: MatchReport }>(res));

        if (!isCurrent()) return null;
        const match = matchPayload.match;

        // ---------- 3) 生成定制内容 ----------
        patch({
          stage: "generating",
          message: "正在生成定制 bullet、Cover Letter 与面试题…",
        });

        const genPayload = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume,
            jd,
            match,
            resumeText: resumeSourceText,
          }),
          signal,
        }).then((res) => parseResponse<{ generation: GenerationResult }>(res));

        if (!isCurrent()) return null;

        const result: AnalyzeResult = {
          id: shortId("an_"),
          createdAt: Date.now(),
          title: `${jd.title || "未命名岗位"}${
            jd.company ? ` @ ${jd.company}` : ""
          }`,
          resumeSource: params.resumeSource,
          resumeFileName: params.resumeFileName,
          resume,
          jd,
          match,
          generation: genPayload.generation,
          // 模型名由服务端返回，历史记录据此可复现
          model: jdPayload.meta?.model ?? "unknown",
        };

        finish();
        setState({
          stage: "done",
          message: "分析完成",
          elapsed: 0,
          result,
          error: null,
          errorCode: null,
        });

        return result;
      } catch (error) {
        // 已取消或已被新请求取代：不写任何状态，避免污染新请求的进度
        if (!isCurrent()) return null;

        finish();

        if (error instanceof DOMException && error.name === "AbortError") {
          setState((prev) => ({ ...prev, stage: "idle", message: "" }));
          return null;
        }

        const message =
          error instanceof Error ? error.message : "分析失败，请稍后重试";
        const code = (error as { code?: ApiError["code"] })?.code ?? "UNKNOWN";

        setState({
          stage: "error",
          message: "",
          elapsed: 0,
          result: null,
          error: message,
          errorCode: code,
        });
        return null;
      }
    },
    [startTimer, stopTimer],
  );

  return { ...state, isRunning, analyze, cancel, reset };
}
