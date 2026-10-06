"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

/** 全局 Provider：目前只挂载主题（暗色模式） */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
