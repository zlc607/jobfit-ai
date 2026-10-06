"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/** 暗色 / 浅色 / 跟随系统 三态切换 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const order = ["light", "dark", "system"] as const;
  const current = (mounted ? theme : "system") ?? "system";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="切换主题"
      title={`当前：${
        current === "dark" ? "暗色" : current === "light" ? "浅色" : "跟随系统"
      }`}
      onClick={() => {
        const idx = order.indexOf(current as (typeof order)[number]);
        setTheme(order[(idx + 1) % order.length]);
      }}
    >
      <Icon />
    </Button>
  );
}
