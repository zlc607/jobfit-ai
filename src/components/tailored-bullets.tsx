"use client";

import { Info, Sparkles, Target } from "lucide-react";

import { EvidenceList } from "@/components/evidence-list";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import type { AnalyzeResult } from "@/lib/types";
import { bulletsToMarkdown } from "@/lib/markdown";

interface TailoredBulletsViewProps {
  result: AnalyzeResult;
}

/** 定制简历 bullet：XYZ 结构，只重组不造假 */
export function TailoredBulletsView({ result }: TailoredBulletsViewProps) {
  const { bullets } = result.generation;
  const markdown = bulletsToMarkdown(result);

  return (
    <div className="space-y-4">
      <Card className="print-break-avoid">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                定制简历 Bullet（XYZ 结构）
                <Badge variant="secondary">{bullets.items.length} 条</Badge>
              </CardTitle>
              <CardDescription>
                通过 X（做法），实现 Y（结果），带来 Z（价值）。可直接替换简历中的对应条目。
              </CardDescription>
            </div>
            <CopyButton
              value={markdown}
              label="复制全部"
              successMessage="已复制全部 bullet"
              className="no-print"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {bullets.items.map((item, index) => (
            <div
              key={index}
              className="print-break-avoid rounded-lg border p-4 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <p className="text-sm font-medium leading-relaxed">
                    {item.tailored}
                  </p>

                  {item.targets.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Target className="size-3 text-muted-foreground" />
                      {item.targets.map((target, i) => (
                        <Badge key={i} variant="strong" className="text-[10px]">
                          {target}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-md bg-muted/40 p-2.5">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        原始表述：
                      </span>
                      {item.original}
                    </p>
                  </div>

                  <EvidenceList evidence={item.evidence} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {bullets.notes.length > 0 ? (
        <Card className="print-break-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="size-4 text-muted-foreground" />
              生成说明
            </CardTitle>
            <CardDescription>
              哪些是语言重组，哪些地方需要你补上真实数据。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {bullets.notes.map((note, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {note}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
