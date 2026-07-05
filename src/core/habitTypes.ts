import type {
  HabitSpec,
  HabitState,
  Observation,
  PlanLadder,
  TimeWindow,
  WeeklyPlan,
} from '../../packages/habit-engine';

// フェーズ3(④習慣化)の永続化用ラッパ型。エンジンの型をそのまま IndexedDB 行として使う。
// core/types.ts とは分離してある(core/types は vite.config の型検査グラフに含まれ、
// そこへエンジンを取り込むと tsconfig.node の複合プロジェクト制約に触れるため)。

export type HabitWindowRow = TimeWindow;
export type HabitSpecRow = HabitSpec;
export type HabitLadderRow = PlanLadder; // 主キー habitId
export type HabitStateRow = HabitState; // 主キー [habitId+contextKey]

/** Observation に自動採番 id を足した永続化型 */
export type StoredObservation = Observation & { id?: number };

/** 週間計画の世代保存。主キー weekStart(その週の月曜 YYYY-MM-DD) */
export interface HabitPlanRow {
  weekStart: string;
  plan: WeeklyPlan;
  generatedAt: number;
}
