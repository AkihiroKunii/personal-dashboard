import { parseIsoWithOffset } from '../../dates';
import { mapJsonStage } from '../../health/stageMap';
import { DAILY_EXPORT_SOURCE, normalizeSourceName } from '../../health/sources';
import type { DailyMetricRow, ImportResult, SleepRecordRow } from '../../types';
import { saveImportResult } from '../importer';
import type { RegisteredParser } from '../registry';

// 日次エクスポートJSON(§1.3a schemaVersion 2)のパーサ。
// 自己定義の契約なので厳格にバリデーションする(§1.4)。
// ただしショートカットの仕様揺れとして数値がクォート付き文字列の場合があり、両方受理する。

/** 数値または数値文字列を受理。それ以外は undefined(呼び出し側で必須判定) */
function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function parseDailyExportJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして解釈できません');
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('JSONオブジェクトではありません');
  const obj = raw as Record<string, unknown>;

  const schemaVersion = toNumber(obj.schemaVersion);
  if (schemaVersion !== 2) {
    throw new Error(`未対応のschemaVersionです: ${String(obj.schemaVersion)}(2のみ対応)`);
  }
  const date = typeof obj.date === 'string' ? obj.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`dateが不正です: ${String(obj.date)}`);
  }

  const warnings: string[] = [];
  const dailyMetrics: DailyMetricRow[] = [];

  for (const metric of ['steps', 'hrvSdnn', 'restingHr'] as const) {
    if (obj[metric] === undefined || obj[metric] === null) {
      warnings.push(`${metric} がないためスキップしました`);
      continue;
    }
    const value = toNumber(obj[metric]);
    if (value === undefined) throw new Error(`${metric} が数値ではありません: ${String(obj[metric])}`);
    dailyMetrics.push({ metric, date, source: DAILY_EXPORT_SOURCE, value });
  }

  if (obj.heartRate !== undefined && obj.heartRate !== null) {
    const hr = obj.heartRate as Record<string, unknown>;
    const avg = toNumber(hr.avg);
    const min = toNumber(hr.min);
    const max = toNumber(hr.max);
    if (avg === undefined || min === undefined || max === undefined) {
      throw new Error('heartRate の min/max/avg が数値ではありません');
    }
    dailyMetrics.push({ metric: 'heartRate', date, source: DAILY_EXPORT_SOURCE, value: avg, min, max });
  } else {
    warnings.push('heartRate がないためスキップしました');
  }

  const sleepRecords: SleepRecordRow[] = [];
  const sleepRaw = obj.sleep === undefined || obj.sleep === null ? [] : obj.sleep;
  if (!Array.isArray(sleepRaw)) throw new Error('sleep が配列ではありません');
  for (const [i, rec] of sleepRaw.entries()) {
    const r = rec as Record<string, unknown>;
    if (typeof r.start !== 'string' || typeof r.end !== 'string' || typeof r.stage !== 'string') {
      throw new Error(`sleep[${i}] の start/end/stage が不正です`);
    }
    const stage = mapJsonStage(r.stage);
    if (!stage) throw new Error(`sleep[${i}] のstageを解釈できません: ${r.stage}`);
    // source は空文字列を許容する(実データ確認済み)
    const source = normalizeSourceName(typeof r.source === 'string' ? r.source : '');
    sleepRecords.push({
      source,
      start: parseIsoWithOffset(r.start),
      end: parseIsoWithOffset(r.end),
      stage,
    });
  }

  return { dailyMetrics, sleepRecords, warnings };
}

/** 日次エクスポートJSONらしいか(プログラムJSONとの内容判別に使う) */
export function looksLikeDailyExportJson(text: string): boolean {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return toNumber(raw?.schemaVersion) === 2 && typeof raw?.date === 'string';
  } catch {
    return false;
  }
}

async function importDailyText(text: string) {
  const summary = await saveImportResult(parseDailyExportJson(text));
  const range = summary.dateRange ? `(${summary.dateRange[0]}〜${summary.dateRange[1]})` : '';
  return {
    message: `指標${summary.metricCount}件・睡眠${summary.sleepCount}件を保存しました${range}`,
    warnings: summary.warnings,
  };
}

export const dailyJsonParser: RegisteredParser = {
  id: 'daily-export-json',
  displayName: '日次エクスポートJSON(ショートカット)',
  matches: (fileName) => /\.json$/i.test(fileName),
  canParseText: looksLikeDailyExportJson,
  importText: importDailyText,
  importFile: async (file) => importDailyText(await file.text()),
};
