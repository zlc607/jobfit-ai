"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  clearHistory,
  listHistory,
  loadResult,
  removeResult,
  saveResult,
} from "@/lib/storage";
import type { AnalyzeResult, HistoryItem } from "@/lib/types";

/**
 * 历史记录 hook：包一层 React 状态，让页面与 localStorage 保持同步。
 * 只在客户端执行；首次渲染为空列表，挂载后再读取，避免 SSR 水合不一致。
 */
export function useHistory() {
  const [items, setItems] = React.useState<HistoryItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setItems(listHistory());
    setHydrated(true);
  }, []);

  /** 保存并如实反馈：配额不足导致记录被裁剪时不能假装成功 */
  const save = React.useCallback((result: AnalyzeResult) => {
    const { items: written, detailStored } = saveResult(result);
    setItems(written);

    if (written.length === 0) {
      toast.warning("浏览器存储空间不足，本次记录未能保存");
    } else if (!detailStored) {
      toast.warning("记录已保存，但详情写入失败，历史页只能看到概要");
    }

    return written;
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems(removeResult(id));
  }, []);

  const clear = React.useCallback(() => {
    clearHistory();
    setItems([]);
  }, []);

  const load = React.useCallback(
    (id: string): AnalyzeResult | null => loadResult(id),
    [],
  );

  return { items, hydrated, save, remove, clear, load };
}
