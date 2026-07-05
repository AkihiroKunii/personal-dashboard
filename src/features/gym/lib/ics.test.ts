import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildProgramIcs } from './ics';
import { parseProgramContent } from './programSchema';

const program = parseProgramContent(readFileSync('docs/samples/program_sample.json', 'utf8'));

/** 折り返しを解除して論理行に戻す */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n[ \t]/g, '').split('\r\n').filter(Boolean);
}

describe('ics生成(G-F7)', () => {
  const ics = buildProgramIcs(program);
  const lines = unfold(ics);

  it('VCALENDAR/VTIMEZONE(Asia/Tokyo)を含む', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    expect(lines).toContain('TZID:Asia/Tokyo');
  });

  it('4週間分: 週次イベント4件 + トレ日イベント12件', () => {
    expect(lines.filter((l) => l.startsWith('UID:') && l.includes('-week@')).length).toBe(4);
    expect(lines.filter((l) => l.startsWith('UID:') && l.includes('-day@')).length).toBe(12);
  });

  it('トレ日イベントはAsia/Tokyoの07:00開始で通知(VALARM)付き', () => {
    expect(lines).toContain('DTSTART;TZID=Asia/Tokyo:20260706T070000');
    expect(lines).toContain('DTEND;TZID=Asia/Tokyo:20260706T071500');
    expect(lines.filter((l) => l === 'BEGIN:VALARM').length).toBe(12);
  });

  it('週次イベントは月曜の終日イベント', () => {
    expect(lines).toContain('DTSTART;VALUE=DATE:20260706');
    expect(lines).toContain('DTSTART;VALUE=DATE:20260713');
  });

  it('UIDは決定的(同一入力→同一出力で購読側の重複を防ぐ)', () => {
    expect(buildProgramIcs(program)).toBe(ics);
    expect(lines).toContain('UID:2026-07-06-day@personal-dashboard');
  });

  it('テキストのエスケープと75オクテット折り返し', () => {
    const p2 = {
      ...program,
      weeklySchedule: [
        {
          dayOfWeek: 'Mon' as const,
          focus: 'a,b;c',
          exercises: [
            { name: 'とても長い種目名のエクササイズをたくさん並べて折り返しを確認する', sets: 5, reps: '10' },
          ],
        },
      ],
    };
    const out = buildProgramIcs(p2);
    expect(unfold(out).join('\n')).toContain('SUMMARY:ジム: a\\,b\\;c');
    // 生の行はすべて75オクテット以内
    const encoder = new TextEncoder();
    for (const raw of out.split('\r\n')) {
      expect(encoder.encode(raw).length).toBeLessThanOrEqual(75);
    }
  });
});
