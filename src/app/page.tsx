"use client";

import * as React from "react";
import {
  ArrowRight,
  Loader2,
  Lock,
  Play,
  Shapes,
  Sparkles,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { JdInput } from "@/components/jd-input";
import { ResumeInput, type ResumeMode } from "@/components/resume-input";
import { ResultView } from "@/components/result-view";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAnalyze } from "@/hooks/use-analyze";
import { useHistory } from "@/hooks/use-history";
import { SAMPLE_JD, SAMPLE_RESUME } from "@/lib/sample-data";
import { HISTORY_LIMIT } from "@/lib/types";

/**
 * 首页：左 JD / 右简历 -> 一键分析 -> 结果展示。
 * 历史记录在分析成功后自动写入浏览器 localStorage（可在 /history 管理）。
 */
export default function HomePage() {
  const [jdText, setJdText] = React.useState("");
  const [resumeMode, setResumeMode] = React.useState<ResumeMode>("file");
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);
  const [resumeText, setResumeText] = React.useState("");

  const resultRef = React.useRef<HTMLDivElement>(null);
  const { items, save } = useHistory();

  const {
    stage,
    message,
    elapsed,
    result,
    error,
    errorCode,
    isRunning,
    analyze,
    cancel,
  } = useAnalyze();

  const jdReady = jdText.trim().length >= 30;
  const resumeReady =
    resumeMode === "file"
      ? Boolean(resumeFile)
      : resumeText.trim().length >= 30;
  const canAnalyze = jdReady && resumeReady && !isRunning;

  /** 填充示例数据，方便快速体验与录屏 */
  const fillSample = () => {
    setJdText(SAMPLE_JD);
    setResumeText(SAMPLE_RESUME);
    setResumeMode("text");
    setResumeFile(null);
    toast.success("已填入示例 JD 与简历");
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    const payload = {
      jdText: jdText.trim(),
      resumeText: resumeMode === "text" ? resumeText.trim() : "",
      resumeFile: resumeMode === "file" ? resumeFile : null,
      resumeFileName: resumeFile?.name,
      resumeSource: resumeMode,
    };

    const analyzed = await analyze(payload);

    if (analyzed) {
      // save 内部会在配额不足时给出警告；这里只在确实写入成功时报告成功
      const written = save(analyzed);
      if (written.length > 0) {
        toast.success("分析完成，已存入历史记录");
      }
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    }
  };

  /** 错误码 -> 可执行建议 */
  const errorHint = (() => {
    switch (errorCode) {
      case "MISSING_API_KEY":
        return "请在项目根目录创建 .env.local，填入 OPENAI_API_KEY（以及可选的 OPENAI_BASE_URL / MODEL），然后重启 npm run dev。";
      case "MODEL_FAILED":
        return "模型接口调用失败：请确认 OPENAI_BASE_URL 可访问、MODEL 名称正确，且该模型支持 JSON 输出。";
      case "UNSUPPORTED_FILE":
        return "仅支持 PDF / DOCX / TXT / MD，单文件不超过 5MB。扫描件请改用「粘贴文本」。";
      case "EMPTY_INPUT":
        return "请补充足够的内容：JD 与简历各至少 30 个字。";
      default:
        return "可以稍后重试；若持续失败，请查看服务端终端日志。";
    }
  })();

  return (
    <div className="container space-y-8 py-8">
      {/* ==================== Hero ==================== */}
      <section className="no-print space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="strong">
            <Sparkles className="mr-1 size-3" />
            开源 · MIT
          </Badge>
          <Badge variant="secondary">
            <Lock className="mr-1 size-3" />
            简历不落库
          </Badge>
          <Badge variant="outline">中文界面 · 支持暗色模式</Badge>
        </div>

        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          把简历，改成这个岗位想要的形状
        </h1>

        <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
          粘贴职位描述、上传简历，拿到{" "}
          <strong className="font-medium text-foreground">匹配评分</strong>、
          <strong className="font-medium text-foreground">差距分析</strong>（结论均标注来源）、
          <strong className="font-medium text-foreground">XYZ 定制 Bullet</strong>、
          <strong className="font-medium text-foreground">Cover Letter</strong>、
          <strong className="font-medium text-foreground">10 道面试预测题</strong>，
          一键导出 Markdown 或打印为 PDF。
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fillSample}
          disabled={isRunning}
        >
          <Play />
          填入示例，直接体验
        </Button>
      </section>

      {/* ==================== 输入区 ==================== */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">第一步 · 职位描述</CardTitle>
            <CardDescription>
              从招聘网站复制整段 JD，包含岗位职责与任职要求。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <JdInput
              value={jdText}
              onChange={setJdText}
              onUseSample={() => setJdText(SAMPLE_JD)}
              disabled={isRunning}
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">第二步 · 你的简历</CardTitle>
            <CardDescription>
              上传 PDF / DOCX / TXT，或直接粘贴文本；解析后不保留原始文件。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ResumeInput
              mode={resumeMode}
              onModeChange={setResumeMode}
              file={resumeFile}
              onFileChange={setResumeFile}
              text={resumeText}
              onTextChange={setResumeText}
              onUseSample={() => {
                setResumeText(SAMPLE_RESUME);
                setResumeMode("text");
              }}
              disabled={isRunning}
            />
          </CardContent>
        </Card>
      </section>

      {/* ==================== 操作区 ==================== */}
      <section className="no-print space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="button"
            size="lg"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="min-w-[200px]"
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin" />
                分析中…
              </>
            ) : (
              <>
                开始分析
                <ArrowRight />
              </>
            )}
          </Button>

          {isRunning ? (
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              <X />
              取消
            </Button>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className={jdReady ? "text-gap-strong" : undefined}>
              {jdReady ? "✓" : "○"} JD {jdText.trim().length} 字
            </span>
            <span className={resumeReady ? "text-gap-strong" : undefined}>
              {resumeReady ? "✓" : "○"} 简历
              {resumeMode === "file"
                ? resumeFile
                  ? ` ${resumeFile.name}`
                  : " 未选择文件"
                : ` ${resumeText.trim().length} 字`}
            </span>
            {!canAnalyze && !isRunning ? (
              <span>
                还需要：{!jdReady ? "JD " : ""}
                {!jdReady && !resumeReady ? "与 " : ""}
                {!resumeReady ? "简历" : ""}
              </span>
            ) : null}
          </div>
        </div>

        {/* 加载状态 */}
        {isRunning ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-sm font-medium">{message}</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="size-3" />
                  已用 {elapsed} 秒
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                完整分析通常需要 20-60 秒（取决于模型速度）。整份简历只在本次请求内使用，
                不会写入服务端数据库。
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* 错误提示 */}
        {stage === "error" && error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>分析失败</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>{error}</p>
              <p className="text-xs opacity-90">{errorHint}</p>
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* ==================== 结果区 ==================== */}
      <section ref={resultRef} className="scroll-mt-20">
        {result ? (
          <div className="fade-in-up space-y-4">
            <div className="no-print flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Shapes className="size-4 text-primary" />
                分析结果
              </h2>
              <p className="text-xs text-muted-foreground">
                已自动保存到历史记录（最近 {items.length}/{HISTORY_LIMIT}{" "}
                次），可在「历史记录」中删除。
              </p>
            </div>
            <ResultView result={result} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
