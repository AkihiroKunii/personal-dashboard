import type { Observation } from './types';

// 週次レビュー指標(habit-algorithm.md §9)。完了率だけでは不十分なため複数を追跡する。

export interface ReviewMetrics {
  completions: number;
  attempts: number;
  completionRate: number;
  /** 文脈一致率(完了のうち計画文脈で実行できた割合) */
  contextMatchRate: number;
  /** 自己開始率(完了のうち通知なしで実行した割合) */
  selfInitiationRate: number;
  /** 通知依存度(完了のうち通知起点の割合) */
  promptDependence: number;
  /** 平均努力感(1..3、完了分のみ) */
  averageEffort: number | null;
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** 期間内の観測からレビュー指標を集計する(文言は評価ではなく観察ベースで、呼び出し側が生成する) */
export function reviewMetrics(observations: Observation[]): ReviewMetrics {
  const attempts = observations.length;
  const completed = observations.filter((o) => o.completed);
  const completions = completed.length;

  const withPrompt = completed.filter((o) => o.promptUsed).length;
  const contextMatched = completed.filter((o) => o.contextMatch).length;
  const efforts = completed.filter((o) => o.effort !== undefined).map((o) => o.effort as number);

  return {
    completions,
    attempts,
    completionRate: rate(completions, attempts),
    contextMatchRate: rate(contextMatched, completions),
    selfInitiationRate: rate(completions - withPrompt, completions),
    promptDependence: rate(withPrompt, completions),
    averageEffort:
      efforts.length > 0 ? efforts.reduce((a, b) => a + b, 0) / efforts.length : null,
  };
}
