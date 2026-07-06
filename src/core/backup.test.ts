import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import { db } from './db';

async function clearAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}

beforeEach(clearAll);

describe('バックアップ(§5 全データJSON入出力)', () => {
  it('export→clear→import で全テーブルが復元される(往復)', async () => {
    await db.dailyMetrics.put({ metric: 'steps', date: '2026-07-04', source: '', value: 5311 });
    await db.exercises.put({ id: 1, name: 'ベンチプレス', muscleGroup: '胸' });
    await db.gymSets.put({ id: 1, exerciseId: 1, at: 1000, date: '2026-07-06', weightKg: 60, reps: 10 });
    await db.settings.put({ key: 'sourcePriority', value: ['SOXAI RING'] });

    const backup = await exportBackup();
    const text = JSON.stringify(backup);
    await clearAll();
    expect(await db.exercises.count()).toBe(0);

    const { restored } = await importBackup(text);
    expect(restored.exercises).toBe(1);
    expect(await db.dailyMetrics.get(['steps', '2026-07-04', ''])).toMatchObject({ value: 5311 });
    // 自動採番テーブルもキー(id)ごと復元される
    expect(await db.gymSets.get(1)).toMatchObject({ weightKg: 60, reps: 10 });
    expect((await db.settings.get('sourcePriority'))?.value).toEqual(['SOXAI RING']);
  });

  it('復元は既存データを置き換える(マージではない)', async () => {
    const backup = JSON.stringify(await exportBackup()); // 空
    await db.exercises.put({ id: 9, name: '削除される種目', muscleGroup: '肩' });
    await importBackup(backup);
    expect(await db.exercises.count()).toBe(0);
  });

  it('別アプリ・新しい版数のバックアップは拒否する', async () => {
    await expect(importBackup(JSON.stringify({ app: 'other', schemaVersion: 4, tables: {} }))).rejects.toThrow(
      /このアプリのバックアップ/,
    );
    await expect(
      importBackup(JSON.stringify({ app: 'personal-dashboard', schemaVersion: 999, tables: {} })),
    ).rejects.toThrow(/新しいバージョン/);
    await expect(importBackup('not json')).rejects.toThrow(/JSON/);
  });

  it('exportBackup はスキーマ版数とアプリ名を含む', async () => {
    const backup = await exportBackup();
    expect(backup.app).toBe('personal-dashboard');
    expect(backup.schemaVersion).toBe(db.verno);
    expect(Object.keys(backup.tables)).toContain('habitSpecs');
  });
});
