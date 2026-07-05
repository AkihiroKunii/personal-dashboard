import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalize';
import { generatePlan } from './scheduler';
import { WEEK } from './windows';
import type { PlanAssignment, TimeWindow, UserProfile } from './types';

// habit-algorithm.md §11 / REQUIREMENTS §4.5-2 の統合シナリオ:
// 「英語学習 週5 / 筋トレ 週3 / 家計記録 毎日」+ 時間窓
// (朝食後20分[平日] / 帰宅後30分[月水金] / 就寝前10分[毎日])。

const breakfast: TimeWindow = {
  id: 'breakfast',
  label: '朝食後',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  minutes: 20,
  anchorEvent: '朝食後',
  energy: 0.8,
  hour: 8,
};
const evening: TimeWindow = {
  id: 'evening',
  label: '帰宅後',
  days: ['Mon', 'Wed', 'Fri'],
  minutes: 30,
  anchorEvent: '帰宅後',
  energy: 0.6,
  hour: 19,
};
const bedtime: TimeWindow = {
  id: 'bedtime',
  label: '就寝前',
  days: [...WEEK],
  minutes: 10,
  anchorEvent: '就寝前',
  energy: 0.4,
  hour: 22,
};

const user: UserProfile = {
  values: ['成長', '健康', 'お金の管理'],
  maxNotificationsPerDay: 2,
  availableWindows: [breakfast, evening, bedtime],
};

const specs = [
  canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 5, id: 'english', preferredContexts: ['breakfast'], why: '海外で働く' }),
  canonicalize({ activity: '筋トレ', targetFrequencyPerWeek: 3, id: 'gym', preferredContexts: ['evening'], why: '体づくり' }),
  canonicalize({ activity: '家計記録', targetFrequencyPerWeek: 7, id: 'kakei', preferredContexts: ['bedtime'], why: 'お金の見える化' }),
];

const plan = generatePlan(user, specs, []);
const byHabit = (id: string): PlanAssignment[] => plan.assignments.filter((a) => a.habitId === id);

describe('サンプルシナリオ(§11 / §4.5-2)', () => {
  it('英語は平日の朝食後に週5・最小単位で入る', () => {
    const english = byHabit('english');
    expect(english).toHaveLength(5);
    expect(english.every((a) => a.windowId === 'breakfast')).toBe(true);
    expect(english.every((a) => a.step.kind === 'minimal')).toBe(true);
    expect(new Set(english.map((a) => a.day))).toEqual(
      new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']),
    );
  });

  it('筋トレは月水金の帰宅後に週3で入る', () => {
    const gym = byHabit('gym');
    expect(gym).toHaveLength(3);
    expect(gym.every((a) => a.windowId === 'evening')).toBe(true);
    expect(new Set(gym.map((a) => a.day))).toEqual(new Set(['Mon', 'Wed', 'Fri']));
  });

  it('家計記録は毎日、就寝前に入る', () => {
    const kakei = byHabit('kakei');
    expect(kakei).toHaveLength(7);
    expect(kakei.every((a) => a.windowId === 'bedtime')).toBe(true);
    expect(new Set(kakei.map((a) => a.day)).size).toBe(7);
  });

  it('各活動に recovery 単位が併記される', () => {
    expect(plan.recoverySteps['english'].kind).toBe('recovery');
    expect(plan.recoverySteps['gym'].kind).toBe('recovery');
    expect(plan.recoverySteps['kakei'].kind).toBe('recovery');
  });

  it('文脈衝突がない(同一 曜日×窓 に複数活動が入らない)', () => {
    const keys = plan.assignments.map((a) => `${a.day}|${a.windowId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('event cue を優先し、通知は初週2/日以内に収まる', () => {
    // すべて event アンカー(朝食後/帰宅後/就寝前)なので時刻通知は不要
    expect(plan.assignments.every((a) => a.anchor.type === 'event')).toBe(true);
    for (const day of WEEK) {
      expect(plan.notificationsByDay[day]).toBeLessThanOrEqual(user.maxNotificationsPerDay);
    }
  });

  it('1日の負荷が上限内(複数活動が重なる曜日でも)', () => {
    for (const day of WEEK) {
      const load = plan.assignments
        .filter((a) => a.day === day)
        .reduce((acc, a) => acc + a.step.minutes, 0);
      expect(load).toBeLessThanOrEqual(60);
    }
  });
});
