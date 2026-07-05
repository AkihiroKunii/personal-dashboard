import type { MetricId } from '../../core/health/dailySeries';

export interface MetricDef {
  label: string;
  unit: string;
  color: string;
  kind: 'line' | 'bar';
  errorBars?: boolean;
}

/** 表示指標(V-F1)の定義 */
export const METRIC_DEFS: Record<MetricId, MetricDef> = {
  sleep: { label: '合計睡眠時間', unit: '時間', color: '#818cf8', kind: 'bar' },
  hrvSdnn: { label: 'HRV (SDNN)', unit: 'ms', color: '#2dd4bf', kind: 'line' },
  restingHr: { label: '安静時心拍', unit: 'bpm', color: '#fbbf24', kind: 'line' },
  steps: { label: '歩数', unit: '歩', color: '#38bdf8', kind: 'bar' },
  // 心拍数(日次要約)は平均を線で、最小〜最大をエラーバーで表示する
  heartRate: { label: '心拍数(最小・最大・平均)', unit: 'bpm', color: '#fb7185', kind: 'line', errorBars: true },
};

export const METRIC_IDS = Object.keys(METRIC_DEFS) as MetricId[];
