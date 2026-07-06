import { enumerateDates } from '../../../core/dates';
import type { ProgramContent, ProgramDay } from '../../../core/types';
import { menuForDate } from './programSchema';

// プログラム → iCalendar 生成(G-F7)。純関数にしてあり、
// Viteビルド(GitHub Pagesへの固定URL配置)とアプリ内ダウンロードの両方から使う。
// イベント: (a) 各週の月曜に全体メニューの終日イベント、(b) 各トレ日 07:00-07:15 に当日メニュー。
// Googleカレンダーの購読はVALARMを無視することがあるため、通知は購読カレンダー側の
// 既定通知設定にも依存する(README参照)。

const TRAINING_EVENT_START = '070000';
const TRAINING_EVENT_END = '071500';

/** RFC5545のTEXTエスケープ */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 75オクテット制限の行折り返し(UTF-8のマルチバイト文字を分断しない) */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  const limit = 73; // 継続行の先頭スペース分の余裕を持たせる
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (bytes + chBytes > limit) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += chBytes;
  }
  out.push(current);
  return out.join('\r\n');
}

function dateBasic(date: string): string {
  return date.replace(/-/g, '');
}

function exerciseLines(day: ProgramDay): string {
  return day.exercises
    .map((e) => `${e.name} ${e.sets}×${e.reps}${e.note ? `(${e.note})` : ''}`)
    .join('\n');
}

function vevent(lines: string[]): string[] {
  return ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
}

/** プログラム全体のVCALENDAR文字列を生成する */
export function buildProgramIcs(program: ProgramContent): string {
  // DTSTAMPは決定的にする(同一プログラムからは同一icsが出る=購読側の無駄な更新を防ぐ)
  const dtstamp = `${dateBasic(program.validFrom)}T000000Z`;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//personal-dashboard//gym-program//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`ジム: ${program.programName}`)}`,
    'X-WR-TIMEZONE:Asia/Tokyo',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Tokyo',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:JST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const date of enumerateDates(program.validFrom, program.validUntil)) {
    const menu = menuForDate(program, date);

    // (a) 週初め(月曜)に今週の全体メニュー
    if (date.length > 0 && new Date(`${date}T00:00:00Z`).getUTCDay() === 1) {
      const weekSummary = program.weeklySchedule
        .map((d) => `${d.dayOfWeek} ${d.focus}: ${d.exercises.map((e) => e.name).join('、') || '(種目未定)'}`)
        .join('\n');
      lines.push(
        ...vevent([
          `UID:${date}-week@personal-dashboard`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${dateBasic(date)}`,
          `SUMMARY:${escapeText(`今週のトレーニング(${program.programName})`)}`,
          `DESCRIPTION:${escapeText(weekSummary)}`,
        ]),
      );
    }

    // (b) トレ日の朝: 当日メニュー(標準通知付き)
    if (menu) {
      lines.push(
        ...vevent([
          `UID:${date}-day@personal-dashboard`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;TZID=Asia/Tokyo:${dateBasic(date)}T${TRAINING_EVENT_START}`,
          `DTEND;TZID=Asia/Tokyo:${dateBasic(date)}T${TRAINING_EVENT_END}`,
          `SUMMARY:${escapeText(`ジム: ${menu.focus}`)}`,
          `DESCRIPTION:${escapeText(exerciseLines(menu) || menu.focus)}`,
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeText(`ジム: ${menu.focus}`)}`,
          'TRIGGER:PT0M',
          'END:VALARM',
        ]),
      );
    }
  }

  // (c) 有効期限日にコーチング改訂の予定(初期構想: 月1程度のプラン見直し)
  lines.push(
    ...vevent([
      `UID:${dateBasic(program.validUntil)}-coaching@personal-dashboard`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dateBasic(program.validUntil)}`,
      `SUMMARY:${escapeText('コーチングセッション: プランを更新')}`,
      `DESCRIPTION:${escapeText('Claudeとの対話でトレーニングプランを改訂する時期です。アプリの「コーチング用サマリーを出力」を持ち込みましょう。')}`,
    ]),
  );

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
