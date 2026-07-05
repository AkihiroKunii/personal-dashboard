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

export type DayOfWeek = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

/** 週間プログラム(§2.3a schemaVersion 1)の1日分 */
export interface ProgramExercise {
  name: string;
  sets: number;
  reps: string;
  note?: string;
}

export interface ProgramDay {
  dayOfWeek: DayOfWeek;
  focus: string;
  exercises: ProgramExercise[];
}

/** プログラムJSONの中身(パース済み・DB非依存) */
export interface ProgramContent {
  programName: string;
  validFrom: string;
  validUntil: string;
  weeklySchedule: ProgramDay[];
  nutritionTargets?: { proteinGramsPerDay?: number; note?: string };
  bodyMetricsToTrack?: string[];
}

/**
 * 取込済みプログラム(G-F6)。主キーは [programName+validFrom] の自然キー。
 * 同一世代の再取込は上書きになり重複しない(自動フェッチの再実行に対して冪等)。
 */
export interface ProgramRow extends ProgramContent {
  importedAt: number;
  /** 取込元テキスト。自動フェッチの差分判定に使う */
  raw: string;
}

/** ボディ記録の指標(G-F8) */
export const BODY_METRICS = ['weight', 'bodyFatPct', 'chest', 'arm', 'waist', 'thigh'] as const;
export type BodyMetricId = (typeof BODY_METRICS)[number];

/** ボディ記録の1点。主キー [metric+date](同一キーは上書き) */
export interface BodyMetricRow {
  metric: BodyMetricId;
  date: string;
  value: number;
}

/** タンパク質目標の日次二値記録(G-F9)。主キー date */
export interface ProteinDayRow {
  date: string;
  achieved: boolean;
}

/** パーサの出力。importer が IndexedDB へ冪等保存する */
export interface ImportResult {
  dailyMetrics: DailyMetricRow[];
  sleepRecords: SleepRecordRow[];
  warnings: string[];
}
