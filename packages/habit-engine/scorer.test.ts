import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalize';
import { buildLadder } from './ladder';
import { DEFAULT_CONFIG } from './config';
import { scoreSlot } from './scorer';
import type { CandidateSlot } from './windows';
import type { TimeWindow } from './types';

const spec = canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 5, id: 'h1' });
const ladder = buildLadder(spec);

const window: TimeWindow = { id: 'w1', label: '朝', days: ['Mon'], minutes: 20, energy: 0.8 };

function slot(anchorType: 'event' | 'location' | 'time'): CandidateSlot {
  return {
    habitId: 'h1',
    day: 'Mon',
    window,
    anchor: { type: anchorType, label: 'x', windowId: 'w1' },
  };
}

const baseCtx = {
  spec,
  step: ladder.minimal,
  history: [],
  gap: 1,
  occupied: new Set<string>(),
  notificationsOnDay: 0,
};

describe('scorer(§5 効用 U)', () => {
  it('cue品質は event > location > time', () => {
    const e = scoreSlot(slot('event'), baseCtx);
    const l = scoreSlot(slot('location'), baseCtx);
    const t = scoreSlot(slot('time'), baseCtx);
    expect(e).toBeGreaterThan(l);
    expect(l).toBeGreaterThan(t);
  });

  it('週目標との差分(gap)が大きいほど効用が上がる', () => {
    const high = scoreSlot(slot('event'), { ...baseCtx, gap: 1 });
    const low = scoreSlot(slot('event'), { ...baseCtx, gap: 0.2 });
    expect(high).toBeGreaterThan(low);
  });

  it('既に埋まったスロット(衝突)は効用が下がる', () => {
    const free = scoreSlot(slot('event'), baseCtx);
    const conflicted = scoreSlot(slot('event'), {
      ...baseCtx,
      occupied: new Set(['Mon|w1']),
    });
    expect(conflicted).toBeLessThan(free);
  });

  it('係数を変えると効用が変わる(感度確認 §5)', () => {
    const cueHeavy = { ...DEFAULT_CONFIG, weights: { ...DEFAULT_CONFIG.weights, cue: 3 } };
    const withHeavy = scoreSlot(slot('event'), { ...baseCtx, config: cueHeavy });
    const withDefault = scoreSlot(slot('event'), baseCtx);
    expect(withHeavy).toBeGreaterThan(withDefault);
  });
});
