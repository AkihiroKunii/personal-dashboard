import { addDays, jstDateOf, jstHourOf } from '../dates';
import type { SleepRecordRow } from '../types';
import { ASLEEP_STAGES } from './stageMap';

// 睡眠の帰属は「連続セッション単位・起床日基準」(§1.4 + ユーザー確認済み)。
// レコード単位の正午判定は禁止(正午をまたぐ実セッションが存在する)。

/** 隣接レコードを同一セッションに束ねる隙間の閾値 */
export const SESSION_GAP_MS = 30 * 60_000;

export interface SleepSession {
  source: string;
  start: number;
  end: number;
  /** 帰属日(YYYY-MM-DD)。起床日基準: 開始がJST正午前→その日、正午以降→翌日 */
  date: string;
  /** 実睡眠分数(InBed/Awake除外、区間の重複は二重計上しない) */
  asleepMinutes: number;
  records: SleepRecordRow[];
}

/** セッション開始時刻から帰属日を決める(起床日基準) */
export function sessionDateOf(startMs: number): string {
  const date = jstDateOf(startMs);
  return jstHourOf(startMs) < 12 ? date : addDays(date, 1);
}

/** 重複しうる区間群の合計分数(InBed等が実睡眠区間と重なっても二重計上しない) */
function unionMinutes(intervals: Array<[number, number]>): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = sorted[0];
  for (const [s, e] of sorted.slice(1)) {
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return total / 60_000;
}

/** ソースごとにレコードを連続セッションへ束ねる */
export function buildSessions(
  records: SleepRecordRow[],
  gapMs: number = SESSION_GAP_MS,
): SleepSession[] {
  const bySource = new Map<string, SleepRecordRow[]>();
  for (const r of records) {
    const list = bySource.get(r.source);
    if (list) list.push(r);
    else bySource.set(r.source, [r]);
  }

  const sessions: SleepSession[] = [];
  for (const [source, list] of bySource) {
    list.sort((a, b) => a.start - b.start);
    let current: SleepRecordRow[] = [];
    let currentEnd = -Infinity;
    const flush = () => {
      if (current.length === 0) return;
      const start = current[0].start;
      sessions.push({
        source,
        start,
        end: currentEnd,
        date: sessionDateOf(start),
        asleepMinutes: unionMinutes(
          current.filter((r) => ASLEEP_STAGES.has(r.stage)).map((r) => [r.start, r.end]),
        ),
        records: current,
      });
      current = [];
      currentEnd = -Infinity;
    };
    for (const r of list) {
      if (current.length > 0 && r.start - currentEnd > gapMs) flush();
      current.push(r);
      currentEnd = Math.max(currentEnd, r.end);
    }
    flush();
  }
  return sessions.sort((a, b) => a.start - b.start);
}

/** 帰属日 → ソース → 実睡眠分数(同日同ソースの複数セッションは合算) */
export function dailySleepBySource(records: SleepRecordRow[]): Map<string, Map<string, number>> {
  const byDate = new Map<string, Map<string, number>>();
  for (const s of buildSessions(records)) {
    let bySource = byDate.get(s.date);
    if (!bySource) byDate.set(s.date, (bySource = new Map()));
    bySource.set(s.source, (bySource.get(s.source) ?? 0) + s.asleepMinutes);
  }
  return byDate;
}
