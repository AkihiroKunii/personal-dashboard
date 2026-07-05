import { db } from '../../../core/db';
import { jstDateOf } from '../../../core/dates';
import type { ExerciseRow, GymSetRow, MuscleGroup } from '../../../core/types';

// 種目マスタ(G-F1b)と部位マッピング(G-F2)、セット記録(G-F1)のDB操作。

/** 初期種目マスタ(部位マッピング内蔵)。UIで編集可能 */
export const DEFAULT_EXERCISES: ReadonlyArray<Omit<ExerciseRow, 'id'>> = [
  { name: 'ベンチプレス', muscleGroup: '胸' },
  { name: 'インクラインダンベルプレス', muscleGroup: '胸' },
  { name: 'ダンベルフライ', muscleGroup: '胸' },
  { name: 'ラットプルダウン', muscleGroup: '背中' },
  { name: 'シーテッドロー', muscleGroup: '背中' },
  { name: 'デッドリフト', muscleGroup: '背中' },
  { name: 'スクワット', muscleGroup: '脚' },
  { name: 'レッグプレス', muscleGroup: '脚' },
  { name: 'レッグカール', muscleGroup: '脚' },
  { name: 'ショルダープレス', muscleGroup: '肩' },
  { name: 'サイドレイズ', muscleGroup: '肩' },
  { name: 'アームカール', muscleGroup: '腕' },
  { name: 'トライセプスエクステンション', muscleGroup: '腕' },
  { name: 'クランチ', muscleGroup: 'コア' },
  { name: 'レッグレイズ', muscleGroup: 'コア' },
];

/** 種目マスタが空のときだけ初期種目を投入する(2回呼んでも重複しない) */
export async function seedExercisesIfEmpty(): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    if ((await db.exercises.count()) === 0) {
      await db.exercises.bulkAdd(DEFAULT_EXERCISES as ExerciseRow[]);
    }
  });
}

export async function addExercise(name: string, muscleGroup: MuscleGroup): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('種目名を入力してください');
  const dup = await db.exercises.where('name').equals(trimmed).first();
  if (dup) throw new Error(`「${trimmed}」は既に登録されています`);
  return db.exercises.add({ name: trimmed, muscleGroup });
}

export async function updateExercise(
  id: number,
  patch: Partial<Pick<ExerciseRow, 'name' | 'muscleGroup'>>,
): Promise<void> {
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('種目名を入力してください');
    patch = { ...patch, name: trimmed };
  }
  await db.exercises.update(id, patch);
}

/** セットが紐づく種目は削除不可(記録の整合性を優先) */
export async function deleteExercise(id: number): Promise<void> {
  const used = await db.gymSets.where('exerciseId').equals(id).count();
  if (used > 0) throw new Error(`記録が${used}件あるため削除できません(名称・部位の編集は可能)`);
  await db.exercises.delete(id);
}

/** 1セットを即時保存する。日付帰属は記録時刻のJST暦日 */
export async function recordSet(
  exerciseId: number,
  weightKg: number,
  reps: number,
  at: number = Date.now(),
): Promise<number> {
  if (!(weightKg >= 0) || !(reps >= 1)) throw new Error('重量・回数が不正です');
  return db.gymSets.add({ exerciseId, at, date: jstDateOf(at), weightKg, reps });
}

export async function updateSet(
  id: number,
  patch: Partial<Pick<GymSetRow, 'weightKg' | 'reps'>>,
): Promise<void> {
  await db.gymSets.update(id, patch);
}

export async function deleteSet(id: number): Promise<void> {
  await db.gymSets.delete(id);
}

/** 前回値プリセット用: その種目の最新セット(§2.2) */
export async function lastSetOf(exerciseId: number): Promise<GymSetRow | undefined> {
  const sets = await db.gymSets.where('exerciseId').equals(exerciseId).sortBy('at');
  return sets.at(-1);
}
