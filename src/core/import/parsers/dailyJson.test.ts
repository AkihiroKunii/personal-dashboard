import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDailyExportJson } from './dailyJson';

const sampleJson = readFileSync('docs/samples/daily_export_sample.json', 'utf8');

describe('日次エクスポートJSONパーサ(§1.3a schemaVersion 2)', () => {
  it('実サンプル(ショートカット実出力)をパースできる', () => {
    const result = parseDailyExportJson(sampleJson);
    expect(result.sleepRecords).toHaveLength(34);
    expect(result.dailyMetrics).toHaveLength(4); // steps, hrvSdnn, restingHr, heartRate

    const byMetric = new Map(result.dailyMetrics.map((r) => [r.metric, r]));
    expect(byMetric.get('steps')).toMatchObject({ date: '2026-07-04', source: '', value: 5311 });
    expect(byMetric.get('hrvSdnn')!.value).toBeCloseTo(44.947, 2);
    expect(byMetric.get('restingHr')!.value).toBe(54);
    expect(byMetric.get('heartRate')).toMatchObject({ min: 40, max: 125 });
    expect(byMetric.get('heartRate')!.value).toBeCloseTo(66.774, 2);

    // 空sourceの許容(実データはすべて空文字列)
    expect(result.sleepRecords.every((r) => r.source === '')).toBe(true);
    // ステージが正準enumにマッピングされている
    const stages = new Set(result.sleepRecords.map((r) => r.stage));
    expect([...stages].sort()).toEqual(['awake', 'core', 'deep', 'rem']);
  });

  it('クォート付き数値(ショートカットの仕様揺れ)を受理する', () => {
    const result = parseDailyExportJson(
      JSON.stringify({
        schemaVersion: '2',
        date: '2026-07-04',
        sleep: [],
        steps: '8421',
        hrvSdnn: '45.2',
        restingHr: '52',
        heartRate: { min: '47', max: '142', avg: '68' },
      }),
    );
    const byMetric = new Map(result.dailyMetrics.map((r) => [r.metric, r]));
    expect(byMetric.get('steps')!.value).toBe(8421);
    expect(byMetric.get('hrvSdnn')!.value).toBe(45.2);
    expect(byMetric.get('heartRate')).toMatchObject({ value: 68, min: 47, max: 142 });
  });

  it('schemaVersionが2以外なら拒否する(厳格バリデーション §1.4)', () => {
    expect(() => parseDailyExportJson(JSON.stringify({ schemaVersion: 1, date: '2026-07-04' })))
      .toThrow(/schemaVersion/);
    expect(() => parseDailyExportJson(JSON.stringify({ date: '2026-07-04' }))).toThrow(
      /schemaVersion/,
    );
  });

  it('不正なJSONやdate・未知ステージを拒否する', () => {
    expect(() => parseDailyExportJson('not json')).toThrow(/JSON/);
    expect(() =>
      parseDailyExportJson(JSON.stringify({ schemaVersion: 2, date: '7/4' })),
    ).toThrow(/date/);
    expect(() =>
      parseDailyExportJson(
        JSON.stringify({
          schemaVersion: 2,
          date: '2026-07-04',
          sleep: [
            { start: '2026-07-04T00:00:00+09:00', end: '2026-07-04T01:00:00+09:00', stage: '謎', source: '' },
          ],
        }),
      ),
    ).toThrow(/stage/);
  });

  it('sourceにNBSPが含まれていても正規化される', () => {
    const result = parseDailyExportJson(
      JSON.stringify({
        schemaVersion: 2,
        date: '2026-07-04',
        sleep: [
          {
            start: '2026-07-04T00:00:00+09:00',
            end: '2026-07-04T01:00:00+09:00',
            stage: 'Core',
            source: 'USER’s Apple\u00a0Watch',
          },
        ],
      }),
    );
    expect(result.sleepRecords[0].source).toBe('USER’s Apple Watch');
  });

  it('欠測指標はスキップして警告に載せる', () => {
    const result = parseDailyExportJson(
      JSON.stringify({ schemaVersion: 2, date: '2026-07-04', sleep: [], steps: 100 }),
    );
    expect(result.dailyMetrics).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
