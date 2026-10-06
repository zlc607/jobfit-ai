import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 404 页 */
export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Compass className="size-12 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">页面不存在</h1>
        <p className="text-sm text-muted-foreground">
          你访问的地址没有对应页面，回到首页重新开始吧。
        </p>
      </div>
      <Button asChild>
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
