import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../../core/db';
import { getCoachingReminder, importProgramText } from './program';

const sampleText = readFileSync('docs/samples/program_sample.json', 'utf8');

beforeEach(async () => {
  await db.programs.clear();
  await db.exercises.clear();
  await db.gymSets.clear();
});

describe('コーチング改訂リマインダー(validUntil基準)', () => {
  it('有効期限まで日数がある間は促さない', async () => {
    await importProgramText(sampleText); // validUntil 2026-08-02
    expect(await getCoachingReminder('2026-07-20')).toBeNull();
  });

  it('有効期限が5日以内になると due-soon で促す', async () => {
    await importProgramText(sampleText);
    const r = await getCoachingReminder('2026-07-29'); // 残り4日
    expect(r?.status).toBe('due-soon');
    expect(r?.daysLeft).toBe(4);
  });

  it('期限切れで次の予定もなければ overdue で促す', async () => {
    await importProgramText(sampleText);
    const r = await getCoachingReminder('2026-08-10'); // 期限(8/2)を過ぎている
    expect(r?.status).toBe('overdue');
    expect(r?.daysLeft).toBeLessThan(0);
  });

  it('次の世代が用意されていれば促さない', async () => {
    await importProgramText(sampleText);
    const v2 = sampleText
      .replace('"2026-07-06"', '"2026-08-03"')
      .replace('"2026-08-02"', '"2026-08-30"')
      .replace('筋肥大期 v1', '筋肥大期 v2');
    await importProgramText(v2);
    // v1終了直後だが v2(開始前)がある → 促さない
    expect(await getCoachingReminder('2026-08-02')).toBeNull();
  });
});
