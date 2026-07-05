import { db } from '../../../core/db';
import { enumerateDates } from '../../../core/dates';
import type { BodyMetricId, BodyMetricRow, ProteinDayRow, SeriesPoint } from '../../../core/types';

// ボディ記録(G-F8)とタンパク質二値記録(G-F9)のDB操作。

/** ボディ指標を保存(同一 metric+date は上書き=冪等) */
export async function recordBodyMetric(
  metric: BodyMetricId,
  date: string,
  value: number,
): Promise<void> {
  if (!Number.isFinite(value)) throw new Error('数値を入力してください');
  await db.bodyMetrics.put({ metric, date, value });
}

/** ボディ指標の日次系列(欠測日は value: null、範囲全日) */
export async function loadBodySeries(
  metric: BodyMetricId,
  from: string,
  to: string,
): Promise<SeriesPoint[]> {
  const rows = await db.bodyMetrics
    .where('date')
    .between(from, to, true, true)
    .and((r) => r.metric === metric)
    .toArray();
  const byDate = new Map(rows.map((r) => [r.date, r.value]));
  return enumerateDates(from, to).map((date) => ({ date, value: byDate.get(date) ?? null }));
}

/** その指標の最新値(前回値プリセット用) */
export async function latestBodyMetric(metric: BodyMetricId): Promise<BodyMetricRow | undefined> {
  const rows = await db.bodyMetrics.where('metric').equals(metric).sortBy('date');
  return rows.at(-1);
}

/** 指定日のタンパク質達成フラグをトグルする(未記録→達成→未達成→未記録) */
export async function toggleProtein(date: string): Promise<void> {
  const cur = await db.proteinDays.get(date);
  if (cur === undefined) {
    await db.proteinDays.put({ date, achieved: true });
  } else if (cur.achieved) {
    await db.proteinDays.put({ date, achieved: false });
  } else {
    await db.proteinDays.delete(date);
  }
}

export async function getProteinDay(date: string): Promise<ProteinDayRow | undefined> {
  return db.proteinDays.get(date);
}
