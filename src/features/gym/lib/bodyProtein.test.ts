import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../core/db';
import {
  getProteinDay,
  latestBodyMetric,
  loadBodySeries,
  recordBodyMetric,
  toggleProtein,
} from './bodyProtein';

beforeEach(async () => {
  await db.bodyMetrics.clear();
  await db.proteinDays.clear();
});

describe('ボディ記録(G-F8)', () => {
  it('同一 metric+date は上書き(冪等)、系列は欠測nullで全日返す', async () => {
    await recordBodyMetric('weight', '2026-07-06', 68.5);
    await recordBodyMetric('weight', '2026-07-06', 68.2); // 上書き
    await recordBodyMetric('weight', '2026-07-08', 68.0);
    expect(await db.bodyMetrics.count()).toBe(2);

    const series = await loadBodySeries('weight', '2026-07-06', '2026-07-08');
    expect(series.map((p) => p.value)).toEqual([68.2, null, 68.0]);
  });

  it('latestBodyMetricは最新日の値を返す', async () => {
    await recordBodyMetric('chest', '2026-07-01', 100);
    await recordBodyMetric('chest', '2026-07-20', 101);
    expect((await latestBodyMetric('chest'))?.value).toBe(101);
    expect(await latestBodyMetric('waist')).toBeUndefined();
  });
});

describe('タンパク質トグル(G-F9)', () => {
  it('未記録→達成→未達→未記録を循環する', async () => {
    const d = '2026-07-06';
    expect(await getProteinDay(d)).toBeUndefined();
    await toggleProtein(d);
    expect(await getProteinDay(d)).toMatchObject({ achieved: true });
    await toggleProtein(d);
    expect(await getProteinDay(d)).toMatchObject({ achieved: false });
    await toggleProtein(d);
    expect(await getProteinDay(d)).toBeUndefined();
  });
});
