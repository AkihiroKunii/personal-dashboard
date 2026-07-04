import { saveImportResult, type ImportSummary } from './importer';
import { parseDailyExportJson } from './parsers/dailyJson';

// V-F7: `#import=<base64(JSON)>` 付きでPWAが開かれた場合の自動取込。
// フラグメントはサーバーに送信されないが、取込結果に関わらず即座に履歴から破棄する。

/** location.hash から #import= のペイロードを取り出す(なければ null) */
export function extractImportFragment(hash: string): string | null {
  const m = /^#import=(.+)$/.exec(hash);
  return m ? m[1] : null;
}

/** base64(標準/URL-safe、パディング欠落・percent-encoding も許容)→ UTF-8文字列 */
export function decodeBase64Utf8(payload: string): string {
  let b64 = payload;
  try {
    b64 = decodeURIComponent(b64);
  } catch {
    // percent-encodingとして不正なら元の文字列のまま扱う
  }
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    throw new Error('base64として解釈できません');
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * URLフラグメント自動取込。#import= がなければ null を返す。
 * フラグメントはパース前に history.replaceState で破棄する(失敗時も履歴に残さない)。
 */
export async function importFromFragment(): Promise<ImportSummary | null> {
  const payload = extractImportFragment(window.location.hash);
  if (!payload) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const text = decodeBase64Utf8(payload);
  const result = parseDailyExportJson(text);
  return saveImportResult(result);
}
