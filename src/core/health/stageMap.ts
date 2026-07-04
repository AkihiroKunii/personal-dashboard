import type { SleepStage } from '../types';

// 睡眠ステージ表記のマッピング表(集約箇所)。
// ここ以外で "Core" や HKCategoryValueSleepAnalysis* を直接解釈しないこと。

/** 日次エクスポートJSON(§1.3a)のステージ表記 → 正準ステージ */
const JSON_STAGE_MAP: Record<string, SleepStage> = {
  'In Bed': 'inBed',
  InBed: 'inBed',
  Awake: 'awake',
  Core: 'core',
  Deep: 'deep',
  REM: 'rem',
  Asleep: 'asleep',
  Unspecified: 'asleep',
  'Asleep (Unspecified)': 'asleep',
};

/** Apple標準 export.xml のステージ表記 → 正準ステージ */
const XML_STAGE_MAP: Record<string, SleepStage> = {
  HKCategoryValueSleepAnalysisInBed: 'inBed',
  HKCategoryValueSleepAnalysisAwake: 'awake',
  HKCategoryValueSleepAnalysisAsleepCore: 'core',
  HKCategoryValueSleepAnalysisAsleepDeep: 'deep',
  HKCategoryValueSleepAnalysisAsleepREM: 'rem',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'asleep',
  HKCategoryValueSleepAnalysisAsleep: 'asleep',
};

export function mapJsonStage(raw: string): SleepStage | undefined {
  return JSON_STAGE_MAP[raw.trim()];
}

export function mapXmlStage(raw: string): SleepStage | undefined {
  return XML_STAGE_MAP[raw.trim()];
}

/** 実睡眠時間に算入するステージ。InBed と Awake は除外(ユーザー確認済み) */
export const ASLEEP_STAGES: ReadonlySet<SleepStage> = new Set([
  'core',
  'deep',
  'rem',
  'asleep',
]);

export const STAGE_LABELS: Record<SleepStage, string> = {
  inBed: 'ベッド内',
  awake: '覚醒',
  core: 'コア',
  deep: '深い',
  rem: 'レム',
  asleep: '睡眠(未分類)',
};
