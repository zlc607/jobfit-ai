"use client";

import * as React from "react";
import { MessageCircleQuestion } from "lucide-react";

import { EvidenceList } from "@/components/evidence-list";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyzeResult, QuestionCategory } from "@/lib/types";

interface InterviewQuestionsViewProps {
  result: AnalyzeResult;
}

const CATEGORY_TONE: Record<
  QuestionCategory,
  "strong" | "weak" | "miss" | "secondary"
> = {
  技术: "strong",
  行为: "weak",
  岗位理解: "secondary",
  反向提问: "miss",
};

/** 面试问题预测：技术 + 行为 + 岗位理解 + 反向提问，每题带回答思路与可用素材 */
export function InterviewQuestionsView({
  result,
}: InterviewQuestionsViewProps) {
  const questions = result.generation.interview.questions;
  const containerRef = React.useRef<HTMLDivElement>(null);

  /**
   * 打印为 PDF 时，浏览器不会渲染处于收起状态的 <details> 内容。
   * 这里在 beforeprint 时临时展开，afterprint 后恢复用户原本的折叠状态。
   */
  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const openAll = () => {
      node.querySelectorAll("details").forEach((detail) => {
        if (!detail.open) {
          detail.dataset.wasClosed = "1";
          detail.open = true;
        }
      });
    };

    const restore = () => {
      node.querySelectorAll("details").forEach((detail) => {
        if (detail.dataset.wasClosed) {
          detail.open = false;
          delete detail.dataset.wasClosed;
        }
      });
    };

    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", openAll);
      window.removeEventListener("afterprint", restore);
    };
  }, []);

  return (
    <Card className="print-break-avoid">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestion className="size-4 text-primary" />
          面试问题预测
          <Badge variant="secondary">{questions.length} 题</Badge>
        </CardTitle>
        <CardDescription>
          技术题来自 JD 要求与你经历的交集；行为题针对匹配分析中的弱项与风险。
        </CardDescription>
      </CardHeader>

      <CardContent ref={containerRef} className="space-y-3">
        {questions.map((item, index) => (
          <details
            key={index}
            open
            className="print-break-avoid group rounded-lg border p-3 transition-colors hover:bg-accent/20"
          >
            <summary className="flex cursor-pointer items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={CATEGORY_TONE[item.category] ?? "secondary"}
                    className="text-[10px]"
                  >
                    {item.category}
                  </Badge>
                  <span className="text-sm font-medium leading-relaxed">
                    {item.question}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  考察点：{item.intent}
                </span>
              </span>
            </summary>

            <div className="mt-3 space-y-3 pl-9">
              {item.answerOutline.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium">回答思路</p>
                  <ul className="space-y-1.5">
                    {item.answerOutline.map((point, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <EvidenceList evidence={item.evidence} />

              {item.followUps.length > 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">可能追问：</span>
                  {item.followUps.join("；")}
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
