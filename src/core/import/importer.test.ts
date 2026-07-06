import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { loadMetricSeries, loadSleepSeries, loadSleepStageSeries } from '../health/dailySeries';
import { saveImportResult } from './importer';
import { HealthXmlAggregator } from './parsers/appleHealthXml';
import { parseDailyExportJson } from './parsers/dailyJson';

const sampleJson = readFileSync('docs/samples/daily_export_sample.json', 'utf8');
const excerptXml = readFileSync('docs/samples/export_xml_excerpt.xml', 'utf8');

function parseXml(text: string) {
  const agg = new HealthXmlAggregator();
  agg.push(text);
  return agg.finish();
}

beforeEach(async () => {
  await db.dailyMetrics.clear();
  await db.sleepRecords.clear();
  await db.settings.clear();
});

describe('冪等インポート(V-F3)', () => {
  it('同一JSONを2回取り込んでも件数が増えない', async () => {
    await saveImportResult(parseDailyExportJson(sampleJson));
    const metricCount = await db.dailyMetrics.count();
    const sleepCount = await db.sleepRecords.count();
    expect(metricCount).toBe(4);
    expect(sleepCount).toBe(34);

    await saveImportResult(parseDailyExportJson(sampleJson));
    expect(await db.dailyMetrics.count()).toBe(metricCount);
    expect(await db.sleepRecords.count()).toBe(sleepCount);
  });

  it('同一XMLを2回取り込んでも件数が増えない', async () => {
    await saveImportResult(parseXml(excerptXml));
    const metricCount = await db.dailyMetrics.count();
    const sleepCount = await db.sleepRecords.count();
    expect(sleepCount).toBe(40);

    await saveImportResult(parseXml(excerptXml));
    expect(await db.dailyMetrics.count()).toBe(metricCount);
    expect(await db.sleepRecords.count()).toBe(sleepCount);
  });

  it('Plan B(XML)→ Plan A(JSON)の順でも重複期間が二重計上されない(§1.5)', async () => {
    // 先にバックフィル、後から日次JSON(同じ7/4の夜のデータが両方に含まれる)
    await saveImportResult(parseXml(excerptXml));
    await saveImportResult(parseDailyExportJson(sampleJson));

    // 睡眠: 7/4 の夜は XML(Apple Watch)と JSON(空source)の両方にあるが、
    // 表示は優先ソース1本のみ採用するため二重計上されない
    const jsonOnlyDb = parseDailyExportJson(sampleJson);
    const expectedMinutes = jsonOnlyDb.sleepRecords
      .filter((r) => r.stage !== 'awake' && r.stage !== 'inBed')
      .reduce((acc, r) => acc + (r.end - r.start) / 60_000, 0);

    const series = await loadSleepSeries('2026-07-04', '2026-07-04', []);
    expect(series).toHaveLength(1);
    expect(series[0].value).toBeCloseTo(Math.round((expectedMinutes / 60) * 100) / 100, 2);

    // 歩数: 7/4 は XML(iPhon/Apple Watch)と JSON(5311)が併存するが、JSONの値のみ表示
    const steps = await loadMetricSeries('steps', '2026-07-04', '2026-07-04', []);
    expect(steps[0].value).toBe(5311);
  });

  it('優先ソース設定を変えると表示値が切り替わる(合算はされない)', async () => {
    await saveImportResult(parseXml(excerptXml));
    await saveImportResult(parseDailyExportJson(sampleJson));

    const withPriority = await loadMetricSeries(
      'steps',
      '2026-07-04',
      '2026-07-04',
      ['USER’s Apple Watch'],
    );
    expect(withPriority[0].value).toBe(8 + 238 + 6 + 319); // Apple Watchの7/4合算のみ

    const defaultPriority = await loadMetricSeries('steps', '2026-07-04', '2026-07-04', []);
    expect(defaultPriority[0].value).toBe(5311);
  });

  it('欠測日はnullになり、範囲全日が返る(チャートの欠測表現)', async () => {
    await saveImportResult(parseDailyExportJson(sampleJson));
    const series = await loadMetricSeries('steps', '2026-07-03', '2026-07-05', []);
    expect(series.map((p) => p.value)).toEqual([null, 5311, null]);
  });
});

describe('睡眠ステージ系列(§1.4 拡張)', () => {
  it('deep/core/rem/other の合計が合計睡眠時間と一致し、欠測日はnull', async () => {
    await saveImportResult(parseDailyExportJson(sampleJson));
    const stages = await loadSleepStageSeries('2026-07-03', '2026-07-05', []);
    // 7/4に帰属、前後はnull
    expect(stages.deep.map((p) => p.value === null)).toEqual([true, false, true]);

    const total = await loadSleepSeries('2026-07-04', '2026-07-04', []);
    const sum =
      (stages.deep[1].value ?? 0) +
      (stages.core[1].value ?? 0) +
      (stages.rem[1].value ?? 0) +
      (stages.other[1].value ?? 0);
    expect(sum).toBeCloseTo(total[0].value!, 1);
    expect(stages.deep[1].value).toBeGreaterThan(0);
  });

  it('優先ソース設定で1ソースのみ採用する(合算しない)', async () => {
    // XML(Apple Watch)とJSON(空source)が同じ夜を持つ。既定は日次エクスポート優先
    await saveImportResult(parseXml(excerptXml));
    await saveImportResult(parseDailyExportJson(sampleJson));
    const jsonOnlyHours =
      parseDailyExportJson(sampleJson)
        .sleepRecords.filter((r) => r.stage === 'deep')
        .reduce((acc, r) => acc + (r.end - r.start) / 60_000, 0) / 60;
    const stages = await loadSleepStageSeries('2026-07-04', '2026-07-04', []);
    // JSONソースのdeepのみ(XMLと合算していない)。表示は0.01時間丸めなので1桁で比較
    expect(stages.deep[0].value).toBeCloseTo(jsonOnlyHours, 1);
  });
});
