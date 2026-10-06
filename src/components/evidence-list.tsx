"use client";

import { Quote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Evidence } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EvidenceListProps {
  evidence?: Evidence[];
  className?: string;
}

/**
 * 证据引用渲染：每条结论都必须能点回到原文。
 * 简历来源用中性色标签，JD 来源用主色标签，便于快速区分。
 */
export function EvidenceList({ evidence, className }: EvidenceListProps) {
  if (!evidence?.length) return null;

  return (
    <ul className={cn("space-y-1.5", className)}>
      {evidence.map((item, index) => (
        <li
          key={`${item.source}-${index}`}
          className="flex gap-2 rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground"
        >
          <Quote className="mt-0.5 size-3 shrink-0 opacity-60" />
          <span className="min-w-0">
            <Badge
              variant={item.source === "resume" ? "secondary" : "outline"}
              className="mr-1.5 align-middle text-[10px]"
            >
              {item.source === "resume" ? "简历" : "JD"}
            </Badge>
            {item.quote}
          </span>
        </li>
      ))}
    </ul>
  );
}
