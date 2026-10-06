"use client";

import { Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { coverLetterToText } from "@/lib/markdown";
import type { AnalyzeResult } from "@/lib/types";
import { normalizeNewlines } from "@/lib/utils";

interface CoverLetterViewProps {
  result: AnalyzeResult;
}

/** Cover Letter：中文 300 字以内，可直接粘贴进邮件 */
export function CoverLetterView({ result }: CoverLetterViewProps) {
  const letter = result.generation.coverLetter;
  const plainText = coverLetterToText(result);
  const overLimit = letter.wordCount > 300;

  return (
    <Card className="print-break-avoid">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-primary" />
              Cover Letter
              <Badge variant={overLimit ? "weak" : "strong"}>
                {letter.wordCount} 字
              </Badge>
            </CardTitle>
            <CardDescription>
              目标岗位：{result.jd.title}
              {result.jd.company ? ` · ${result.jd.company}` : ""}
            </CardDescription>
          </div>
          <CopyButton
            value={plainText}
            label="复制全文"
            successMessage="已复制 Cover Letter"
            className="no-print"
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm font-medium">
            {normalizeNewlines(letter.salutation)}
          </p>
          <div className="mt-4 space-y-3 text-sm leading-7">
            {normalizeNewlines(letter.body)
              .split(/\n+/)
              .filter((paragraph) => paragraph.trim())
              .map((paragraph, index) => (
                <p key={index}>{paragraph.trim()}</p>
              ))}
          </div>
          <p className="mt-6 whitespace-pre-line text-sm leading-7">
            {normalizeNewlines(letter.signOff)}
          </p>
        </div>

        {overLimit ? (
          <p className="mt-3 text-xs text-gap-weak">
            正文超过 300 字，建议手动精简后再投递。
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            提示：把 [姓名] 替换为你的真实姓名与联系方式后再发送。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
