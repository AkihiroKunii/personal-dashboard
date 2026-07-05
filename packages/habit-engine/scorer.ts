import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { pComplete } from './successModel';
import type { DayOfWeek, HabitSpec, LadderStep, Observation, TimeWindow } from './types';
import type { CandidateSlot } from './windows';

// 効用スコア(habit-algorithm.md §5):
// U(s,w) = α·P_complete + β·C_cue + γ·F_preference + δ·G_gap − ε·B_burden − ζ·K_conflict
// 各項は 0..1 に正規化し、係数(config.weights)で重み付けする。

export interface ScoreContext {
  spec: HabitSpec;
  step: LadderStep;
  history: Observation[];
  /** この習慣の週の残り必要回数 / 週目標(0..1、大きいほど不足) */
  gap: number;
  /** すでに割り当てた (day,windowId) の集合。衝突判定に使う */
  occupied: Set<string>;
  /** その日にすでに入っている通知数(B_burden 用) */
  notificationsOnDay: number;
  config?: EngineConfig;
}

/** 選好適合 F_preference: 時間帯エネルギー + preferredContexts 一致 */
export function preferenceScore(spec: HabitSpec, window: TimeWindow): number {
  const energy = window.energy ?? 0.5;
  const preferred = spec.preferredContexts.includes(window.id) ? 1 : 0;
  return Math.min(1, 0.6 * energy + 0.4 * preferred);
}

/** 負荷 B_burden: 通知混雑 + 短い窓に大きいステップを詰める負担 */
export function burdenScore(step: LadderStep, window: TimeWindow, notificationsOnDay: number): number {
  const notifyLoad = Math.min(1, notificationsOnDay / 3);
  const fit = window.minutes > 0 ? Math.min(1, step.minutes / window.minutes) : 1;
  return Math.min(1, 0.5 * notifyLoad + 0.5 * fit);
}

export function slotKey(day: DayOfWeek, windowId: string): string {
  return `${day}|${windowId}`;
}

/** 単一の候補スロット×ステップの効用を返す */
export function scoreSlot(slot: CandidateSlot, ctx: ScoreContext): number {
  const cfg = ctx.config ?? DEFAULT_CONFIG;
  const w = cfg.weights;

  const p = pComplete(ctx.spec, ctx.step, slot.window.id, ctx.history);
  const cue = cfg.cueQuality[slot.anchor.type];
  const pref = preferenceScore(ctx.spec, slot.window);
  const gap = ctx.gap;
  const burden = burdenScore(ctx.step, slot.window, ctx.notificationsOnDay);
  // 同一 (day,window) が既に埋まっていれば強い衝突。ステップ分数が窓を超えても衝突扱い
  const overlap = ctx.occupied.has(slotKey(slot.day, slot.window.id)) ? 1 : 0;
  const overload = ctx.step.minutes > slot.window.minutes ? 0.5 : 0;
  const conflict = Math.min(1, overlap + overload);

  return (
    w.pComplete * p +
    w.cue * cue +
    w.preference * pref +
    w.gap * gap -
    w.burden * burden -
    w.conflict * conflict
  );
}
