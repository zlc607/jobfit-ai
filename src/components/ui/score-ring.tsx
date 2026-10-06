"use client";

import * as React from "react";

import { cn, scoreLevel, scoreStroke } from "@/lib/utils";

interface ScoreRingProps {
  /** 0-100 */
  score: number;
  size?: number;
  strokeWidth?: number;
  /** 环下方是否显示等级文案 */
  showLabel?: boolean;
  className?: string;
}

/**
 * 环形进度条：纯 SVG 实现，无额外依赖。
 * 使用 --ring-circumference / --ring-offset 驱动 stroke-dashoffset 动画（见 globals.css）。
 */
export function ScoreRing({
  score,
  size = 160,
  strokeWidth = 12,
  showLabel = true,
  className,
}: ScoreRingProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeScore / 100);
  const level = scoreLevel(safeScore);

  // 挂载后再动画，避免 SSR 时首帧即为终值
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      role="img"
      aria-label={`匹配评分 ${safeScore} 分，${level.label}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* 轨道 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          {/* 进度 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={scoreStroke(safeScore)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={mounted ? offset : circumference}
            style={{
              transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-bold tabular-nums leading-none"
            style={{ fontSize: size * 0.26 }}
          >
            {safeScore}
          </span>
          <span
            className="mt-1 text-muted-foreground"
            style={{ fontSize: Math.max(10, size * 0.075) }}
          >
            满分 100
          </span>
        </div>
      </div>

      {showLabel ? (
        <span
          className={cn(
            "rounded-full px-3 py-0.5 text-xs font-medium",
            level.tone === "strong" && "bg-gap-strong/10 text-gap-strong",
            level.tone === "weak" && "bg-gap-weak/10 text-gap-weak",
            level.tone === "miss" && "bg-gap-miss/10 text-gap-miss",
          )}
        >
          {level.label}
        </span>
      ) : null}
    </div>
  );
}
