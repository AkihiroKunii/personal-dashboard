import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../core/db';
import { activeProgramOn, importProgramText } from './program';

const sampleText = readFileSync('docs/samples/program_sample.json', 'utf8');

beforeEach(async () => {
  await db.programs.clear();
  await db.exercises.clear();
  await db.gymSets.clear();
});

describe('プログラム取込(G-F6)', () => {
  it('取込は冪等: 同一テキストの再取込では updated=false', async () => {
    const first = await importProgramText(sampleText);
    expect(first.updated).toBe(true);
    expect(await db.programs.count()).toBe(1);

    const second = await importProgramText(sampleText);
    expect(second.updated).toBe(false);
    expect(await db.programs.count()).toBe(1);
  });

  it('未知種目を部位推定つきでマスタへ自動追加する(G-F1b)', async () => {
    // 初期マスタなし → サンプルの全種目が新規。focusから部位推定される
    const outcome = await importProgramText(sampleText);
    expect(outcome.addedExercises).toContain('ベンチプレス');
    const bench = await db.exercises.where('name').equals('ベンチプレス').first();
    expect(bench?.muscleGroup).toBe('胸'); // Mon=胸・三頭
    const lat = await db.exercises.where('name').equals('ラットプルダウン').first();
    expect(lat?.muscleGroup).toBe('背中'); // Wed=背中・二頭
    const squat = await db.exercises.where('name').equals('スクワット').first();
    expect(squat?.muscleGroup).toBe('脚'); // Fri=脚・肩
  });

  it('既存マスタと同名の種目は重複追加しない', async () => {
    await db.exercises.add({ name: 'ベンチプレス', muscleGroup: '胸' });
    const outcome = await importProgramText(sampleText);
    expect(outcome.addedExercises).not.toContain('ベンチプレス');
    expect(await db.exercises.where('name').equals('ベンチプレス').count()).toBe(1);
  });

  it('アクティブ世代は期間内でvalidFromが最新のものを選ぶ', async () => {
    await importProgramText(sampleText); // 2026-07-06〜08-02
    const v2 = sampleText
      .replace('"2026-07-06"', '"2026-07-20"')
      .replace('"2026-08-02"', '"2026-08-16"')
      .replace('筋肥大期 v1', '筋肥大期 v2');
    await importProgramText(v2);

    // 両方が有効な日はv2(validFrom新しい)
    expect((await activeProgramOn('2026-07-25'))?.programName).toContain('v2');
    // v2開始前はv1
    expect((await activeProgramOn('2026-07-10'))?.programName).toContain('v1');
    // 全期間外はundefined
    expect(await activeProgramOn('2026-09-01')).toBeUndefined();
  });
});
