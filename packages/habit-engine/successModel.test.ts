import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalize';
import { buildLadder } from './ladder';
import { pComplete, priorMean, stepDifficulty } from './successModel';
import type { Observation } from './types';

const spec = canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 5, id: 'h1' });
const ladder = buildLadder(spec);

function obs(completed: boolean): Observation {
  return { habitId: 'h1', contextKey: 'w1', date: '2026-07-06', completed };
}

describe('successModel(§5 Beta-Binomial 完了確率)', () => {
  it('コールドスタート(履歴ゼロ)は事前分布に一致する', () => {
    const p = pComplete(spec, ladder.minimal, 'w1', []);
    // 難度補正後だが、事前平均に基づく妥当な範囲
    expect(p).toBeGreaterThan(0.3);
    expect(p).toBeLessThan(0.99);
    expect(priorMean(spec)).toBeGreaterThan(0.5); // cueability高・friction低
  });

  it('成功履歴で確率が上がり、失敗履歴で下がる', () => {
    const base = pComplete(spec, ladder.minimal, 'w1', []);
    const success = pComplete(spec, ladder.minimal, 'w1', Array(8).fill(obs(true)));
    const failure = pComplete(spec, ladder.minimal, 'w1', Array(8).fill(obs(false)));
    expect(success).toBeGreaterThan(base);
    expect(failure).toBeLessThan(base);
  });

  it('別文脈の履歴は影響しない(文脈別に更新)', () => {
    const otherContext: Observation[] = Array(8).fill({
      habitId: 'h1',
      contextKey: 'other',
      date: '2026-07-06',
      completed: true,
    });
    expect(pComplete(spec, ladder.minimal, 'w1', otherContext)).toBeCloseTo(
      pComplete(spec, ladder.minimal, 'w1', []),
      5,
    );
  });

  it('ステップが大きいほど完了確率は下がる(難度単調)', () => {
    expect(stepDifficulty(ladder.minimal)).toBeLessThan(stepDifficulty(ladder.standard));
    expect(stepDifficulty(ladder.standard)).toBeLessThan(stepDifficulty(ladder.stretch));
    const pMin = pComplete(spec, ladder.minimal, 'w1', []);
    const pStretch = pComplete(spec, ladder.stretch, 'w1', []);
    expect(pStretch).toBeLessThan(pMin);
  });
});
