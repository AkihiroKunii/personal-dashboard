import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { buildLadder } from './ladder';
import { scoreSlot, slotKey } from './scorer';
import type {
  DayOfWeek,
  HabitSpec,
  HabitState,
  LadderStep,
  Observation,
  PlanAssignment,
  UserProfile,
  WeeklyPlan,
} from './types';
import { candidateSlots, WEEK } from './windows';

// 週間計画生成(habit-algorithm.md §5)。制約付き割当を greedy + local repair で解く。
// 厳密最適化は不要(§5)。制約: 週目標頻度・最小間隔日数・1日の最大負荷・1日の最大通知数。

export interface GenerateOptions {
  config?: EngineConfig;
  /** (habitId|contextKey)→HabitState。難度(採用ステップ)を段階から決める。無指定はコールドスタート */
  states?: Record<string, HabitState>;
}

interface Working {
  assignments: PlanAssignment[];
  occupied: Set<string>;
  /** habitId → 割当済み曜日index配列 */
  daysByHabit: Map<string, number[]>;
  dayLoad: Map<DayOfWeek, number>;
  dayNotifications: Map<DayOfWeek, number>;
}

function dayIndex(day: DayOfWeek): number {
  return WEEK.indexOf(day);
}

/** §6: 新規(状態なし)は必ず initiate=最小実行単位。状態があれば段階に応じて昇降 */
function stepForStage(state: HabitState | undefined, ladder: ReturnType<typeof buildLadder>): LadderStep {
  switch (state?.stage) {
    case 'scale':
      return ladder.stretch;
    case 'stabilize':
    case 'maintain':
      return ladder.standard;
    case 'recover':
      return ladder.recovery;
    default:
      return ladder.minimal; // initiate / 状態なし
  }
}

/** 同一習慣を候補日に置けるか。既割当日との差が minIntervalDays 以内なら不可(同日重複も防ぐ) */
function violatesInterval(days: number[], candidate: number, minIntervalDays: number): boolean {
  return days.some((d) => Math.abs(d - candidate) <= minIntervalDays);
}

export function generatePlan(
  user: UserProfile,
  specs: HabitSpec[],
  history: Observation[] = [],
  opts: GenerateOptions = {},
): WeeklyPlan {
  const cfg = opts.config ?? DEFAULT_CONFIG;
  const ladders = new Map(specs.map((s) => [s.id, buildLadder(s)]));
  const specById = new Map(specs.map((s) => [s.id, s]));

  const work: Working = {
    assignments: [],
    occupied: new Set(),
    daysByHabit: new Map(specs.map((s) => [s.id, []])),
    dayLoad: new Map(),
    dayNotifications: new Map(),
  };

  const remaining = (spec: HabitSpec) =>
    spec.targetFrequencyPerWeek - (work.daysByHabit.get(spec.id)?.length ?? 0);

  const stepFor = (spec: HabitSpec, windowId: string, forceMinimal: boolean): LadderStep => {
    const ladder = ladders.get(spec.id)!;
    if (forceMinimal) return ladder.minimal;
    return stepForStage(opts.states?.[`${spec.id}|${windowId}`], ladder);
  };

  // 1回の割当を試みる。best を採用したら true
  const assignOnce = (forceMinimal: boolean): boolean => {
    let best: { slot: ReturnType<typeof candidateSlots>[number]; step: LadderStep; score: number } | null =
      null;

    for (const spec of specs) {
      const need = remaining(spec);
      if (need <= 0) continue;
      const gap = need / spec.targetFrequencyPerWeek;
      const usedDays = work.daysByHabit.get(spec.id)!;

      for (const slot of candidateSlots(spec, user)) {
        const key = slotKey(slot.day, slot.window.id);
        if (work.occupied.has(key)) continue; // 1文脈スロットに1活動(K_conflict をハード制約に)
        const di = dayIndex(slot.day);
        if (violatesInterval(usedDays, di, spec.constraints.minIntervalDays)) continue;

        const step = stepFor(spec, slot.window.id, forceMinimal);
        const load = work.dayLoad.get(slot.day) ?? 0;
        if (load + step.minutes > cfg.maxDailyLoadMinutes) continue;

        const score = scoreSlot(slot, {
          spec,
          step,
          history,
          gap,
          occupied: work.occupied,
          notificationsOnDay: work.dayNotifications.get(slot.day) ?? 0,
          config: cfg,
        });
        if (!best || score > best.score) best = { slot, step, score };
      }
    }

    if (!best) return false;

    const { slot, step } = best;
    const spec = specById.get(slot.habitId)!;
    // 通知: event cue があればそれが手がかり(通知不要)。time anchor のみ通知を付け、1日上限を厳守(§8)
    const dayNotif = work.dayNotifications.get(slot.day) ?? 0;
    const notify = slot.anchor.type === 'time' && dayNotif < user.maxNotificationsPerDay;

    work.assignments.push({
      habitId: spec.id,
      step,
      windowId: slot.window.id,
      anchor: slot.anchor,
      day: slot.day,
      notify,
    });
    work.occupied.add(slotKey(slot.day, slot.window.id));
    work.daysByHabit.get(spec.id)!.push(dayIndex(slot.day));
    work.dayLoad.set(slot.day, (work.dayLoad.get(slot.day) ?? 0) + step.minutes);
    if (notify) work.dayNotifications.set(slot.day, dayNotif + 1);
    return true;
  };

  // greedy: 効用最大の割当を、可能な限り繰り返す
  while (assignOnce(false)) {
    /* keep assigning */
  }
  // local repair: 週目標未達の習慣を最小実行単位に落として追加で埋める
  while (specs.some((s) => remaining(s) > 0) && assignOnce(true)) {
    /* repair */
  }

  const recoverySteps: Record<string, LadderStep> = {};
  for (const spec of specs) recoverySteps[spec.id] = ladders.get(spec.id)!.recovery;

  const notificationsByDay = Object.fromEntries(
    WEEK.map((d) => [d, work.dayNotifications.get(d) ?? 0]),
  ) as Record<DayOfWeek, number>;

  // 曜日順・窓順で安定ソート(出力の決定性)
  work.assignments.sort(
    (a, b) => dayIndex(a.day) - dayIndex(b.day) || a.windowId.localeCompare(b.windowId),
  );

  return { assignments: work.assignments, recoverySteps, notificationsByDay };
}
