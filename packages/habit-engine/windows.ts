import type { ContextAnchor, DayOfWeek, HabitSpec, TimeWindow, UserProfile } from './types';

// 候補スロット展開と cue(手がかり)生成(habit-algorithm.md §2/§5)。
// cue の優先順位: event-based > location-based > time-based。

export const WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 時間窓から ContextAnchor を作る。anchorEvent があれば event、なければ time */
export function anchorForWindow(w: TimeWindow): ContextAnchor {
  if (w.anchorEvent) {
    return { type: 'event', label: `${w.anchorEvent}に`, windowId: w.id };
  }
  return { type: 'time', label: w.label, windowId: w.id };
}

export interface CandidateSlot {
  habitId: string;
  day: DayOfWeek;
  window: TimeWindow;
  anchor: ContextAnchor;
}

/**
 * 習慣ごとに (曜日 × 使える時間窓) の候補スロットを列挙する。
 * 窓が使える曜日のみ、かつ preferredContexts があればそれを優先(全滅を避けるため他窓も候補に残す)。
 */
export function candidateSlots(spec: HabitSpec, user: UserProfile): CandidateSlot[] {
  const slots: CandidateSlot[] = [];
  for (const w of user.availableWindows) {
    for (const day of w.days) {
      slots.push({ habitId: spec.id, day, window: w, anchor: anchorForWindow(w) });
    }
  }
  return slots;
}
