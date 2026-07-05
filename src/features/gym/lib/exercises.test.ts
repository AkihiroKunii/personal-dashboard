import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../core/db';
import {
  DEFAULT_EXERCISES,
  addExercise,
  deleteExercise,
  lastSetOf,
  recordSet,
  seedExercisesIfEmpty,
  updateExercise,
} from './exercises';

beforeEach(async () => {
  await db.exercises.clear();
  await db.gymSets.clear();
});

describe('種目マスタ(G-F1b/G-F2)', () => {
  it('空のときだけseedし、2回呼んでも重複しない', async () => {
    await seedExercisesIfEmpty();
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
    await seedExercisesIfEmpty();
    expect(await db.exercises.count()).toBe(DEFAULT_EXERCISES.length);
  });

  it('種目の追加・重複名の拒否・編集ができる', async () => {
    const id = await addExercise(' ケーブルフライ ', '胸');
    expect((await db.exercises.get(id))?.name).toBe('ケーブルフライ');
    await expect(addExercise('ケーブルフライ', '胸')).rejects.toThrow(/既に登録/);
    await updateExercise(id, { muscleGroup: '肩' });
    expect((await db.exercises.get(id))?.muscleGroup).toBe('肩');
  });

  it('記録が紐づく種目は削除できない', async () => {
    const id = await addExercise('ベンチプレス', '胸');
    await recordSet(id, 60, 10);
    await expect(deleteExercise(id)).rejects.toThrow(/削除できません/);
    await db.gymSets.clear();
    await deleteExercise(id);
    expect(await db.exercises.get(id)).toBeUndefined();
  });
});

describe('セット記録(G-F1)', () => {
  it('日付帰属は記録時刻のJST暦日(深夜0時台も当日)', async () => {
    const id = await addExercise('スクワット', '脚');
    await recordSet(id, 80, 8, Date.parse('2026-07-06T00:30:00+09:00'));
    const [row] = await db.gymSets.toArray();
    expect(row.date).toBe('2026-07-06');
  });

  it('lastSetOfは最新セットを返す(前回値プリセット §2.2)', async () => {
    const bench = await addExercise('ベンチプレス', '胸');
    const squat = await addExercise('スクワット', '脚');
    await recordSet(bench, 60, 10, Date.parse('2026-07-05T10:00:00+09:00'));
    await recordSet(bench, 62.5, 8, Date.parse('2026-07-06T10:00:00+09:00'));
    await recordSet(squat, 80, 8, Date.parse('2026-07-07T10:00:00+09:00'));
    const last = await lastSetOf(bench);
    expect(last).toMatchObject({ weightKg: 62.5, reps: 8 });
    expect(await lastSetOf(999)).toBeUndefined();
  });

  it('不正値は拒否する', async () => {
    const id = await addExercise('ベンチプレス', '胸');
    await expect(recordSet(id, -1, 10)).rejects.toThrow();
    await expect(recordSet(id, 60, 0)).rejects.toThrow();
  });
});
