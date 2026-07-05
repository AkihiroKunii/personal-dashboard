import { describe, expect, it } from 'vitest';
import { applyObservation, initialState } from './observation';
import type { Effort, HabitState, Observation } from './types';

function obs(
  date: string,
  completed: boolean,
  extra: Partial<Observation> = {},
): Observation {
  return { habitId: 'h1', contextKey: 'w1', date, completed, ...extra };
}

/** 観測列を順に畳み込む(history は都度、過去分を渡す) */
function fold(observations: Observation[]): { state: HabitState; states: HabitState[] } {
  let state = initialState('h1', 'w1');
  const states: HabitState[] = [];
  observations.forEach((o, i) => {
    state = applyObservation(state, o, observations.slice(0, i));
    states.push(state);
  });
  return { state, states };
}

describe('applyObservation(§6 状態遷移)', () => {
  it('momentumは減衰付き累積で、未実行1回でゼロにならない', () => {
    const observations = [obs('d1', true), obs('d2', true), obs('d3', false)];
    const { states } = fold(observations);
    expect(states[0].momentum).toBeCloseTo(1, 5);
    expect(states[1].momentum).toBeCloseTo(1.8, 5); // 0.8*1 + 1
    expect(states[2].momentum).toBeCloseTo(1.44, 5); // 0.8*1.8 + 0
    expect(states[2].momentum).toBeGreaterThan(0); // 未実行1回でゼロにしない
  });

  it('14日の完了(努力低・自己開始)で initiate→stabilize→scale→maintain と進む', () => {
    const days = Array.from({ length: 14 }, (_, i) =>
      obs(`d${i + 1}`, true, { effort: 1 as Effort, promptUsed: false, contextMatch: true }),
    );
    const { states, state } = fold(days);
    // 5件到達で stabilize、以降 scale→maintain
    expect(states[3].stage).toBe('initiate'); // 4件目まで
    expect(states[4].stage).toBe('stabilize'); // 5件目
    expect(states[5].stage).toBe('scale'); // 6件目
    expect(states[6].stage).toBe('maintain'); // 7件目(自己開始率高)
    expect(state.stage).toBe('maintain');
    expect(state.completionRate14).toBe(1);
    expect(state.selfInitiationRate).toBe(1);
  });

  it('未実行が3連続で recover に入る', () => {
    const { states } = fold([obs('d1', false), obs('d2', false), obs('d3', false)]);
    expect(states[0].stage).toBe('initiate');
    expect(states[1].stage).toBe('initiate');
    expect(states[2].stage).toBe('recover');
    expect(states[2].consecutiveMisses).toBe(3);
  });

  it('通知起点の完了は通知依存度に反映される', () => {
    const { state } = fold([
      obs('d1', true, { promptUsed: true }),
      obs('d2', true, { promptUsed: true }),
      obs('d3', true, { promptUsed: false }),
    ]);
    expect(state.promptDependence).toBeCloseTo(2 / 3, 5);
    expect(state.selfInitiationRate).toBeCloseTo(1 / 3, 5);
  });
});
