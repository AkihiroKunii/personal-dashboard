import { describe, expect, it } from 'vitest';
import { reviewMetrics } from './metrics';
import type { Observation } from './types';

function obs(completed: boolean, extra: Partial<Observation> = {}): Observation {
  return { habitId: 'h1', contextKey: 'w1', date: '2026-07-06', completed, ...extra };
}

describe('reviewMetrics(§9 週次レビュー指標)', () => {
  it('完了率・文脈一致率・自己開始率・通知依存度を集計する', () => {
    const m = reviewMetrics([
      obs(true, { contextMatch: true, promptUsed: false, effort: 1 }),
      obs(true, { contextMatch: false, promptUsed: true, effort: 2 }),
      obs(false),
    ]);
    expect(m.attempts).toBe(3);
    expect(m.completions).toBe(2);
    expect(m.completionRate).toBeCloseTo(2 / 3, 5);
    expect(m.contextMatchRate).toBeCloseTo(1 / 2, 5); // 完了2件中1件が文脈一致
    expect(m.selfInitiationRate).toBeCloseTo(1 / 2, 5);
    expect(m.promptDependence).toBeCloseTo(1 / 2, 5);
    expect(m.averageEffort).toBeCloseTo(1.5, 5);
  });

  it('記録なしは0/nullで安全に返す', () => {
    const m = reviewMetrics([]);
    expect(m.completionRate).toBe(0);
    expect(m.averageEffort).toBeNull();
  });
});
