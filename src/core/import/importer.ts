import { db } from '../db';
import type { ImportResult } from '../types';

export interface ImportSummary {
  /** 保存した日次指標の行数 */
  metricCount: number;
  /** 保存した睡眠レコード数 */
  sleepCount: number;
  /** 取込データの日付範囲(日次指標ベース) */
  dateRange: [string, string] | null;
  warnings: string[];
}

/**
 * ImportResult を IndexedDB へ冪等保存する。
 * 両ストアとも複合主キーへの bulkPut のため、同一ファイルの再取込は上書きになり重複しない。
 */
export async function saveImportResult(result: ImportResult): Promise<ImportSummary> {
  await db.transaction('rw', db.dailyMetrics, db.sleepRecords, async () => {
    await db.dailyMetrics.bulkPut(result.dailyMetrics);
    await db.sleepRecords.bulkPut(result.sleepRecords);
  });
  const dates = result.dailyMetrics.map((r) => r.date).sort();
  return {
    metricCount: result.dailyMetrics.length,
    sleepCount: result.sleepRecords.length,
    dateRange: dates.length > 0 ? [dates[0], dates.at(-1)!] : null,
    warnings: result.warnings,
  };
}
