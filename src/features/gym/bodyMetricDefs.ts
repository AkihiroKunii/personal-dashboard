import type { BodyMetricId } from '../../core/types';

export interface BodyMetricDef {
  label: string;
  unit: string;
  color: string;
  step: number;
}

/** ボディ記録(G-F8)の指標定義 */
export const BODY_METRIC_DEFS: Record<BodyMetricId, BodyMetricDef> = {
  weight: { label: '体重', unit: 'kg', color: '#818cf8', step: 0.1 },
  bodyFatPct: { label: '体脂肪率', unit: '%', color: '#fb7185', step: 0.1 },
  chest: { label: '胸囲', unit: 'cm', color: '#38bdf8', step: 0.5 },
  arm: { label: '腕囲', unit: 'cm', color: '#a78bfa', step: 0.5 },
  waist: { label: 'ウエスト', unit: 'cm', color: '#fbbf24', step: 0.5 },
  thigh: { label: '大腿囲', unit: 'cm', color: '#34d399', step: 0.5 },
};
