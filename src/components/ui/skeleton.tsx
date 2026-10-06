import * as React from "react";

import { cn } from "@/lib/utils";

/** 加载骨架屏 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shimmer rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
