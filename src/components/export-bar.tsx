"use client";

import * as React from "react";
import { Download, Printer, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { resultToMarkdown } from "@/lib/markdown";
import type { AnalyzeResult } from "@/lib/types";

interface ExportBarProps {
  result: AnalyzeResult;
  onSave?: () => void;
  saved?: boolean;
}

/** 导出工具栏：复制 Markdown / 下载 .md / 打印为 PDF / 保存到历史 */
export function ExportBar({ result, onSave, saved }: ExportBarProps) {
  const [saving, setSaving] = React.useState(false);

  const markdown = React.useMemo(() => resultToMarkdown(result), [result]);

  /** 触发浏览器打印对话框（在对话框中选「另存为 PDF」） */
  const handlePrint = () => {
    toast.info("已打开打印面板，目标选择「另存为 PDF」即可导出");
    // 让 toast 先渲染，避免同步阻塞导致打印面板卡住
    window.setTimeout(() => window.print(), 120);
  };

  /** 下载 Markdown 文件到本地 */
  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = result.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
    link.href = url;
    link.download = `JobFit-${safeTitle}-${new Date(result.createdAt)
      .toISOString()
      .slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("已下载 Markdown 文件");
  };

  const handleSave = () => {
    if (!onSave) return;
    setSaving(true);
    onSave();
    window.setTimeout(() => setSaving(false), 400);
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <CopyButton
        value={markdown}
        label="复制 Markdown"
        successMessage="已复制完整报告（Markdown）"
      />

      <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
        <Download />
        下载 .md
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
        <Printer />
        打印 / 导出 PDF
      </Button>

      {onSave ? (
        <Button
          type="button"
          variant={saved ? "secondary" : "default"}
          size="sm"
          onClick={handleSave}
          disabled={saving || saved}
        >
          <Save />
          {saved ? "已保存到历史" : "保存到历史"}
        </Button>
      ) : null}
    </div>
  );
}
