/** 日次集計指標の1行。主キーは [metric+date+source](同一キーは上書き=冪等) */
export interface DailyMetricRow {
  /** 'steps' | 'hrvSdnn' | 'restingHr' | 'heartRate'(睡眠は sleepRecords から導出) */
  metric: string;
  /** YYYY-MM-DD(JST) */
  date: string;
  /** 正規化済みソース名。'' は日次エクスポートJSON由来 */
  source: string;
  /** 指標値。heartRate は平均値 */
  value: number;
  /** heartRate のみ: その日の最小値 */
  min?: number;
  /** heartRate のみ: その日の最大値 */
  max?: number;
}

/** 正準の睡眠ステージ。表記文字列の解釈は core/health/stageMap.ts に集約 */
export type SleepStage = 'inBed' | 'awake' | 'core' | 'deep' | 'rem' | 'asleep';

/** 睡眠レコード。主キーは [source+start+end+stage](同一キーは上書き=冪等) */
export interface SleepRecordRow {
  source: string;
  /** epoch ms */
  start: number;
  /** epoch ms */
  end: number;
  stage: SleepStage;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/** チャートの日次系列点(欠測日は value: null)。①③④で共用 */
export interface SeriesPoint {
  date: string;
  value: number | null;
  min?: number;
  max?: number;
}

/** 部位(G-F2)。固定6種 */
export const MUSCLE_GROUPS = ['胸', '背中', '脚', '肩', '腕', 'コア'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** 種目マスタ(G-F1b)。id は自動採番 */
export interface ExerciseRow {
  id?: number;
  name: string;
  muscleGroup: MuscleGroup;
}

/** 1セットの記録(G-F1)。date は記録時刻のJST暦日 */
export interface GymSetRow {
  id?: number;
  exerciseId: number;
  /** 記録時刻 epoch ms */
  at: number;
  /** YYYY-MM-DD(JST) */
  date: string;
  weightKg: number;
  reps: number;
}

/** パーサの出力。importer が IndexedDB へ冪等保存する */
export interface ImportResult {
  dailyMetrics: DailyMetricRow[];
  sleepRecords: SleepRecordRow[];
  warnings: string[];
}
