import { describe, expect, it } from 'vitest';
import {
  addDays,
  enumerateDates,
  jstDateOf,
  jstHourOf,
  parseHealthKitDate,
  parseIsoWithOffset,
} from './dates';

describe('dates(Asia/Tokyo固定・端末TZ非依存)', () => {
  it('ISOオフセット付き日時をパースする', () => {
    expect(parseIsoWithOffset('2026-07-04T09:00:00+09:00')).toBe(
      Date.UTC(2026, 6, 4, 0, 0, 0),
    );
  });

  it('HealthKit形式の日時をパースする', () => {
    expect(parseHealthKitDate('2026-07-03 07:44:00 +0900')).toBe(
      Date.UTC(2026, 6, 2, 22, 44, 0),
    );
    expect(() => parseHealthKitDate('2026/07/03')).toThrow();
  });

  it('JSTの暦日・時刻を返す', () => {
    const ms = parseIsoWithOffset('2026-07-04T23:30:00+09:00');
    expect(jstDateOf(ms)).toBe('2026-07-04');
    expect(jstHourOf(ms)).toBe(23);
    // UTCでは前日でもJSTでは当日
    const early = parseIsoWithOffset('2026-07-04T01:00:00+09:00');
    expect(jstDateOf(early)).toBe('2026-07-04');
  });

  it('日付演算', () => {
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(enumerateDates('2026-06-29', '2026-07-01')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
    ]);
  });
});
