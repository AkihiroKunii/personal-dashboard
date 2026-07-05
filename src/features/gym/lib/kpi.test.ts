import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExerciseRow, GymSetRow } from '../../../core/types';
import { adherence, buildCoachingSummary, e1rmChanges, proteinSummary, setsByMuscleGroup } from './kpi';
import { parseProgramContent } from './programSchema';
import { epleyE1rm } from './stats';

const program = parseProgramContent(readFileSync('docs/samples/program_sample.json', 'utf8'));

function set(date: string, exerciseId: number, weightKg: number, reps: number): GymSetRow {
  return { exerciseId, at: Date.parse(`${date}T10:00:00+09:00`), date, weightKg, reps };
}

const exercisesById = new Map<number, ExerciseRow>([
  [1, { id: 1, name: 'ベンチプレス', muscleGroup: '胸' }],
  [2, { id: 2, name: 'スクワット', muscleGroup: '脚' }],
]);

describe('トレ実施率(G-F10)', () => {
  it('予定3日中2日実施 = 67%', () => {
    // 週の予定: 7/6(月) 7/8(水) 7/10(金)。実施は 7/6 と 7/10
    const sets = [set('2026-07-06', 1, 60, 10), set('2026-07-10', 2, 80, 8)];
    const a = adherence(program, sets, '2026-07-06', '2026-07-12');
    expect(a).toMatchObject({ scheduled: 3, done: 2 });
    expect(a.rate).toBeCloseTo(2 / 3, 5);
  });

  it('予定外の日の記録は分子に数えない', () => {
    const sets = [set('2026-07-07', 1, 60, 10)]; // 火曜(予定なし)
    expect(adherence(program, sets, '2026-07-06', '2026-07-12').done).toBe(0);
  });
});

describe('部位別セット数', () => {
  it('種目→部位で集計する', () => {
    const sets = [
      set('2026-07-06', 1, 60, 10),
      set('2026-07-06', 1, 62, 8),
      set('2026-07-10', 2, 80, 8),
    ];
    const counts = setsByMuscleGroup(sets, exercisesById);
    expect(counts.get('胸')).toBe(2);
    expect(counts.get('脚')).toBe(1);
  });
});

describe('e1RM変化', () => {
  it('期間内の最初の日と最後の日の日次最大e1RMを比較する', () => {
    const sets = [
      set('2026-07-06', 1, 60, 10),
      set('2026-07-06', 1, 65, 6),
      set('2026-07-20', 1, 70, 8),
    ];
    const [c] = e1rmChanges(sets);
    expect(c.first.value).toBeCloseTo(Math.max(epleyE1rm(60, 10), epleyE1rm(65, 6)), 5);
    expect(c.last).toMatchObject({ date: '2026-07-20' });
  });
});

describe('タンパク質達成率(G-F9)', () => {
  it('期間内の記録日と達成日を数える', () => {
    const days = [
      { date: '2026-07-06', achieved: true },
      { date: '2026-07-07', achieved: false },
      { date: '2026-07-08', achieved: true },
      { date: '2026-06-01', achieved: true }, // 期間外
    ];
    const s = proteinSummary(days, '2026-07-06', '2026-07-12');
    expect(s).toMatchObject({ recorded: 3, achieved: 2 });
    expect(s.rate).toBeCloseTo(2 / 3, 5);
  });

  it('記録なしはrate=null', () => {
    expect(proteinSummary([], '2026-07-06', '2026-07-12').rate).toBeNull();
  });
});

describe('コーチング用サマリー(G-F11)', () => {
  it('JSONとテキストに全要素が含まれる', () => {
    const { json, text } = buildCoachingSummary({
      period: { from: '2026-07-06', to: '2026-08-02' },
      programName: program.programName,
      exercisesById,
      sets: [set('2026-07-06', 1, 60, 10), set('2026-07-20', 1, 70, 8)],
      program,
      bodyRows: [
        { metric: 'weight', date: '2026-07-06', value: 68.5 },
        { metric: 'weight', date: '2026-07-27', value: 69.2 },
      ],
      proteinDays: [{ date: '2026-07-06', achieved: true }],
      sleepAvgHours: 7.23,
    });
    expect(json.programName).toBe(program.programName);
    expect((json.e1rm as unknown[]).length).toBe(1);
    expect(text).toContain('ベンチプレス');
    expect(text).toContain('68.5 → 69.2');
    expect(text).toContain('平均7.2時間');
    expect(text).toContain('トレ実施率');
  });
});
