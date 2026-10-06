"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Clock,
  FileSearch,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ResultView } from "@/components/result-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHistory } from "@/hooks/use-history";
import { HISTORY_LIMIT } from "@/lib/types";
import { formatTime, scoreStroke } from "@/lib/utils";

/**
 * 历史记录页：读取浏览器 localStorage 中最近 10 次分析。
 * 服务端不参与，所以这里只有纯客户端逻辑。
 */
export default function HistoryPage() {
  const { items, hydrated, remove, clear, load } = useHistory();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const expandedResult = React.useMemo(
    () => (expandedId ? load(expandedId) : null),
    [expandedId, load],
  );

  const handleRemove = (id: string, title: string) => {
    remove(id);
    if (expandedId === id) setExpandedId(null);
    toast.success(`已删除「${title}」`);
  };

  const handleClear = () => {
    clear();
    setExpandedId(null);
    toast.success("已清空全部历史记录");
  };

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <History className="size-5 text-primary" />
            历史记录
          </h1>
          <p className="text-sm text-muted-foreground">
            仅保存在这台设备的浏览器 localStorage 中，最多保留最近 {HISTORY_LIMIT} 次。
            清除浏览器数据或点击删除都会立即移除。
          </p>
        </div>

        {items.length > 0 ? (
          <Button variant="outline" size="sm" onClick={handleClear}>
            <Trash2 />
            清空全部
          </Button>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileSearch className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">还没有分析记录</p>
              <p className="text-sm text-muted-foreground">
                回到首页粘贴 JD 与简历，完成一次分析后会自动出现在这里。
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/">去做第一次分析</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base leading-snug">
                        {item.title}
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatTime(item.createdAt)}
                        </span>
                        <span>模型 {item.model}</span>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.score >= 80
                            ? "strong"
                            : item.score >= 60
                              ? "weak"
                              : "miss"
                        }
                        className="tabular-nums"
                      >
                        {item.score} 分
                      </Badge>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                      >
                        {isExpanded ? (
                          <>
                            <ChevronDown className="rotate-180" />
                            收起
                          </>
                        ) : (
                          <>
                            <ChevronDown />
                            查看
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="删除该记录"
                        onClick={() => handleRemove(item.id, item.title)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded ? (
                  <CardContent>
                    {expandedResult ? (
                      <ResultView result={expandedResult} saved />
                    ) : (
                      <div className="space-y-3 py-4">
                        <p className="text-sm text-muted-foreground">
                          该记录的详情已不可读取（通常是浏览器存储空间不足时被清理，或本次写入失败）。
                          列表里的概要信息仍然保留。
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/">回到首页重新分析</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(item.id, item.title)}
                          >
                            <Trash2 />
                            删除这条记录
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        分数颜色：
        <span style={{ color: scoreStroke(85) }} className="ml-1 font-medium">
          80+ 高度匹配
        </span>
        {" · "}
        <span style={{ color: scoreStroke(70) }} className="font-medium">
          60-79 基本匹配
        </span>
        {" · "}
        <span style={{ color: scoreStroke(40) }} className="font-medium">
          60 以下偏低
        </span>
      </p>
    </div>
  );
}
