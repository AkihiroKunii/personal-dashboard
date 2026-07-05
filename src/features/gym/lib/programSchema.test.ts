import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  inferMuscleGroup,
  looksLikeProgramJson,
  menuForDate,
  parseProgramContent,
  scheduledDates,
} from './programSchema';

const sampleText = readFileSync('docs/samples/program_sample.json', 'utf8');
const dailyText = readFileSync('docs/samples/daily_export_sample.json', 'utf8');

describe('プログラムJSONパース(§2.3a schemaVersion 1)', () => {
  it('サンプルをパースできる', () => {
    const p = parseProgramContent(sampleText);
    expect(p.programName).toBe('2026-07 筋肥大期 v1');
    expect(p.validFrom).toBe('2026-07-06');
    expect(p.weeklySchedule).toHaveLength(3);
    expect(p.weeklySchedule[0].exercises[0]).toMatchObject({
      name: 'ベンチプレス',
      sets: 3,
      reps: '8-10',
      note: '前回e1RMの75%目安',
    });
    // 空noteはundefinedに正規化
    expect(p.weeklySchedule[0].exercises[1].note).toBeUndefined();
    expect(p.nutritionTargets?.proteinGramsPerDay).toBe(140);
  });

  it('schemaVersionが1以外・不正な構造を拒否する', () => {
    expect(() => parseProgramContent(dailyText)).toThrow(/schemaVersion/);
    expect(() =>
      parseProgramContent(JSON.stringify({ schemaVersion: 1, programName: 'x' })),
    ).toThrow();
    expect(() =>
      parseProgramContent(
        JSON.stringify({
          schemaVersion: 1,
          programName: 'x',
          validFrom: '2026-07-06',
          validUntil: '2026-07-01',
          weeklySchedule: [{ dayOfWeek: 'Mon', focus: '', exercises: [] }],
        }),
      ),
    ).toThrow(/有効期間/);
  });

  it('looksLikeProgramJsonで日次エクスポートと判別できる', () => {
    expect(looksLikeProgramJson(sampleText)).toBe(true);
    expect(looksLikeProgramJson(dailyText)).toBe(false);
    expect(looksLikeProgramJson('not json')).toBe(false);
  });
});

describe('部位推定(未知種目の自動マスタ追加用)', () => {
  it('focus文字列から先勝ちで推定する', () => {
    expect(inferMuscleGroup('胸・三頭')).toBe('胸');
    expect(inferMuscleGroup('背中・二頭')).toBe('背中');
    expect(inferMuscleGroup('脚・肩')).toBe('脚');
    expect(inferMuscleGroup('三頭のみ')).toBe('腕');
    expect(inferMuscleGroup('腹筋')).toBe('コア');
    expect(inferMuscleGroup('全身')).toBe('胸');
  });
});

describe('メニューの日付解決', () => {
  const p = parseProgramContent(sampleText);

  it('曜日でメニューを引く(2026-07-06は月曜=胸・三頭)', () => {
    expect(menuForDate(p, '2026-07-06')?.focus).toBe('胸・三頭');
    expect(menuForDate(p, '2026-07-08')?.focus).toBe('背中・二頭');
    expect(menuForDate(p, '2026-07-07')).toBeUndefined(); // 火曜は予定なし
  });

  it('有効期間外はundefined', () => {
    expect(menuForDate(p, '2026-07-05')).toBeUndefined();
    expect(menuForDate(p, '2026-08-03')).toBeUndefined();
  });

  it('scheduledDatesは期間内の予定日を列挙する(4週間×週3=12日)', () => {
    expect(scheduledDates(p, '2026-07-06', '2026-08-02')).toHaveLength(12);
    expect(scheduledDates(p, '2026-07-06', '2026-07-12')).toEqual([
      '2026-07-06',
      '2026-07-08',
      '2026-07-10',
    ]);
  });
});
