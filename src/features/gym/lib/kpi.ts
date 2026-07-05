import type {
  BodyMetricRow,
  ExerciseRow,
  GymSetRow,
  MuscleGroup,
  ProgramContent,
  ProteinDayRow,
} from '../../../core/types';
import { scheduledDates } from './programSchema';
import { epleyE1rm } from './stats';

// KPIサマリー(G-F10)とコーチング用エクスポート(G-F11)の集計。純関数。

/** トレ実施率: プログラムの予定日のうち、何らかのセット記録がある日の割合 */
export function adherence(
  program: ProgramContent,
  sets: GymSetRow[],
  from: string,
  to: string,
): { scheduled: number; done: number; rate: number | null } {
  const planned = scheduledDates(program, from, to);
  const trainedDates = new Set(sets.map((s) => s.date));
  const done = planned.filter((d) => trainedDates.has(d)).length;
  return {
    scheduled: planned.length,
    done,
    rate: planned.length > 0 ? done / planned.length : null,
  };
}

/** 期間内の部位別セット数 */
export function setsByMuscleGroup(
  sets: GymSetRow[],
  exercisesById: Map<number, ExerciseRow>,
): Map<MuscleGroup, number> {
  const counts = new Map<MuscleGroup, number>();
  for (const s of sets) {
    const group = exercisesById.get(s.exerciseId)?.muscleGroup;
    if (!group) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return counts;
}

export interface E1rmChange {
  exerciseId: number;
  setCount: number;
  /** 期間内の最初の測定日のe1RM日次最大 */
  first: { date: string; value: number };
  /** 期間内の最後の測定日のe1RM日次最大 */
  last: { date: string; value: number };
}

/** 種目ごとのe1RM変化(期間内の最初の日 vs 最後の日)。記録数降順 */
export function e1rmChanges(sets: GymSetRow[]): E1rmChange[] {
  const byExercise = new Map<number, GymSetRow[]>();
  for (const s of sets) {
    byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
  }
  const changes: E1rmChange[] = [];
  for (const [exerciseId, exSets] of byExercise) {
    const byDate = new Map<string, number>();
    for (const s of exSets) {
      const v = epleyE1rm(s.weightKg, s.reps);
      byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, v));
    }
    const dates = [...byDate.keys()].sort();
    const firstDate = dates[0];
    const lastDate = dates.at(-1)!;
    changes.push({
      exerciseId,
      setCount: exSets.length,
      first: { date: firstDate, value: byDate.get(firstDate)! },
      last: { date: lastDate, value: byDate.get(lastDate)! },
    });
  }
  return changes.sort((a, b) => b.setCount - a.setCount);
}

/** タンパク質達成率(記録がある日のみ分母ではなく、期間の記録日数と達成日数を返す) */
export function proteinSummary(
  days: ProteinDayRow[],
  from: string,
  to: string,
): { recorded: number; achieved: number; rate: number | null } {
  const inRange = days.filter((d) => d.date >= from && d.date <= to);
  const achieved = inRange.filter((d) => d.achieved).length;
  return {
    recorded: inRange.length,
    achieved,
    rate: inRange.length > 0 ? achieved / inRange.length : null,
  };
}

/** ボディ指標の期間内の最初と最後 */
export function bodyMetricChange(
  rows: BodyMetricRow[],
): Map<string, { first: BodyMetricRow; last: BodyMetricRow }> {
  const byMetric = new Map<string, BodyMetricRow[]>();
  for (const r of rows) {
    byMetric.set(r.metric, [...(byMetric.get(r.metric) ?? []), r]);
  }
  const out = new Map<string, { first: BodyMetricRow; last: BodyMetricRow }>();
  for (const [metric, list] of byMetric) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    out.set(metric, { first: list[0], last: list.at(-1)! });
  }
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface CoachingSummaryInput {
  period: { from: string; to: string };
  programName?: string;
  exercisesById: Map<number, ExerciseRow>;
  sets: GymSetRow[];
  program?: ProgramContent;
  bodyRows: BodyMetricRow[];
  proteinDays: ProteinDayRow[];
  /** 期間内の睡眠時間(時間)の平均。①未取込ならundefined */
  sleepAvgHours?: number;
}

/** コーチングセッションに持ち込むサマリー(G-F11)。JSONとテキストの両方を返す */
export function buildCoachingSummary(input: CoachingSummaryInput): {
  json: Record<string, unknown>;
  text: string;
} {
  const { period, exercisesById } = input;
  const changes = e1rmChanges(input.sets).map((c) => ({
    exercise: exercisesById.get(c.exerciseId)?.name ?? `種目${c.exerciseId}`,
    sets: c.setCount,
    e1rmStart: round1(c.first.value),
    e1rmEnd: round1(c.last.value),
    e1rmDelta: round1(c.last.value - c.first.value),
    firstDate: c.first.date,
    lastDate: c.last.date,
  }));
  const volume = Object.fromEntries(setsByMuscleGroup(input.sets, exercisesById));
  const adh = input.program
    ? adherence(input.program, input.sets, period.from, period.to)
    : null;
  const protein = proteinSummary(input.proteinDays, period.from, period.to);
  const body = Object.fromEntries(
    [...bodyMetricChange(input.bodyRows)].map(([metric, { first, last }]) => [
      metric,
      { start: first.value, end: last.value, startDate: first.date, endDate: last.date },
    ]),
  );

  const json = {
    generatedFor: 'coaching-session',
    period,
    programName: input.programName ?? null,
    e1rm: changes,
    setsByMuscleGroup: volume,
    adherence: adh,
    protein,
    bodyMetrics: body,
    sleepAvgHours: input.sleepAvgHours !== undefined ? round1(input.sleepAvgHours) : null,
  };

  const pct = (r: number | null) => (r === null ? '記録なし' : `${Math.round(r * 100)}%`);
  const text = [
    `# トレーニングサマリー(${period.from}〜${period.to})`,
    input.programName ? `プログラム: ${input.programName}` : null,
    '',
    '## e1RM変化(Epley・日次最大)',
    ...(changes.length > 0
      ? changes.map(
          (c) =>
            `- ${c.exercise}: ${c.e1rmStart}kg → ${c.e1rmEnd}kg(${c.e1rmDelta >= 0 ? '+' : ''}${c.e1rmDelta}kg、${c.sets}セット)`,
        )
      : ['- 記録なし']),
    '',
    '## 部位別セット数',
    ...(Object.keys(volume).length > 0
      ? Object.entries(volume).map(([g, n]) => `- ${g}: ${n}セット`)
      : ['- 記録なし']),
    '',
    `## トレ実施率: ${adh ? `${pct(adh.rate)}(予定${adh.scheduled}日中${adh.done}日)` : 'プログラムなし'}`,
    `## タンパク質達成率: ${pct(protein.rate)}(記録${protein.recorded}日中${protein.achieved}日達成)`,
    '',
    '## ボディ記録',
    ...(Object.keys(body).length > 0
      ? Object.entries(body).map(
          ([m, v]) => `- ${m}: ${v.start} → ${v.end}(${v.startDate}〜${v.endDate})`,
        )
      : ['- 記録なし']),
    '',
    `## 睡眠: ${input.sleepAvgHours !== undefined ? `平均${round1(input.sleepAvgHours)}時間/日` : 'データなし'}`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

  return { json, text };
}
