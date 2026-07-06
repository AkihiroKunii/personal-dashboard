import { db } from '../db';
import { enumerateDates, parseIsoWithOffset } from '../dates';
import type { DailyMetricRow, SeriesPoint, SleepStage } from '../types';
import { pickPreferred } from './sources';
import { dailySleepBySource, dailyStageMinutesBySource } from './sleepSessions';

export type { SeriesPoint };

/** 表示できる指標(V-F1)。sleep のみ sleepRecords からの導出値 */
export type MetricId = 'sleep' | 'hrvSdnn' | 'restingHr' | 'steps' | 'heartRate';

/**
 * 日次集計指標の系列。日×指標ごとにソース別の値から優先ソース1本のみ採用(合算しない)。
 * 欠測日は value: null(チャートで線を切るため全日を返す)。
 */
export async function loadMetricSeries(
  metric: Exclude<MetricId, 'sleep'>,
  from: string,
  to: string,
  priority: string[],
): Promise<SeriesPoint[]> {
  const rows = await db.dailyMetrics
    .where('metric')
    .equals(metric)
    .and((r) => r.date >= from && r.date <= to)
    .toArray();
  const byDate = new Map<string, Map<string, DailyMetricRow>>();
  for (const r of rows) {
    let bySource = byDate.get(r.date);
    if (!bySource) byDate.set(r.date, (bySource = new Map()));
    bySource.set(r.source, r);
  }
  return enumerateDates(from, to).map((date) => {
    const bySource = byDate.get(date);
    const row = bySource ? pickPreferred(bySource, priority) : undefined;
    return row
      ? { date, value: row.value, min: row.min, max: row.max }
      : { date, value: null };
  });
}

/** 合計睡眠時間(時間単位)の系列。セッション帰属・優先ソース選択済み */
export async function loadSleepSeries(
  from: string,
  to: string,
  priority: string[],
): Promise<SeriesPoint[]> {
  // 帰属日が範囲内になりうるレコードを引く(起床日基準なので前日夜〜当日昼のレコードが対象。
  // 余裕を持って前後1日分広げてからセッション化し、帰属日でフィルタする)
  const fromMs = parseIsoWithOffset(`${from}T00:00:00+09:00`) - 36 * 3600_000;
  const toMs = parseIsoWithOffset(`${to}T23:59:59+09:00`) + 12 * 3600_000;
  const records = await db.sleepRecords.where('start').between(fromMs, toMs).toArray();
  const byDate = dailySleepBySource(records);
  return enumerateDates(from, to).map((date) => {
    const bySource = byDate.get(date);
    const minutes = bySource ? pickPreferred(bySource, priority) : undefined;
    return { date, value: minutes !== undefined ? Math.round((minutes / 60) * 100) / 100 : null };
  });
}

/** 睡眠ステージ表示で使う内訳キー(deep/rem/core と、未分類の asleep をまとめた other) */
export type SleepStageKey = 'deep' | 'rem' | 'core' | 'other';
export const SLEEP_STAGE_KEYS: SleepStageKey[] = ['deep', 'core', 'rem', 'other'];

/**
 * ステージ別睡眠時間(時間単位)の系列。優先ソースを1本選択し、
 * deep/rem/core/other(=asleep未分類) それぞれの SeriesPoint[] を返す。欠測日は value:null。
 */
export async function loadSleepStageSeries(
  from: string,
  to: string,
  priority: string[],
): Promise<Record<SleepStageKey, SeriesPoint[]>> {
  const fromMs = parseIsoWithOffset(`${from}T00:00:00+09:00`) - 36 * 3600_000;
  const toMs = parseIsoWithOffset(`${to}T23:59:59+09:00`) + 12 * 3600_000;
  const records = await db.sleepRecords.where('start').between(fromMs, toMs).toArray();
  const byDate = dailyStageMinutesBySource(records);

  const result: Record<SleepStageKey, SeriesPoint[]> = { deep: [], rem: [], core: [], other: [] };
  const toHours = (min: number) => Math.round((min / 60) * 100) / 100;
  for (const date of enumerateDates(from, to)) {
    const bySource = byDate.get(date);
    const stages = bySource ? pickPreferred(bySource, priority) : undefined;
    const pick = (stage: SleepStage): SeriesPoint => ({
      date,
      value: stages ? toHours(stages[stage]) : null,
    });
    result.deep.push(pick('deep'));
    result.core.push(pick('core'));
    result.rem.push(pick('rem'));
    result.other.push(pick('asleep'));
  }
  return result;
}

/** 表示範囲のアンカー(データの最終日。データがなければ null) */
export async function latestDataDate(): Promise<string | null> {
  const lastMetric = await db.dailyMetrics.orderBy('date').last();
  const lastSleep = await db.sleepRecords.orderBy('start').last();
  const candidates: string[] = [];
  if (lastMetric) candidates.push(lastMetric.date);
  if (lastSleep) {
    const byDate = dailySleepBySource([lastSleep]);
    candidates.push(...byDate.keys());
  }
  return candidates.length > 0 ? candidates.sort().at(-1)! : null;
}
