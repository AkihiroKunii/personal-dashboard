import { describe, expect, it } from 'vitest';
import type { GymSetRow } from '../../../core/types';
import { dailyE1rmSeries, dailyWeightSeries, epleyE1rm, median } from './stats';

function set(date: string, weightKg: number, reps: number): GymSetRow {
  return { exerciseId: 1, at: Date.parse(`${date}T12:00:00+09:00`), date, weightKg, reps };
}

describe('median', () => {
  it('奇数個は中央値', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([5])).toBe(5);
  });
  it('偶数個は中央2値の平均', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([60, 80])).toBe(70);
  });
  it('空配列はエラー', () => {
    expect(() => median([])).toThrow();
  });
});

describe('epleyE1rm(G-F3b)', () => {
  it('Epley式: e1RM = 重量 × (1 + reps/30)', () => {
    expect(epleyE1rm(100, 10)).toBeCloseTo(133.333, 2);
    expect(epleyE1rm(60, 1)).toBeCloseTo(62, 5);
  });
});

describe('dailyWeightSeries(G-F3: 中央値+最低〜最高)', () => {
  it('同一日の複数セットで中央値・最小・最大が正しい(§2.5)', () => {
    const sets = [
      set('2026-07-06', 60, 10),
      set('2026-07-06', 70, 8),
      set('2026-07-06', 80, 6),
      set('2026-07-06', 100, 3),
    ];
    const [p] = dailyWeightSeries(sets, '2026-07-06', '2026-07-06');
    expect(p).toEqual({ date: '2026-07-06', value: 75, min: 60, max: 100 });
  });

  it('欠測日はnullで範囲全日を返す(G-F4)', () => {
    const sets = [set('2026-07-06', 60, 10)];
    const series = dailyWeightSeries(sets, '2026-07-05', '2026-07-07');
    expect(series.map((p) => p.value)).toEqual([null, 60, null]);
    expect(series.map((p) => p.date)).toEqual(['2026-07-05', '2026-07-06', '2026-07-07']);
  });
});

describe('dailyE1rmSeries(G-F3b)', () => {
  it('その日の最大e1RMを採用する', () => {
    const sets = [
      set('2026-07-06', 100, 10), // 133.3
      set('2026-07-06', 110, 2), // 117.3
      set('2026-07-06', 90, 12), // 126
    ];
    const [p] = dailyE1rmSeries(sets, '2026-07-06', '2026-07-06');
    expect(p.value).toBeCloseTo(epleyE1rm(100, 10), 5);
  });

  it('日ごとに独立して計算される', () => {
    const sets = [set('2026-07-06', 100, 5), set('2026-07-07', 102.5, 5)];
    const series = dailyE1rmSeries(sets, '2026-07-06', '2026-07-07');
    expect(series[0].value).toBeCloseTo(epleyE1rm(100, 5), 5);
    expect(series[1].value).toBeCloseTo(epleyE1rm(102.5, 5), 5);
  });
});
