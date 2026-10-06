import {
  HISTORY_LIMIT,
  type AnalyzeResult,
  type HistoryItem,
} from "@/lib/types";

/**
 * 历史记录存储：纯浏览器 localStorage。
 * 设计：索引与详情分开存，列表渲染只读索引，避免每次解析大 JSON。
 *   jobfit:history:index        -> HistoryItem[]
 *   jobfit:history:result:<id>  -> AnalyzeResult
 *
 * 一致性要求：任何写入失败都必须让"实际写入的索引"回传给调用方，
 * 否则界面会显示刷新后消失的记录，或者点开永远读不到的僵尸条目。
 */

const INDEX_KEY = "jobfit:history:index";
const RESULT_PREFIX = "jobfit:history:result:";

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readIndex(): HistoryItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string")
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** 清掉不在白名单内的详情，回收空间 */
function pruneResults(keepIds: string[]): void {
  if (!isBrowser()) return;
  const keep = new Set(keepIds);
  const toRemove: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(RESULT_PREFIX)) continue;
    const id = key.slice(RESULT_PREFIX.length);
    if (!keep.has(id)) toRemove.push(key);
  }
  toRemove.forEach((key) => window.localStorage.removeItem(key));
}

/** 详情写入失败时腾空间：删掉除当前条目外最旧的若干条详情 */
function freeSpaceFor(exceptId: string, count = 3): void {
  if (!isBrowser()) return;
  // readIndex 已按 createdAt 倒序，末尾即最旧
  readIndex()
    .filter((item) => item.id !== exceptId)
    .slice(-count)
    .forEach((item) => {
      window.localStorage.removeItem(`${RESULT_PREFIX}${item.id}`);
    });
}

/**
 * 写入索引。
 * 配额不足时逐级裁剪（10 -> 5 -> 2）并重试，每次裁剪都回收对应详情释放空间；
 * 全部失败则返回空数组，由调用方如实反馈给界面。
 */
function writeIndex(items: HistoryItem[]): HistoryItem[] {
  if (!isBrowser()) return items;

  const attempts = [items, items.slice(0, 5), items.slice(0, 2)];

  for (const attempt of attempts) {
    try {
      window.localStorage.setItem(INDEX_KEY, JSON.stringify(attempt));
      return attempt;
    } catch {
      // 本次没写进去：收回不在该列表内的详情，为下一次尝试腾出空间
      pruneResults(attempt.map((item) => item.id));
    }
  }

  console.warn("[jobfit] 浏览器存储空间不足，历史索引未能写入");
  return [];
}

/** 读取历史索引（最近 10 条） */
export function listHistory(): HistoryItem[] {
  return readIndex().slice(0, HISTORY_LIMIT);
}

export interface SaveResultOutcome {
  /** 真正落盘的索引条目（可能与传入的不同：配额不足时会被裁剪） */
  items: HistoryItem[];
  /** 详情是否完整写入；false 表示只能保留索引信息 */
  detailStored: boolean;
}

/** 保存一次分析结果，返回实际写入结果 */
export function saveResult(result: AnalyzeResult): SaveResultOutcome {
  if (!isBrowser()) return { items: [], detailStored: false };

  const item: HistoryItem = {
    id: result.id,
    createdAt: result.createdAt,
    title: result.title,
    score: result.match.totalScore,
    model: result.model,
  };

  const serialized = JSON.stringify(result);
  let detailStored = false;

  try {
    window.localStorage.setItem(`${RESULT_PREFIX}${result.id}`, serialized);
    detailStored = true;
  } catch {
    // 配额不足：驱逐最旧的 3 条详情后重试一次
    freeSpaceFor(result.id, 3);
    try {
      window.localStorage.setItem(`${RESULT_PREFIX}${result.id}`, serialized);
      detailStored = true;
    } catch {
      detailStored = false;
    }
  }

  const next = [item, ...readIndex().filter((i) => i.id !== result.id)].slice(
    0,
    HISTORY_LIMIT,
  );
  const written = writeIndex(next);
  pruneResults(written.map((i) => i.id));

  return { items: written, detailStored };
}

/** 读取某次完整结果；已被清理时返回 null */
export function loadResult(id: string): AnalyzeResult | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(`${RESULT_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as AnalyzeResult;
  } catch {
    return null;
  }
}

/** 删除一条历史 */
export function removeResult(id: string): HistoryItem[] {
  if (!isBrowser()) return [];
  window.localStorage.removeItem(`${RESULT_PREFIX}${id}`);
  const next = readIndex().filter((i) => i.id !== id);
  return writeIndex(next);
}

/** 清空全部历史 */
export function clearHistory(): void {
  if (!isBrowser()) return;
  readIndex().forEach((item) => {
    window.localStorage.removeItem(`${RESULT_PREFIX}${item.id}`);
  });
  window.localStorage.removeItem(INDEX_KEY);
}
