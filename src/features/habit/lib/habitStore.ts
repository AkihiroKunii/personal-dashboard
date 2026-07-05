import {
  applyObservation,
  buildLadder,
  canonicalize,
  chooseDailyIntervention,
  generatePlan,
  initialState,
  reviewMetrics,
  type Effort,
  type HabitSpec,
  type HabitState,
  type Intervention,
  type LadderStep,
  type Observation,
  type PlanAssignment,
  type ReviewMetrics,
  type StepKind,
  type TimeWindow,
  type UserProfile,
  type WeeklyPlan,
} from '../../../../packages/habit-engine';
import { db } from '../../../core/db';
import { addDays, dowOf, todayJst } from '../../../core/dates';
import type { HabitPlanRow, StoredObservation } from '../../../core/habitTypes';
import { currentWeekStart } from './week';

// habit-engine(純粋関数)と IndexedDB の橋渡し。UIはこの層とdbのuseLiveQueryを使う。

const PROFILE_KEY = 'habitProfile';

/** 初回に提案する時間窓(§0.5「設定は一度きり」。空のときのみ・編集可) */
const SAMPLE_WINDOWS: TimeWindow[] = [
  { id: 'breakfast', label: '朝食後', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], minutes: 20, anchorEvent: '朝食後', energy: 0.8, hour: 8 },
  { id: 'evening', label: '帰宅後', days: ['Mon', 'Wed', 'Fri'], minutes: 30, anchorEvent: '帰宅後', energy: 0.6, hour: 19 },
  { id: 'bedtime', label: '就寝前', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], minutes: 10, anchorEvent: '就寝前', energy: 0.4, hour: 22 },
];

export async function seedWindowsIfEmpty(): Promise<void> {
  await db.transaction('rw', db.habitWindows, async () => {
    if ((await db.habitWindows.count()) === 0) {
      await db.habitWindows.bulkAdd(SAMPLE_WINDOWS);
    }
  });
}

export async function getUserProfile(): Promise<UserProfile> {
  const [windows, profile] = await Promise.all([
    db.habitWindows.toArray(),
    db.settings.get(PROFILE_KEY),
  ]);
  const p = (profile?.value ?? {}) as { maxNotificationsPerDay?: number; values?: string[] };
  return {
    availableWindows: windows,
    maxNotificationsPerDay: p.maxNotificationsPerDay ?? 2,
    values: p.values ?? [],
  };
}

// --- 活動登録 / 編集(H-F1, H-F2) ---

export interface RegisterInput {
  activity: string;
  targetFrequencyPerWeek: number;
  preferredContexts?: string[];
  why?: string;
}

export async function registerActivity(input: RegisterInput): Promise<HabitSpec> {
  if (!input.activity.trim()) throw new Error('活動名を入力してください');
  // 永続化のため安定IDを付与(canonicalize のモジュール採番はリロードで衝突しうる)
  const id = `habit-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const spec = canonicalize({ ...input, activity: input.activity.trim(), id });
  await db.transaction('rw', db.habitSpecs, db.habitLadders, async () => {
    await db.habitSpecs.put(spec);
    await db.habitLadders.put(buildLadder(spec));
  });
  return spec;
}

export async function updateSpec(
  id: string,
  patch: Partial<Pick<HabitSpec, 'targetFrequencyPerWeek' | 'preferredContexts' | 'why'>>,
): Promise<void> {
  await db.habitSpecs.update(id, patch);
}

export async function updateLadderStep(
  habitId: string,
  kind: StepKind,
  patch: Partial<Pick<LadderStep, 'label' | 'minutes'>>,
): Promise<void> {
  const ladder = await db.habitLadders.get(habitId);
  if (!ladder) return;
  await db.habitLadders.put({ ...ladder, [kind]: { ...ladder[kind], ...patch } });
}

/** 記録がある活動は削除不可(整合性優先、③に倣う) */
export async function deleteActivity(id: string): Promise<void> {
  const used = await db.habitObservations.where('habitId').equals(id).count();
  if (used > 0) throw new Error(`記録が${used}件あるため削除できません`);
  await db.transaction('rw', db.habitSpecs, db.habitLadders, db.habitStates, async () => {
    await db.habitSpecs.delete(id);
    await db.habitLadders.delete(id);
    await db.habitStates.where('habitId').equals(id).delete();
  });
}

// --- 時間窓(H-F1「使える文脈」) ---

export async function saveWindow(win: TimeWindow): Promise<void> {
  await db.habitWindows.put(win);
}

export async function deleteWindow(id: string): Promise<void> {
  await db.habitWindows.delete(id);
}

// --- 週間計画(H-F3) ---

export async function generateWeeklyPlan(weekStart = currentWeekStart()): Promise<WeeklyPlan> {
  const [user, specs, observations, states] = await Promise.all([
    getUserProfile(),
    db.habitSpecs.toArray(),
    db.habitObservations.toArray(),
    db.habitStates.toArray(),
  ]);
  const statesMap: Record<string, HabitState> = {};
  for (const s of states) statesMap[`${s.habitId}|${s.contextKey}`] = s;
  const plan = generatePlan(user, specs, observations as Observation[], { states: statesMap });
  await db.habitPlans.put({ weekStart, plan, generatedAt: Date.now() });
  return plan;
}

export async function getPlan(weekStart = currentWeekStart()): Promise<HabitPlanRow | undefined> {
  return db.habitPlans.get(weekStart);
}

/** 今日の曜日の割当(なければ空配列) */
export async function todaysAssignments(): Promise<PlanAssignment[]> {
  const row = await getPlan(currentWeekStart());
  if (!row) return [];
  const dow = dowOf(todayJst());
  return row.plan.assignments.filter((a) => a.day === dow);
}

// --- チェックイン + 状態更新(H-F4/F5) ---

/** その (habitId, contextKey) の全観測から状態を再計算して保存(取り消しにも対応) */
async function recomputeState(habitId: string, contextKey: string): Promise<HabitState | undefined> {
  const obs = await db.habitObservations
    .where('[habitId+contextKey]')
    .equals([habitId, contextKey])
    .sortBy('date');
  if (obs.length === 0) {
    await db.habitStates.delete([habitId, contextKey]);
    return undefined;
  }
  let state = initialState(habitId, contextKey);
  obs.forEach((o, i) => {
    state = applyObservation(state, o, obs.slice(0, i));
  });
  await db.habitStates.put(state);
  return state;
}

export interface CheckInInput {
  habitId: string;
  contextKey: string;
  completed: boolean;
  date?: string;
  effort?: Effort;
  contextMatch?: boolean;
  promptUsed?: boolean;
  stepKind?: StepKind;
}

export async function checkIn(input: CheckInInput): Promise<HabitState | undefined> {
  const date = input.date ?? todayJst();
  const obs: StoredObservation = {
    habitId: input.habitId,
    contextKey: input.contextKey,
    date,
    completed: input.completed,
    effort: input.effort,
    contextMatch: input.contextMatch,
    // 通知なし運用のため既定は自己開始(§4.4)
    promptUsed: input.promptUsed ?? false,
    stepKind: input.stepKind,
  };
  // 同一 (habit, context, date) の再チェックインは置き換え
  await db.habitObservations
    .where('[habitId+contextKey]')
    .equals([input.habitId, input.contextKey])
    .and((o) => o.date === date)
    .delete();
  await db.habitObservations.add(obs);
  return recomputeState(input.habitId, input.contextKey);
}

export async function undoCheckIn(habitId: string, contextKey: string, date = todayJst()): Promise<void> {
  await db.habitObservations
    .where('[habitId+contextKey]')
    .equals([habitId, contextKey])
    .and((o) => o.date === date)
    .delete();
  await recomputeState(habitId, contextKey);
}

/** 指定日・文脈の記録済み観測(チェックイン状態の表示用) */
export async function observationFor(
  habitId: string,
  contextKey: string,
  date = todayJst(),
): Promise<StoredObservation | undefined> {
  return db.habitObservations
    .where('[habitId+contextKey]')
    .equals([habitId, contextKey])
    .and((o) => o.date === date)
    .first();
}

// --- 失敗回復(H-F6) ---

export interface RecoveryItem {
  state: HabitState;
  activity: string;
  intervention: Intervention;
}

export async function getRecoveryInterventions(): Promise<RecoveryItem[]> {
  const states = await db.habitStates.toArray();
  const items: RecoveryItem[] = [];
  for (const s of states.filter((x) => x.stage === 'recover')) {
    const ladder = await db.habitLadders.get(s.habitId);
    const iv = chooseDailyIntervention(s, ladder);
    if (!iv) continue;
    const spec = await db.habitSpecs.get(s.habitId);
    items.push({ state: s, activity: spec?.activity ?? s.habitId, intervention: iv });
  }
  return items;
}

// --- 週次レビュー(H-F7) ---

export interface HabitReview {
  habitId: string;
  activity: string;
  metrics: ReviewMetrics;
  momentum: number;
  stage: HabitState['stage'];
}

export async function weeklyReview(): Promise<{ overall: ReviewMetrics; perHabit: HabitReview[] }> {
  const from = addDays(todayJst(), -6);
  const [observations, specs, states] = await Promise.all([
    db.habitObservations.filter((o) => o.date >= from).toArray(),
    db.habitSpecs.toArray(),
    db.habitStates.toArray(),
  ]);
  const byHabit = new Map<string, StoredObservation[]>();
  for (const o of observations) {
    byHabit.set(o.habitId, [...(byHabit.get(o.habitId) ?? []), o]);
  }
  const stateByHabit = new Map<string, HabitState>();
  for (const s of states) {
    // 活動あたりは最も momentum の高い文脈を代表にする
    const cur = stateByHabit.get(s.habitId);
    if (!cur || s.momentum > cur.momentum) stateByHabit.set(s.habitId, s);
  }
  const perHabit: HabitReview[] = specs
    .filter((spec) => byHabit.has(spec.id))
    .map((spec) => {
      const st = stateByHabit.get(spec.id);
      return {
        habitId: spec.id,
        activity: spec.activity,
        metrics: reviewMetrics(byHabit.get(spec.id)!),
        momentum: st?.momentum ?? 0,
        stage: st?.stage ?? 'initiate',
      };
    });
  return { overall: reviewMetrics(observations), perHabit };
}
