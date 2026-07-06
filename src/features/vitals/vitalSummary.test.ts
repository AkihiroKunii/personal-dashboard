import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../core/db';
import { loadLatestVitals } from './vitalSummary';

beforeEach(async () => {
  await db.dailyMetrics.clear();
  await db.sleepRecords.clear();
  await db.settings.clear();
});

describe('loadLatestVitals(今日の値 vs 直近平均)', () => {
  it('最新値と、それを除いた直近平均を返す', async () => {
    // steps を数日分(最新を除いた平均が比較基準)
    const days: Array<[string, number]> = [
      ['2026-06-30', 6000],
      ['2026-07-01', 8000],
      ['2026-07-02', 7000],
      ['2026-07-03', 9000], // 最新
    ];
    await db.dailyMetrics.bulkPut(
      days.map(([date, value]) => ({ metric: 'steps', date, source: '', value })),
    );

    const summary = await loadLatestVitals();
    expect(summary.steps?.value).toBe(9000);
    expect(summary.steps?.date).toBe('2026-07-03');
    // 平均は最新(9000)を除く 6000/8000/7000 = 7000
    expect(summary.steps?.average).toBeCloseTo(7000, 5);
    expect(summary.steps?.baselineDays).toBe(3);
  });

  it('データが1点だけなら average は undefined(比較なし)', async () => {
    await db.dailyMetrics.put({ metric: 'restingHr', date: '2026-07-03', source: '', value: 54 });
    const summary = await loadLatestVitals();
    expect(summary.restingHr?.value).toBe(54);
    expect(summary.restingHr?.average).toBeUndefined();
  });

  it('欠測しかない指標は undefined', async () => {
    const summary = await loadLatestVitals();
    expect(summary.hrvSdnn).toBeUndefined();
  });
});
