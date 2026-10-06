"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "分析" },
  { href: "/history", label: "历史记录" },
  { href: "/privacy", label: "隐私" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="no-print sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-base tracking-tight">JobFit AI</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            求职匹配与简历定制
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                pathname === item.href && "bg-accent text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}

          <Button variant="ghost" size="icon" asChild>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub 仓库"
              title="GitHub 仓库"
            >
              <Github />
            </a>
          </Button>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
