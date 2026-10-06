"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { resultToMarkdown } from "@/lib/markdown";
import type { AnalyzeResult } from "@/lib/types";

interface MarkdownPreviewProps {
  result: AnalyzeResult;
}

/**
 * Markdown 预览：与「复制 Markdown / 下载 .md」共用同一份生成逻辑，
 * 保证预览所见即导出所得。
 */
export function MarkdownPreview({ result }: MarkdownPreviewProps) {
  const markdown = React.useMemo(() => resultToMarkdown(result), [result]);

  return (
    // no-print：预览属于屏幕交互；打印/导出 PDF 由 ResultView 里的 print-only 区块承担，
    // 避免停在导出页签时把同一份内容打印两遍
    <div className="no-print rounded-lg border bg-card p-6">
      <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:text-xl prose-h2:mt-6 prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-1 prose-table:text-xs prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
