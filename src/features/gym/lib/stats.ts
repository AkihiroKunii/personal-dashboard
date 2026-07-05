import { enumerateDates } from '../../../core/dates';
import type { GymSetRow, SeriesPoint } from '../../../core/types';

// ジムの集計ロジック(純粋関数)。チャートは core/charts/TimeSeriesChart に載せる。

/** 中央値。偶数個は中央2値の平均 */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error('median: 空配列');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 推定1RM(Epley式、G-F3b)。目標管理の主指標 */
export function epleyE1rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

function groupByDate(sets: GymSetRow[]): Map<string, GymSetRow[]> {
  const byDate = new Map<string, GymSetRow[]>();
  for (const s of sets) {
    const list = byDate.get(s.date);
    if (list) list.push(s);
    else byDate.set(s.date, [s]);
  }
  return byDate;
}

/**
 * 日次の使用重量: 中央値(value)+ 最低(min)〜最高(max)(G-F3)。
 * TimeSeriesChart の errorBars 形式。欠測日は value: null で全日返す。
 */
export function dailyWeightSeries(sets: GymSetRow[], from: string, to: string): SeriesPoint[] {
  const byDate = groupByDate(sets);
  return enumerateDates(from, to).map((date) => {
    const daySets = byDate.get(date);
    if (!daySets || daySets.length === 0) return { date, value: null };
    const weights = daySets.map((s) => s.weightKg);
    return {
      date,
      value: median(weights),
      min: Math.min(...weights),
      max: Math.max(...weights),
    };
  });
}

/** 日次の推定1RM: その日の全セットのe1RM最大値(G-F3b) */
export function dailyE1rmSeries(sets: GymSetRow[], from: string, to: string): SeriesPoint[] {
  const byDate = groupByDate(sets);
  return enumerateDates(from, to).map((date) => {
    const daySets = byDate.get(date);
    if (!daySets || daySets.length === 0) return { date, value: null };
    return {
      date,
      value: Math.max(...daySets.map((s) => epleyE1rm(s.weightKg, s.reps))),
    };
  });
}
