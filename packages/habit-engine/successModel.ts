import type { HabitSpec, LadderStep, Observation } from './types';

// 完了確率モデル(habit-algorithm.md §5)。
// 軽量確率モデル = Beta-Binomial。コールドスタート(履歴ゼロ)では
// canonicalize 属性由来の事前分布に一致し、履歴が貯まると文脈別に事後更新される。

/** 事前分布の総擬似観測数。小さいほど履歴に早く追従する */
const PRIOR_STRENGTH = 4;

/** 属性から事前平均(0..1)を決める: cueability↑・friction↓・setupCost↓ で完了しやすい */
export function priorMean(spec: HabitSpec): number {
  const a = spec.attributes;
  const raw = 0.5 + 0.3 * (a.cueability - 0.5) - 0.4 * (a.friction - 0.5) - 0.2 * (a.setupCost - 0.5);
  return Math.min(0.95, Math.max(0.05, raw));
}

/** ステップの難度係数(0..1、大きいほど完了しにくい)。standard を基準に相対化 */
export function stepDifficulty(step: LadderStep): number {
  // minutes を対数的に効かせる(5分と30分の差を効かせつつ飽和させる)
  return Math.min(0.9, Math.log2(1 + step.minutes) / Math.log2(1 + 45));
}

/**
 * P_complete(step, contextKey | history) を返す(0..1)。
 * 履歴は同一 (habitId, contextKey) で絞り込み、Beta-Binomial の事後平均を難度で減衰する。
 */
export function pComplete(
  spec: HabitSpec,
  step: LadderStep,
  contextKey: string,
  history: Observation[] = [],
): number {
  const relevant = history.filter((o) => o.habitId === spec.id && o.contextKey === contextKey);
  const successes = relevant.filter((o) => o.completed).length;
  const attempts = relevant.length;

  const mean0 = priorMean(spec);
  const alpha0 = mean0 * PRIOR_STRENGTH;
  const beta0 = (1 - mean0) * PRIOR_STRENGTH;
  const posterior = (alpha0 + successes) / (alpha0 + beta0 + attempts);

  // ステップが大きいほど完了確率を下げる(difficulty 0→無補正, 0.9→大幅減)
  const difficultyPenalty = 1 - 0.6 * stepDifficulty(step);
  return Math.min(0.99, Math.max(0.01, posterior * difficultyPenalty));
}
