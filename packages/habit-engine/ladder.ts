import { LADDER_TEMPLATES } from './config';
import type { HabitSpec, LadderStep, PlanLadder, StepKind } from './types';

// 分解ラダー(habit-algorithm.md §4)。活動タイプ別テンプレから4段を生成する。
// 制約: 最小実行単位は「小さいが本人がその活動と認識できる最小有意味単位」。
// ユーザーによる編集を許可する(返り値はプレーンデータ)。

function step(kind: StepKind, activity: string, tmpl: { label: string; minutes: number }): LadderStep {
  return { kind, label: `${activity}: ${tmpl.label}`, minutes: tmpl.minutes };
}

export function buildLadder(spec: HabitSpec): PlanLadder {
  const t = LADDER_TEMPLATES[spec.activityType];
  return {
    habitId: spec.id,
    minimal: step('minimal', spec.activity, t.minimal),
    standard: step('standard', spec.activity, t.standard),
    stretch: step('stretch', spec.activity, t.stretch),
    recovery: step('recovery', spec.activity, t.recovery),
  };
}

/** stage/難度に応じて採用すべきステップを選ぶ(scheduler・difficulty管理から使う) */
export function stepForKind(ladder: PlanLadder, kind: StepKind): LadderStep {
  return ladder[kind];
}
