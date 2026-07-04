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
  sleep: { label: '合計睡眠時間', unit: '時間', color: '#6366f1', kind: 'bar' },
  hrvSdnn: { label: 'HRV (SDNN)', unit: 'ms', color: '#10b981', kind: 'line' },
  restingHr: { label: '安静時心拍', unit: 'bpm', color: '#f59e0b', kind: 'line' },
  steps: { label: '歩数', unit: '歩', color: '#3b82f6', kind: 'bar' },
  // 心拍数(日次要約)は平均を線で、最小〜最大をエラーバーで表示する
  heartRate: { label: '心拍数(最小・最大・平均)', unit: 'bpm', color: '#ef4444', kind: 'line', errorBars: true },
};

export const METRIC_IDS = Object.keys(METRIC_DEFS) as MetricId[];
