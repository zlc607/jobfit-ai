"use client";

import { Building2, CalendarClock, Cpu, MapPin } from "lucide-react";

import { CoverLetterView } from "@/components/cover-letter";
import { ExportBar } from "@/components/export-bar";
import { InterviewQuestionsView } from "@/components/interview-questions";
import { MarkdownPreview } from "@/components/markdown-preview";
import { MatchReportView } from "@/components/match-report";
import { TailoredBulletsView } from "@/components/tailored-bullets";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyzeResult } from "@/lib/types";
import { formatTime } from "@/lib/utils";

interface ResultViewProps {
  result: AnalyzeResult;
  /** 保存到历史；不传则不显示保存按钮（历史详情页使用） */
  onSave?: () => void;
  saved?: boolean;
}

/** 结果总览：岗位摘要 + 导出工具栏 + 五个内容页签 */
export function ResultView({ result, onSave, saved }: ResultViewProps) {
  const { jd, match } = result;
  const mustSkills = jd.skillsRequired.filter((s) => s.importance === "must");

  return (
    <div className="space-y-4">
      {/* ---------- 岗位摘要卡 ---------- */}
      <Card className="print-area print-break-avoid">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-lg leading-snug">{jd.title}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {jd.company ? (
                  <span className="flex items-center gap-1">
                    <Building2 className="size-3.5" />
                    {jd.company}
                  </span>
                ) : null}
                {jd.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {jd.location}
                  </span>
                ) : null}
                {jd.yearsRequired !== null && jd.yearsRequired !== undefined ? (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    要求 {jd.yearsRequired} 年经验
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <Cpu className="size-3.5" />
                  模型 {result.model}
                </span>
              </CardDescription>
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">
                {match.totalScore}
                <span className="text-base font-normal text-muted-foreground">
                  /100
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatTime(result.createdAt)}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {mustSkills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">硬性要求：</span>
              {mustSkills.slice(0, 18).map((skill, index) => (
                <Badge key={index} variant="outline" className="text-[10px]">
                  {skill.skill}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="no-print">
            <ExportBar result={result} onSave={onSave} saved={saved} />
          </div>
        </CardContent>
      </Card>

      {/* ---------- 内容页签（屏幕交互用；打印时由下方 print-only 区块代替） ---------- */}
      <Tabs defaultValue="match" className="no-print w-full">
        <TabsList className="no-print flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="match">匹配分析</TabsTrigger>
          <TabsTrigger value="bullets">定制 Bullet</TabsTrigger>
          <TabsTrigger value="cover">Cover Letter</TabsTrigger>
          <TabsTrigger value="interview">面试问题</TabsTrigger>
          <TabsTrigger value="export">Markdown / 导出</TabsTrigger>
        </TabsList>

        <TabsContent value="match">
          <MatchReportView match={match} />
        </TabsContent>

        <TabsContent value="bullets">
          <TailoredBulletsView result={result} />
        </TabsContent>

        <TabsContent value="cover">
          <CoverLetterView result={result} />
        </TabsContent>

        <TabsContent value="interview">
          <InterviewQuestionsView result={result} />
        </TabsContent>

        <TabsContent value="export" className="space-y-3">
          <div className="no-print">
            <ExportBar result={result} onSave={onSave} saved={saved} />
          </div>
          <MarkdownPreview result={result} />
        </TabsContent>
      </Tabs>

      {/* 打印时把全部内容展开成一个连续报告（不依赖页签的选中状态） */}
      <div className="print-only print-area space-y-4">
        <MatchReportView match={match} />
        <TailoredBulletsView result={result} />
        <CoverLetterView result={result} />
        <InterviewQuestionsView result={result} />
      </div>
    </div>
  );
}
