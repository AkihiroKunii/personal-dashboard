import { addDays, todayJst } from '../../core/dates';
import {
  loadMetricSeries,
  loadSleepSeries,
  type MetricId,
  type SeriesPoint,
} from '../../core/health/dailySeries';
import { getSourcePriority } from '../../core/settings';

// 朝の取込直後に見せる「その晩のバイタルサマリ」用。
// 睡眠は起床日基準・他指標は集計日と帰属日が異なりうるため、指標ごとに直近の値を採る。

export interface VitalSummaryEntry {
  value: number;
  date: string;
  min?: number;
  max?: number;
}

export type VitalSummary = Partial<Record<MetricId, VitalSummaryEntry>>;

function latestNonNull(points: SeriesPoint[]): VitalSummaryEntry | undefined {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.value !== null) return { value: p.value, date: p.date, min: p.min, max: p.max };
  }
  return undefined;
}

/** 直近14日から、各指標の最新の値を集める(睡眠=昨夜、HRV=今朝 のように帰属日が違っても拾える) */
export async function loadLatestVitals(): Promise<VitalSummary> {
  const priority = await getSourcePriority();
  const to = todayJst();
  const from = addDays(to, -13);
  const [sleep, hrvSdnn, restingHr, steps, heartRate] = await Promise.all([
    loadSleepSeries(from, to, priority),
    loadMetricSeries('hrvSdnn', from, to, priority),
    loadMetricSeries('restingHr', from, to, priority),
    loadMetricSeries('steps', from, to, priority),
    loadMetricSeries('heartRate', from, to, priority),
  ]);
  return {
    sleep: latestNonNull(sleep),
    hrvSdnn: latestNonNull(hrvSdnn),
    restingHr: latestNonNull(restingHr),
    steps: latestNonNull(steps),
    heartRate: latestNonNull(heartRate),
  };
}
