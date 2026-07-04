// ソース名の正規化と優先ソース解決(集約箇所)。
// sourceName にはノーブレークスペースが混入する(実データ確認済み: "USER's Apple (U+00A0) Watch")。
// ソース名の比較・表示・保存は必ず normalizeSourceName を通すこと。

/** 日次エクスポートJSON(§1.3a)由来データのソースキー(空文字列を許容する仕様) */
export const DAILY_EXPORT_SOURCE = '';
export const DAILY_EXPORT_LABEL = '日次エクスポート';

export function normalizeSourceName(raw: string): string {
  return raw.replace(/\u00a0/g, ' ').trim();
}

export function sourceLabel(source: string): string {
  return source === DAILY_EXPORT_SOURCE ? DAILY_EXPORT_LABEL : source;
}

/**
 * ソースを優先順に並べる。設定リストに載っているものが先頭(記載順)、
 * 未設定のソースは日次エクスポート('')を最優先、残りは名前順。
 */
export function orderByPriority(sources: string[], priority: string[]): string[] {
  const rank = new Map(priority.map((s, i) => [s, i]));
  return [...sources].sort((a, b) => {
    const ra = rank.get(a);
    const rb = rank.get(b);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    if (a === DAILY_EXPORT_SOURCE) return -1;
    if (b === DAILY_EXPORT_SOURCE) return 1;
    return a.localeCompare(b, 'ja');
  });
}

/** 日×指標のソース別値から、優先順位最上位のソースの値だけを採用する(合算しない) */
export function pickPreferred<T>(bySource: Map<string, T>, priority: string[]): T | undefined {
  const ordered = orderByPriority([...bySource.keys()], priority);
  return ordered.length > 0 ? bySource.get(ordered[0]) : undefined;
}
