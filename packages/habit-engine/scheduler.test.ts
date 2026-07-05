import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalize';
import { generatePlan } from './scheduler';
import type { TimeWindow, UserProfile } from './types';

const timeWindow = (id: string, days: TimeWindow['days'], minutes: number): TimeWindow => ({
  id,
  label: id,
  days,
  minutes,
});

describe('generatePlan(§5 週間計画生成)', () => {
  it('コールドスタートで週間計画を生成する(§4.5)', () => {
    const user: UserProfile = {
      values: [],
      maxNotificationsPerDay: 2,
      availableWindows: [timeWindow('morning', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 20)],
    };
    const specs = [canonicalize({ activity: '英語学習', targetFrequencyPerWeek: 3, id: 'h1' })];
    const plan = generatePlan(user, specs, []);
    expect(plan.assignments.length).toBe(3);
    expect(plan.recoverySteps['h1']).toBeDefined();
    // コールドスタートは最小実行単位(§6 initiate)
    expect(plan.assignments.every((a) => a.step.kind === 'minimal')).toBe(true);
  });

  it('同一(曜日×窓)に複数活動を割り当てない(K_conflict)', () => {
    const user: UserProfile = {
      values: [],
      maxNotificationsPerDay: 2,
      availableWindows: [timeWindow('slot', ['Mon', 'Tue', 'Wed'], 30)],
    };
    const specs = [
      canonicalize({ activity: '英語', targetFrequencyPerWeek: 3, id: 'h1' }),
      canonicalize({ activity: '家計', targetFrequencyPerWeek: 3, id: 'h2' }),
    ];
    const plan = generatePlan(user, specs, []);
    const keys = plan.assignments.map((a) => `${a.day}|${a.windowId}`);
    expect(new Set(keys).size).toBe(keys.length); // 重複なし
    // 窓は3日しかないので合計3枠、2活動で取り合い(週6目標だが枠上限3)
    expect(plan.assignments.length).toBe(3);
  });

  it('1日の通知上限(maxNotificationsPerDay)を厳守する', () => {
    // 時刻窓(anchorEventなし)は通知が付く。同日に3窓あっても上限2まで
    const user: UserProfile = {
      values: [],
      maxNotificationsPerDay: 2,
      availableWindows: [
        timeWindow('w1', ['Mon'], 10),
        timeWindow('w2', ['Mon'], 10),
        timeWindow('w3', ['Mon'], 10),
      ],
    };
    const specs = [
      canonicalize({ activity: '英語', targetFrequencyPerWeek: 1, id: 'h1' }),
      canonicalize({ activity: '家計', targetFrequencyPerWeek: 1, id: 'h2' }),
      canonicalize({ activity: '日記', targetFrequencyPerWeek: 1, id: 'h3' }),
    ];
    const plan = generatePlan(user, specs, []);
    expect(plan.notificationsByDay.Mon).toBeLessThanOrEqual(2);
  });

  it('1日の最大負荷を超える割当をしない', () => {
    const user: UserProfile = {
      values: [],
      maxNotificationsPerDay: 5,
      availableWindows: [timeWindow('w1', ['Mon'], 60), timeWindow('w2', ['Mon'], 60)],
    };
    // stretch を強制するため maintain 状態を与える活動を使わず、既定minimal(5分)で軽い
    const specs = [canonicalize({ activity: '英語', targetFrequencyPerWeek: 2, id: 'h1' })];
    const plan = generatePlan(user, specs, []);
    const mondayLoad = plan.assignments
      .filter((a) => a.day === 'Mon')
      .reduce((acc, a) => acc + a.step.minutes, 0);
    expect(mondayLoad).toBeLessThanOrEqual(60);
  });

  it('最小間隔日数を尊重する(週3・間隔1日→連日にしない)', () => {
    const user: UserProfile = {
      values: [],
      maxNotificationsPerDay: 5,
      availableWindows: [timeWindow('w', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 20)],
    };
    const specs = [canonicalize({ activity: '筋トレ', targetFrequencyPerWeek: 3, id: 'h1' })];
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const idx = generatePlan(user, specs, [])
      .assignments.map((a) => order.indexOf(a.day))
      .sort((x, y) => x - y);
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i] - idx[i - 1]).toBeGreaterThan(1); // 連日ではない
    }
  });
});
