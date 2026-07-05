import { DEFAULT_CONFIG, type EngineConfig } from './config';
import type { HabitState, Observation, Stage } from './types';

// 状態遷移(habit-algorithm.md §6)。applyObservation(state, obs) → HabitState。
// momentum は減衰付き累積(未実行1回でゼロにしない)。stage は5段階。

export function initialState(habitId: string, contextKey: string): HabitState {
  return {
    habitId,
    contextKey,
    stage: 'initiate',
    momentum: 0,
    completionRate7: 0,
    completionRate14: 0,
    promptDependence: 0,
    selfInitiationRate: 0,
    consecutiveMisses: 0,
    recoveryStage: 0,
  };
}

/** 直近 n 件の観測(新しい順ではなく時系列)から完了率を出す */
function completionRate(history: Observation[], n: number): number {
  const recent = history.slice(-n);
  if (recent.length === 0) return 0;
  return recent.filter((o) => o.completed).length / recent.length;
}

function avgEffort(history: Observation[], n: number): number {
  const recent = history.slice(-n).filter((o) => o.completed && o.effort !== undefined);
  if (recent.length === 0) return 2;
  return recent.reduce((acc, o) => acc + (o.effort ?? 2), 0) / recent.length;
}

/**
 * 次段階を決める(§6)。history はこの (habitId, contextKey) の時系列(obs を含む)。
 * initiate → stabilize → scale → maintain、異常時 recover。
 */
function nextStage(
  current: Stage,
  history: Observation[],
  consecutiveMisses: number,
  selfInitiationRate: number,
  cfg: EngineConfig,
): Stage {
  const th = cfg.thresholds;
  // recover 突入は全段階から優先(未実行の連続)
  if (consecutiveMisses >= th.recoverConsecutiveMisses) return 'recover';

  const rate14 = completionRate(history, 14);
  const rate7 = completionRate(history, 7);
  const effort = avgEffort(history, 14);

  switch (current) {
    case 'recover':
      // 復帰: 直近が回復したら initiate から積み直す
      return rate7 >= th.stabilizeCompletion ? 'stabilize' : 'initiate';
    case 'initiate':
      return rate14 >= th.stabilizeCompletion && history.length >= 5 ? 'stabilize' : 'initiate';
    case 'stabilize':
      if (rate7 < th.downgradeCompletion) return 'initiate';
      return rate14 >= th.scaleCompletion && effort <= th.scaleEffortMax ? 'scale' : 'stabilize';
    case 'scale':
      if (rate7 < th.downgradeCompletion) return 'stabilize';
      return selfInitiationRate >= th.maintainSelfInitiation ? 'maintain' : 'scale';
    case 'maintain':
      // 崩れたら scale に戻して支援を復活
      return rate7 < th.downgradeCompletion ? 'scale' : 'maintain';
    default:
      return current;
  }
}

/**
 * 1つの観測を状態へ反映する。history は当該 (habitId, contextKey) の過去観測(obs は含まない)。
 * 純粋関数: 新しい HabitState を返す。
 */
export function applyObservation(
  state: HabitState,
  obs: Observation,
  history: Observation[] = [],
  config: EngineConfig = DEFAULT_CONFIG,
): HabitState {
  const fullHistory = [...history, obs];

  const momentum = config.momentumDecay * state.momentum + (obs.completed ? 1 : 0);
  const consecutiveMisses = obs.completed ? 0 : state.consecutiveMisses + 1;

  const completedObs = fullHistory.filter((o) => o.completed);
  const promptDependence =
    completedObs.length > 0
      ? completedObs.filter((o) => o.promptUsed).length / completedObs.length
      : 0;
  const selfInitiationRate = completedObs.length > 0 ? 1 - promptDependence : 0;

  const stage = nextStage(
    state.stage,
    fullHistory,
    consecutiveMisses,
    selfInitiationRate,
    config,
  );

  // recover へ入った瞬間は介入stageを先頭に戻す。抜けたらリセット
  const recoveryStage =
    stage === 'recover'
      ? state.stage === 'recover'
        ? state.recoveryStage
        : 0
      : 0;

  return {
    ...state,
    stage,
    momentum,
    completionRate7: completionRate(fullHistory, 7),
    completionRate14: completionRate(fullHistory, 14),
    promptDependence,
    selfInitiationRate,
    consecutiveMisses,
    recoveryStage,
  };
}
