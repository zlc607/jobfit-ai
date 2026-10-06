import type { Metadata, Viewport } from "next";

import { Header } from "@/components/header";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JobFit AI —— AI 求职匹配与简历定制",
    template: "%s | JobFit AI",
  },
  description:
    "粘贴职位描述、上传简历，30 秒得到匹配评分、差距分析、定制简历 Bullet、Cover Letter 与面试问题预测。开源、可自部署、简历不落库。",
  keywords: [
    "JobFit AI",
    "AI 简历",
    "求职匹配",
    "简历定制",
    "Cover Letter",
    "面试问题预测",
    "Next.js",
    "Vercel AI SDK",
  ],
  authors: [{ name: "JobFit AI contributors" }],
  openGraph: {
    title: "JobFit AI —— AI 求职匹配与简历定制",
    description:
      "匹配评分 · 差距分析 · 定制 Bullet · Cover Letter · 面试预测，全部一键导出 Markdown / PDF。",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning：next-themes 会在客户端改写 html class
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
