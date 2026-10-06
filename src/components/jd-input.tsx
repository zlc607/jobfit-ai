"use client";

import { Eraser, FileText, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface JdInputProps {
  value: string;
  onChange: (value: string) => void;
  onUseSample: () => void;
  disabled?: boolean;
}

/** 首页左侧：职位描述粘贴区 */
export function JdInput({
  value,
  onChange,
  onUseSample,
  disabled,
}: JdInputProps) {
  const charCount = value.trim().length;
  const ready = charCount >= 30;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="jd-input" className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          职位描述（JD）
        </Label>

        <div className="flex items-center gap-2">
          <Badge variant={ready ? "strong" : "secondary"}>
            {charCount} 字
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUseSample}
            disabled={disabled}
            title="填入示例 JD，方便快速体验"
          >
            <Wand2 />
            示例
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={disabled || charCount === 0}
          >
            <Eraser />
            清空
          </Button>
        </div>
      </div>

      <Textarea
        id="jd-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={`把招聘网站上的职位描述整段粘贴到这里，包含岗位职责与任职要求。\n\n例如：\n高级前端工程师\n岗位职责：1. 负责核心业务 Web 端架构设计…\n任职要求：1. 熟练掌握 TypeScript…`}
        className="min-h-[260px] flex-1 resize-y leading-relaxed lg:min-h-[380px]"
        spellCheck={false}
      />

      <p className="text-xs text-muted-foreground">
        {ready
          ? "JD 长度足够，可以开始分析。"
          : "至少需要 30 个字；建议粘贴含「任职要求」的完整 JD，评分更准。"}
      </p>
    </div>
  );
}
