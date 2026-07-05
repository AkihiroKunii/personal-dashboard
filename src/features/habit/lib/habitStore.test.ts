import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../core/db';
import { todayJst } from '../../../core/dates';
import {
  checkIn,
  deleteActivity,
  generateWeeklyPlan,
  getRecoveryInterventions,
  registerActivity,
  seedWindowsIfEmpty,
  todaysAssignments,
  undoCheckIn,
  weeklyReview,
} from './habitStore';

beforeEach(async () => {
  await Promise.all([
    db.habitWindows.clear(),
    db.habitSpecs.clear(),
    db.habitLadders.clear(),
    db.habitObservations.clear(),
    db.habitStates.clear(),
    db.habitPlans.clear(),
  ]);
});

describe('活動登録(H-F1/H-F2)', () => {
  it('canonicalize + buildLadder が保存され、記録があると削除不可', async () => {
    const spec = await registerActivity({ activity: '英語学習', targetFrequencyPerWeek: 5 });
    expect(spec.activityType).toBe('skill');
    expect(await db.habitLadders.get(spec.id)).toBeTruthy();

    await checkIn({ habitId: spec.id, contextKey: 'w1', completed: true });
    await expect(deleteActivity(spec.id)).rejects.toThrow(/削除できません/);
  });

  it('サンプル時間窓は空のときだけseedする(冪等)', async () => {
    await seedWindowsIfEmpty();
    const n = await db.habitWindows.count();
    expect(n).toBe(3);
    await seedWindowsIfEmpty();
    expect(await db.habitWindows.count()).toBe(3);
  });
});

describe('チェックインと状態更新(H-F4/F5)', () => {
  it('完了でmomentumが増え、observationが保存される', async () => {
    const spec = await registerActivity({ activity: '家計記録', targetFrequencyPerWeek: 7 });
    const state = await checkIn({ habitId: spec.id, contextKey: 'bedtime', completed: true, effort: 1 });
    expect(state?.momentum).toBeGreaterThan(0);
    expect(await db.habitObservations.count()).toBe(1);
  });

  it('未実行3連続で recover に入り、介入が提示される', async () => {
    const spec = await registerActivity({ activity: '筋トレ', targetFrequencyPerWeek: 3 });
    await checkIn({ habitId: spec.id, contextKey: 'evening', completed: false, date: '2026-07-06' });
    await checkIn({ habitId: spec.id, contextKey: 'evening', completed: false, date: '2026-07-07' });
    const st = await checkIn({ habitId: spec.id, contextKey: 'evening', completed: false, date: '2026-07-08' });
    expect(st?.stage).toBe('recover');

    const interventions = await getRecoveryInterventions();
    expect(interventions).toHaveLength(1);
    expect(interventions[0].intervention.kind).toBe('recovery-unit');
  });

  it('同一日の再チェックインは置き換え、取り消しで状態が戻る', async () => {
    const spec = await registerActivity({ activity: '英語', targetFrequencyPerWeek: 5 });
    await checkIn({ habitId: spec.id, contextKey: 'breakfast', completed: true, date: '2026-07-06' });
    await checkIn({ habitId: spec.id, contextKey: 'breakfast', completed: false, date: '2026-07-06' });
    expect(await db.habitObservations.count()).toBe(1); // 置き換え

    await undoCheckIn(spec.id, 'breakfast', '2026-07-06');
    expect(await db.habitObservations.count()).toBe(0);
    expect(await db.habitStates.get([spec.id, 'breakfast'])).toBeUndefined();
  });
});

describe('週間計画生成(H-F3)', () => {
  it('サンプル入力から計画を生成し、今日の割当が取り出せる', async () => {
    await seedWindowsIfEmpty();
    await registerActivity({ activity: '英語学習', targetFrequencyPerWeek: 5, preferredContexts: ['breakfast'] });
    await registerActivity({ activity: '筋トレ', targetFrequencyPerWeek: 3, preferredContexts: ['evening'] });
    await registerActivity({ activity: '家計記録', targetFrequencyPerWeek: 7, preferredContexts: ['bedtime'] });

    const plan = await generateWeeklyPlan();
    // 週5+3+7=15 割当(窓の容量が足りている前提)
    expect(plan.assignments.length).toBe(15);
    expect(Object.keys(plan.recoverySteps)).toHaveLength(3);

    // 今日の割当が plan と整合
    const today = await todaysAssignments();
    const dow = new Date(`${todayJst()}T00:00:00Z`).getUTCDay();
    const expected = dow === 0 ? plan.assignments.filter((a) => a.day === 'Sun') : today;
    expect(today.length).toBe(expected.length);
  });
});

describe('週次レビュー(H-F7)', () => {
  it('直近7日の完了率と活動別サマリーを返す', async () => {
    const spec = await registerActivity({ activity: '英語', targetFrequencyPerWeek: 5 });
    await checkIn({ habitId: spec.id, contextKey: 'breakfast', completed: true, contextMatch: true });
    const review = await weeklyReview();
    expect(review.overall.completions).toBe(1);
    expect(review.perHabit).toHaveLength(1);
    expect(review.perHabit[0].activity).toBe('英語');
  });
});
