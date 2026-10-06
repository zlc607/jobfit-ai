"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { EvidenceList } from "@/components/evidence-list";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreRing } from "@/components/ui/score-ring";
import type { MatchReport } from "@/lib/types";
import { cn, scoreLevel, scoreStroke } from "@/lib/utils";

interface MatchReportViewProps {
  match: MatchReport;
}

/** 匹配分析视图：总分红环 + 四维拆解 + 强/弱/缺/风险四类结论（全部带来源） */
export function MatchReportView({ match }: MatchReportViewProps) {
  const level = scoreLevel(match.totalScore);

  return (
    <div className="space-y-4">
      {/* ---------- 总览 ---------- */}
      <Card className="print-break-avoid">
        <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
          <ScoreRing score={match.totalScore} size={148} />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-lg font-semibold">匹配总评</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {match.summary}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {match.dimensions.map((dim) => (
                <div key={dim.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{dim.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {dim.score} 分 · 权重 {Math.round(dim.weight * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${dim.score}%`,
                        backgroundColor: scoreStroke(dim.score),
                      }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {dim.rationale}
                  </p>
                  <EvidenceList evidence={dim.evidence} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- 强匹配点 ---------- */}
      {match.strongMatches.length > 0 ? (
        <Card className="print-break-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-gap-strong" />
              强匹配点
              <Badge variant="strong">{match.strongMatches.length} 条</Badge>
            </CardTitle>
            <CardDescription>这些是你最该在简历和面试里放大的部分。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {match.strongMatches.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-gap-strong/25 bg-gap-strong/5 p-3"
              >
                <p className="text-sm font-medium leading-relaxed">
                  {item.point}
                </p>
                <EvidenceList evidence={item.evidence} className="mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* ---------- 缺失技能 / 差距 ---------- */}
      {match.missingSkills.length > 0 ? (
        <Card className="print-break-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-gap-miss" />
              缺失与差距
              <Badge variant="miss">{match.missingSkills.length} 项</Badge>
            </CardTitle>
            <CardDescription>
              按严重度排序：红=JD 硬性要求但简历没有，黄=证据薄弱，绿=加分项缺失。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {match.missingSkills.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-lg border p-3",
                  item.severity === "high" && "border-gap-miss/30 bg-gap-miss/5",
                  item.severity === "medium" &&
                    "border-gap-weak/30 bg-gap-weak/5",
                  item.severity === "low" &&
                    "border-gap-strong/25 bg-gap-strong/5",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      item.severity === "high"
                        ? "miss"
                        : item.severity === "medium"
                          ? "weak"
                          : "strong"
                    }
                  >
                    {item.severity === "high"
                      ? "严重缺失"
                      : item.severity === "medium"
                        ? "证据薄弱"
                        : "加分项"}
                  </Badge>
                  <span className="text-sm font-medium">{item.skill}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.suggestion}
                </p>
                <EvidenceList evidence={item.evidence} className="mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* ---------- 弱匹配点 ---------- */}
      {match.weakMatches.length > 0 ? (
        <Card className="print-break-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-gap-weak" />
              弱匹配点
              <Badge variant="weak">{match.weakMatches.length} 条</Badge>
            </CardTitle>
            <CardDescription>
              有相关性但不够强，需要在简历里补足细节或调整表述。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {match.weakMatches.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-gap-weak/25 bg-gap-weak/5 p-3"
              >
                <p className="text-sm font-medium">{item.point}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.reason}
                </p>
                <EvidenceList evidence={item.evidence} className="mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* ---------- 风险提示 ---------- */}
      {match.risks.length > 0 ? (
        <Card className="print-break-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-destructive" />
              风险提示
              <Badge variant="destructive">{match.risks.length} 条</Badge>
            </CardTitle>
            <CardDescription>
              这些点可能被面试官追问，提前准备好说法。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {match.risks.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-destructive/25 bg-destructive/5 p-3"
              >
                <p className="text-sm font-medium">{item.risk}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">原因：</span>
                  {item.why}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">应对：</span>
                  {item.mitigation}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        评分由大模型语义判断 + 本地关键词加权校验共同得出（技能覆盖 40% /
        经验相关 30% / 关键词 20% / 教育年限 10%），结论为 {level.label}。
      </p>
    </div>
  );
}
