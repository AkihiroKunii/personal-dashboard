import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSessions } from '../../health/sleepSessions';
import { HealthXmlAggregator } from './appleHealthXml';

const excerpt = readFileSync('docs/samples/export_xml_excerpt.xml', 'utf8');

/** チャンク境界がタグをまたぐ状況を再現するため、小さいチャンクで流し込む */
function aggregate(text: string, chunkSize: number): HealthXmlAggregator {
  const agg = new HealthXmlAggregator();
  for (let i = 0; i < text.length; i += chunkSize) {
    agg.push(text.slice(i, i + chunkSize));
  }
  return agg;
}

describe('Apple標準export.xmlストリーミングパーサ(V-F3b)', () => {
  it('実抜粋(整形式でないXML)をチャンク処理でパースできる', () => {
    const result = aggregate(excerpt, 1000).finish();

    // 睡眠40件(コメントで明記)がすべて取り込まれる
    expect(result.sleepRecords).toHaveLength(40);
    // ソース名のNBSPが正規化されている
    const sources = new Set(result.sleepRecords.map((r) => r.source));
    expect(sources).toContain('USER’s Apple Watch');
    expect(sources).toContain('SOXAI RING');
    for (const s of sources) expect(s).not.toMatch(/\u00a0/);

    // InBed は保持されるが(データモデル拡張余地)、ステージは正準enum
    const stages = new Set(result.sleepRecords.map((r) => r.stage));
    expect(stages).toContain('inBed');
    expect(stages).toContain('core');

    const byMetric = new Map<string, typeof result.dailyMetrics>();
    for (const r of result.dailyMetrics) {
      byMetric.set(r.metric, [...(byMetric.get(r.metric) ?? []), r]);
    }
    // 安静時心拍: 10日分(1日1件)
    expect(byMetric.get('restingHr')).toHaveLength(10);
    const resting625 = byMetric.get('restingHr')!.find((r) => r.date === '2026-06-25');
    expect(resting625?.value).toBe(52);

    // 心拍数: 全15件が7/5 → 1行に日次要約される
    expect(byMetric.get('heartRate')).toHaveLength(1);
    expect(byMetric.get('heartRate')![0]).toMatchObject({
      date: '2026-07-05',
      min: 53,
      max: 64,
    });

    // HRV: 7/2〜7/5 の4日分(日×ソースで平均)
    expect(byMetric.get('hrvSdnn')).toHaveLength(4);

    // 歩数: 日×ソースで合算(合算はソース内のみ。ソース間は表示時に優先選択)
    const steps = byMetric.get('steps')!;
    const soxai0702 = steps.find((r) => r.source === 'SOXAI RING' && r.date === '2026-07-02');
    expect(soxai0702?.value).toBe(458 + 1221 + 202 + 395);
    const watch0704 = steps.find(
      (r) => r.source === 'USER’s Apple Watch' && r.date === '2026-07-04',
    );
    expect(watch0704?.value).toBe(8 + 238 + 6 + 319);
  });

  it('チャンクサイズに依存せず同じ結果になる(タグ境界またぎの検証)', () => {
    const a = aggregate(excerpt, 7).finish();
    const b = aggregate(excerpt, 64 * 1024).finish();
    expect(a.sleepRecords).toEqual(b.sleepRecords);
    expect(a.dailyMetrics.length).toBe(b.dailyMetrics.length);
  });

  it('未知のレコード型・未知の睡眠ステージ値は無視する(寛容設計 §1.4)', () => {
    const xml = `
      <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="X" startDate="2026-07-01 08:00:00 +0900" endDate="2026-07-01 08:00:00 +0900" value="60"/>
      <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="X" startDate="2026-07-01 01:00:00 +0900" endDate="2026-07-01 02:00:00 +0900" value="HKCategoryValueSleepAnalysis新種"/>
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="X" startDate="2026-07-01 09:00:00 +0900" endDate="2026-07-01 10:00:00 +0900" value="100"/>
    `;
    const agg = new HealthXmlAggregator();
    agg.push(xml);
    const result = agg.finish();
    expect(result.dailyMetrics).toHaveLength(1);
    expect(result.dailyMetrics[0]).toMatchObject({ metric: 'steps', value: 100 });
    expect(result.sleepRecords).toHaveLength(0);
    expect(result.warnings.join()).toContain('新種');
  });

  it('XMLの睡眠はInBedを実睡眠時間から除外する(セッション計算と結合)', () => {
    const result = aggregate(excerpt, 4096).finish();
    const soxai = result.sleepRecords.filter((r) => r.source === 'SOXAI RING');
    const sessions = buildSessions(soxai);
    expect(sessions).toHaveLength(1);
    // InBed 02:14〜08:14(360分)は除外。core 14分 + rem 13分 = 27分
    expect(sessions[0].asleepMinutes).toBe(27);
    expect(sessions[0].date).toBe('2026-07-03');
  });

  it('Apple Watchの正午またぎセッション(7/4)が日次JSONと同じ帰属になる', () => {
    const result = aggregate(excerpt, 4096).finish();
    const watch = result.sleepRecords.filter((r) => r.source === 'USER’s Apple Watch');
    const sessions = buildSessions(watch);
    // 7/3朝のセッションと、7/4の正午またぎセッション
    expect(sessions.map((s) => s.date)).toEqual(['2026-07-03', '2026-07-04']);
  });
});
