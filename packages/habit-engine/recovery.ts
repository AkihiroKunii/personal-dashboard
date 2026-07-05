import type { HabitState, PlanLadder } from './types';

// 失敗回復の介入順序(habit-algorithm.md §7)。
// recover 状態では固定順で提示する(問題は motivation 欠如とは限らず、
// ability・cue・負荷のミスマッチが多いため)。
// §8: v1では choose_daily_intervention はルールベースのみ。bandit分岐はインターフェースだけ切る。

export type InterventionKind =
  | 'recovery-unit'
  | 'reduce-difficulty'
  | 'redesign-cue'
  | 'reconnect-why';

/** §7 の固定順序 */
export const INTERVENTION_ORDER: InterventionKind[] = [
  'recovery-unit',
  'reduce-difficulty',
  'redesign-cue',
  'reconnect-why',
];

export interface Intervention {
  kind: InterventionKind;
  message: string;
  /** recovery-unit のとき提示する実行単位 */
  recoveryStep?: PlanLadder['recovery'];
}

/** 介入選択の戦略。v1は 'rule' のみ実装。'bandit' は将来フェーズ用のインターフェース */
export type InterventionStrategy = 'rule' | 'bandit';

// 観察ベースの文言(評価ではなく観察、自己批判を誘発しない。§7)
function messageFor(kind: InterventionKind, ladder?: PlanLadder): string {
  switch (kind) {
    case 'recovery-unit':
      return ladder
        ? `まずは「${ladder.recovery.label}」だけ試してみましょう`
        : '最小の再接続だけ試してみましょう';
    case 'reduce-difficulty':
      return '実行単位を一段小さくして、続けやすさを優先しましょう';
    case 'redesign-cue':
      return 'いつ・どこで行うかの手がかり(アンカー)を選び直しましょう';
    case 'reconnect-why':
      return 'この活動を続けたい理由を、もう一度確認しましょう';
  }
}

/**
 * recover 状態の日次介入を選ぶ(§7の順序を state.recoveryStage で進める)。
 * v1は 'rule' 戦略のみ。'bandit' は未実装(将来フェーズ)でインターフェースだけ用意。
 */
export function chooseDailyIntervention(
  state: HabitState,
  ladder?: PlanLadder,
  strategy: InterventionStrategy = 'rule',
): Intervention | null {
  if (state.stage !== 'recover') return null;
  if (strategy === 'bandit') {
    // 将来フェーズ: contextual bandit による選択。v1では未実装のためルールにフォールバック
  }
  const idx = Math.min(state.recoveryStage, INTERVENTION_ORDER.length - 1);
  const kind = INTERVENTION_ORDER[idx];
  return {
    kind,
    message: messageFor(kind, ladder),
    recoveryStep: kind === 'recovery-unit' ? ladder?.recovery : undefined,
  };
}

/** 介入後、次回に進める recoveryStage を返す(未実行が続いたら次の介入へ) */
export function advanceRecovery(state: HabitState): number {
  return Math.min(state.recoveryStage + 1, INTERVENTION_ORDER.length - 1);
}
