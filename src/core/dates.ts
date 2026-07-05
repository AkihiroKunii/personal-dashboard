// 日付処理は Asia/Tokyo 固定(REQUIREMENTS §1.4)。
// 端末TZに依存しないよう、epoch + 9h を UTC として読むことでJSTの暦日を得る。

const JST_OFFSET_MS = 9 * 3600_000;

/** epoch ms → JSTの日付文字列 YYYY-MM-DD */
export function jstDateOf(epochMs: number): string {
  return new Date(epochMs + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** epoch ms → JSTの時(0〜23) */
export function jstHourOf(epochMs: number): number {
  return new Date(epochMs + JST_OFFSET_MS).getUTCHours();
}

/** YYYY-MM-DD に日数を加算 */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** from〜to(両端含む)の日付列 */
export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  return dates;
}

export function todayJst(): string {
  return jstDateOf(Date.now());
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** YYYY-MM-DD の曜日(プログラムJSONの dayOfWeek 表記と同じ英3文字) */
export function dowOf(date: string): (typeof DAYS_OF_WEEK)[number] {
  return DAYS_OF_WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** ISO 8601(オフセット付き。例 2026-07-04T23:12:00+09:00)→ epoch ms */
export function parseIsoWithOffset(s: string): number {
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`日時を解釈できません: ${s}`);
  return t;
}

/** HealthKitエクスポート形式(例 2026-07-03 07:44:00 +0900)→ epoch ms */
export function parseHealthKitDate(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(
    s.trim(),
  );
  if (!m) throw new Error(`HealthKit日時を解釈できません: ${s}`);
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  const offsetMs = (+m[8] * 60 + +m[9]) * 60_000 * (m[7] === '-' ? -1 : 1);
  return utc - offsetMs;
}
