import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDailyExportJson } from '../import/parsers/dailyJson';
import type { SleepRecordRow } from '../types';
import {
  buildSessions,
  dailySleepBySource,
  dailyStageMinutesBySource,
  sessionDateOf,
} from './sleepSessions';

const sampleJson = readFileSync('docs/samples/daily_export_sample.json', 'utf8');

function rec(start: string, end: string, stage: SleepRecordRow['stage'], source = ''): SleepRecordRow {
  return { source, start: Date.parse(start), end: Date.parse(end), stage };
}

describe('睡眠セッション(連続セッション単位・起床日基準 §1.4)', () => {
  it('帰属日はセッション開始時刻で決める(正午前→その日、正午以降→翌日)', () => {
    expect(sessionDateOf(Date.parse('2026-07-04T00:49:04+09:00'))).toBe('2026-07-04');
    expect(sessionDateOf(Date.parse('2026-07-04T11:59:59+09:00'))).toBe('2026-07-04');
    expect(sessionDateOf(Date.parse('2026-07-04T12:00:00+09:00'))).toBe('2026-07-05');
    expect(sessionDateOf(Date.parse('2026-07-04T23:12:00+09:00'))).toBe('2026-07-05');
  });

  it('実サンプルの正午またぎ睡眠が1セッションに束なり、起床日7/4に帰属する', () => {
    const { sleepRecords } = parseDailyExportJson(sampleJson);
    const sessions = buildSessions(sleepRecords);
    expect(sessions).toHaveLength(1);
    const s = sessions[0];
    expect(s.date).toBe('2026-07-04');
    // 00:49開始・14:03終了(正午をまたぐ)
    expect(new Date(s.start).toISOString()).toBe('2026-07-03T15:49:04.000Z');
    expect(new Date(s.end).toISOString()).toBe('2026-07-04T05:03:54.000Z');
    // 実睡眠時間 = Awake除外。レコードは重複しないため単純合算と一致するはず
    const expectedMinutes = sleepRecords
      .filter((r) => r.stage !== 'awake' && r.stage !== 'inBed')
      .reduce((acc, r) => acc + (r.end - r.start) / 60_000, 0);
    expect(s.asleepMinutes).toBeCloseTo(expectedMinutes, 5);
    // セッション全長(約13.2時間)よりAwake分だけ短い
    expect(s.asleepMinutes).toBeLessThan((s.end - s.start) / 60_000 - 3 * 60 + 60);
  });

  it('ステージ別分数: core/deep/rem の合計が実睡眠時間と一致、awake/inBedは睡眠に含めない', () => {
    const { sleepRecords } = parseDailyExportJson(sampleJson);
    const [s] = buildSessions(sleepRecords);
    const sm = s.stageMinutes;
    // サンプルは core/rem/awake のみ(deep もあり)。睡眠算入ステージの合計 ≒ asleepMinutes
    expect(sm.core + sm.deep + sm.rem + sm.asleep).toBeCloseTo(s.asleepMinutes, 5);
    expect(sm.awake).toBeGreaterThan(0); // Awake は記録されるが
    // 各ステージは実レコードの合算と一致
    const sumStage = (stage: SleepRecordRow['stage']) =>
      sleepRecords
        .filter((r) => r.stage === stage)
        .reduce((acc, r) => acc + (r.end - r.start) / 60_000, 0);
    expect(sm.deep).toBeCloseTo(sumStage('deep'), 5);
    expect(sm.rem).toBeCloseTo(sumStage('rem'), 5);
  });

  it('dailyStageMinutesBySource は帰属日×ソースでステージ別に集計する', () => {
    const records = [
      rec('2026-07-04T01:00:00+09:00', '2026-07-04T02:00:00+09:00', 'deep', 'A'),
      rec('2026-07-04T02:00:00+09:00', '2026-07-04T03:00:00+09:00', 'core', 'A'),
      rec('2026-07-04T03:00:00+09:00', '2026-07-04T03:30:00+09:00', 'awake', 'A'),
    ];
    const bySource = dailyStageMinutesBySource(records).get('2026-07-04')!.get('A')!;
    expect(bySource.deep).toBe(60);
    expect(bySource.core).toBe(60);
    expect(bySource.awake).toBe(30);
    expect(bySource.rem).toBe(0);
  });

  it('隙間が閾値を超えるとセッションが分割される', () => {
    const records = [
      rec('2026-07-04T01:00:00+09:00', '2026-07-04T06:00:00+09:00', 'core'),
      // 31分の隙間 → 別セッション(昼寝)
      rec('2026-07-04T13:00:00+09:00', '2026-07-04T13:30:00+09:00', 'core'),
    ];
    const sessions = buildSessions(records);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].date).toBe('2026-07-04'); // 夜間分
    expect(sessions[1].date).toBe('2026-07-05'); // 正午以降開始→翌日扱い
  });

  it('30分以内の隙間は同一セッションに束ねる', () => {
    const records = [
      rec('2026-07-04T01:00:00+09:00', '2026-07-04T03:00:00+09:00', 'core'),
      rec('2026-07-04T03:20:00+09:00', '2026-07-04T06:00:00+09:00', 'rem'),
    ];
    expect(buildSessions(records)).toHaveLength(1);
  });

  it('InBedが実睡眠区間と重なっても二重計上しない(XML実データのSOXAIパターン)', () => {
    const records = [
      rec('2026-07-03T02:14:00+09:00', '2026-07-03T08:14:00+09:00', 'inBed', 'SOXAI RING'),
      rec('2026-07-03T07:44:00+09:00', '2026-07-03T07:58:00+09:00', 'core', 'SOXAI RING'),
      rec('2026-07-03T07:58:00+09:00', '2026-07-03T08:11:00+09:00', 'rem', 'SOXAI RING'),
      rec('2026-07-03T08:11:00+09:00', '2026-07-03T08:15:00+09:00', 'awake', 'SOXAI RING'),
    ];
    const sessions = buildSessions(records);
    expect(sessions).toHaveLength(1);
    // InBed(6時間)は除外され、core 14分 + rem 13分 = 27分のみ
    expect(sessions[0].asleepMinutes).toBe(27);
    expect(sessions[0].date).toBe('2026-07-03');
  });

  it('ソースが異なるレコードは別セッション・別集計になる', () => {
    const records = [
      rec('2026-07-04T01:00:00+09:00', '2026-07-04T06:00:00+09:00', 'core', 'A'),
      rec('2026-07-04T01:10:00+09:00', '2026-07-04T05:00:00+09:00', 'core', 'B'),
    ];
    const byDate = dailySleepBySource(records);
    const bySource = byDate.get('2026-07-04')!;
    expect(bySource.get('A')).toBe(300);
    expect(bySource.get('B')).toBe(230);
  });
});
