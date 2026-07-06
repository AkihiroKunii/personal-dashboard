import { addDays, todayJst } from '../../core/dates';
import {
  loadMetricSeries,
  loadSleepSeries,
  type MetricId,
  type SeriesPoint,
} from '../../core/health/dailySeries';
import { getSourcePriority } from '../../core/settings';

// 朝の取込直後に見せる「その晩のバイタルサマリ」用。
// 主目的は「今日の値が普段(直近約30日の平均)と比べてどうか」の比較(特に睡眠)。
// 睡眠は起床日基準・他指標は集計日と帰属日が異なりうるため、指標ごとに直近の値を採る。

/** 平均を出す基準日数(直近約1ヶ月) */
const BASELINE_DAYS = 30;

export interface VitalSummaryEntry {
  value: number;
  date: string;
  min?: number;
  max?: number;
  /** 最新値を除く直近平均(比較の基準)。データが1点しかなければ undefined */
  average?: number;
  /** 平均を計算した日数(=最新を除く記録日数) */
  baselineDays: number;
}

export type VitalSummary = Partial<Record<MetricId, VitalSummaryEntry>>;

/** 系列の最新の非null値と、それを除いた直近平均をまとめる */
function summarize(points: SeriesPoint[]): VitalSummaryEntry | undefined {
  const nonNull = points.filter((p): p is SeriesPoint & { value: number } => p.value !== null);
  if (nonNull.length === 0) return undefined;
  const latest = nonNull[nonNull.length - 1];
  const rest = nonNull.slice(0, -1);
  const average =
    rest.length > 0 ? rest.reduce((acc, p) => acc + p.value, 0) / rest.length : undefined;
  return {
    value: latest.value,
    date: latest.date,
    min: latest.min,
    max: latest.max,
    average,
    baselineDays: rest.length,
  };
}

/** 直近30日から、各指標の最新値と平均を集める(睡眠=昨夜、HRV=今朝 のように帰属日が違っても拾える) */
export async function loadLatestVitals(): Promise<VitalSummary> {
  const priority = await getSourcePriority();
  const to = todayJst();
  const from = addDays(to, -(BASELINE_DAYS - 1));
  const [sleep, hrvSdnn, restingHr, steps, heartRate] = await Promise.all([
    loadSleepSeries(from, to, priority),
    loadMetricSeries('hrvSdnn', from, to, priority),
    loadMetricSeries('restingHr', from, to, priority),
    loadMetricSeries('steps', from, to, priority),
    loadMetricSeries('heartRate', from, to, priority),
  ]);
  return {
    sleep: summarize(sleep),
    hrvSdnn: summarize(hrvSdnn),
    restingHr: summarize(restingHr),
    steps: summarize(steps),
    heartRate: summarize(heartRate),
  };
}
