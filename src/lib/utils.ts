import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 类名合并：clsx 处理条件，tailwind-merge 处理冲突覆盖 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 0-100 分映射到展示用等级 */
export function scoreLevel(score: number): {
  label: string;
  tone: "strong" | "weak" | "miss";
} {
  if (score >= 80) return { label: "高度匹配", tone: "strong" };
  if (score >= 60) return { label: "基本匹配", tone: "weak" };
  return { label: "匹配偏低", tone: "miss" };
}

/** 评分环形进度条颜色（HSL 变量，随主题变化） */
export function scoreStroke(score: number): string {
  if (score >= 80) return "hsl(var(--gap-strong))";
  if (score >= 60) return "hsl(var(--gap-weak))";
  return "hsl(var(--gap-miss))";
}

/** 生成短随机 id（浏览器 / 服务端通用） */
export function shortId(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** 格式化时间戳，用于历史记录列表 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * 部分模型会把换行输出成字面量 "\n"（两个字符）而不是真实换行，
 * 渲染与导出前统一还原，避免正文挤成一行。
 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\\n/g, "\n");
}
