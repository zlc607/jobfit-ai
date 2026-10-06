"use client";

import * as React from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Eraser,
  FileCheck2,
  FileText,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ResumeMode = "file" | "text";

interface ResumeInputProps {
  mode: ResumeMode;
  onModeChange: (mode: ResumeMode) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  text: string;
  onTextChange: (text: string) => void;
  onUseSample: () => void;
  disabled?: boolean;
}

const MAX_SIZE = 5 * 1024 * 1024;

/** 首页右侧：上传简历文件或粘贴简历文本 */
export function ResumeInput({
  mode,
  onModeChange,
  file,
  onFileChange,
  text,
  onTextChange,
  onUseSample,
  disabled,
}: ResumeInputProps) {
  const [localError, setLocalError] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setLocalError(null);

      if (rejections.length > 0) {
        const reason = rejections[0]?.errors?.[0]?.message;
        setLocalError(reason ? `文件被拒绝：${reason}` : "文件被拒绝");
        return;
      }
      if (accepted[0]) {
        onFileChange(accepted[0]);
        onModeChange("file");
      }
    },
    [onFileChange, onModeChange],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: MAX_SIZE,
    multiple: false,
    noClick: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt", ".md"],
      // 部分浏览器把 .md 识别为 text/markdown，两个 MIME 都放行
      "text/markdown": [".md"],
    },
  });

  const textCount = text.trim().length;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          简历
        </Label>

        <div className="flex items-center gap-2">
          <Tabs
            value={mode}
            onValueChange={(v) => onModeChange(v as ResumeMode)}
          >
            <TabsList className="h-8">
              <TabsTrigger value="file" disabled={disabled} className="text-xs">
                上传文件
              </TabsTrigger>
              <TabsTrigger value="text" disabled={disabled} className="text-xs">
                粘贴文本
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "text" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onUseSample}
                disabled={disabled}
                title="填入示例简历，方便快速体验"
              >
                <Wand2 />
                示例
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onTextChange("")}
                disabled={disabled || textCount === 0}
              >
                <Eraser />
                清空
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {mode === "file" ? (
        <div className="flex flex-1 flex-col gap-3">
          <div
            {...getRootProps()}
            className={cn(
              "flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors lg:min-h-[380px]",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/40",
              disabled && "pointer-events-none opacity-60",
            )}
            onClick={open}
          >
            <input {...getInputProps()} />

            {file ? (
              <>
                <FileCheck2 className="size-10 text-gap-strong" />
                <div className="space-y-1">
                  <p className="break-all font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB · 点击可重新选择
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFileChange(null);
                  }}
                >
                  <X />
                  移除文件
                </Button>
              </>
            ) : (
              <>
                <Upload className="size-10 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">拖拽简历到此处，或点击选择</p>
                  <p className="text-xs text-muted-foreground">
                    支持 PDF / DOCX / TXT / MD，单文件不超过 5MB
                  </p>
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            扫描件或图片型 PDF 无法提取文字，请改用「粘贴文本」。
          </p>
        </div>
      ) : (
        <>
          <Textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            disabled={disabled}
            placeholder={`把简历内容整段粘贴到这里，保留原有的分条描述和数字。\n\n例如：\n张明 | 前端工程师 | 4 年经验\n- 主导商家后台首屏性能优化，LCP 从 3.8s 降到 1.4s…`}
            className="min-h-[240px] flex-1 resize-y leading-relaxed lg:min-h-[380px]"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            <Badge variant={textCount >= 30 ? "strong" : "secondary"}>
              {textCount} 字
            </Badge>
            <span className="ml-2">
              {textCount >= 30
                ? "简历内容已就绪。"
                : "至少需要 30 个字，建议包含工作经历与量化成果。"}
            </span>
          </p>
        </>
      )}

      {localError ? (
        <p className="text-xs text-destructive">{localError}</p>
      ) : null}
    </div>
  );
}
