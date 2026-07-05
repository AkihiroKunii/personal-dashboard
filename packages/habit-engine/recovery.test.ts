import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalize';
import { buildLadder } from './ladder';
import { advanceRecovery, chooseDailyIntervention, INTERVENTION_ORDER } from './recovery';
import { initialState } from './observation';
import type { HabitState } from './types';

const ladder = buildLadder(canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 5, id: 'h1' }));

function recoverState(recoveryStage: number): HabitState {
  return { ...initialState('h1', 'w1'), stage: 'recover', recoveryStage };
}

describe('recovery(§7 失敗回復の介入順序)', () => {
  it('recover以外では介入なし', () => {
    expect(chooseDailyIntervention(initialState('h1', 'w1'), ladder)).toBeNull();
  });

  it('固定順で進む: 復旧単位→難度縮小→cue再設計→why再接続', () => {
    expect(chooseDailyIntervention(recoverState(0), ladder)?.kind).toBe('recovery-unit');
    expect(chooseDailyIntervention(recoverState(1), ladder)?.kind).toBe('reduce-difficulty');
    expect(chooseDailyIntervention(recoverState(2), ladder)?.kind).toBe('redesign-cue');
    expect(chooseDailyIntervention(recoverState(3), ladder)?.kind).toBe('reconnect-why');
    expect(INTERVENTION_ORDER).toHaveLength(4);
  });

  it('復旧単位の介入はラダーの recovery ステップを提示する', () => {
    const iv = chooseDailyIntervention(recoverState(0), ladder);
    expect(iv?.recoveryStep).toEqual(ladder.recovery);
  });

  it('advanceRecoveryは末尾で頭打ちになる', () => {
    expect(advanceRecovery(recoverState(0))).toBe(1);
    expect(advanceRecovery(recoverState(3))).toBe(3);
  });

  it('bandit戦略は未実装でルールにフォールバックする(インターフェースのみ)', () => {
    expect(chooseDailyIntervention(recoverState(0), ladder, 'bandit')?.kind).toBe('recovery-unit');
  });
});
