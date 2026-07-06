import { db } from './db';

// 全データのバックアップ(§5、機種変更対策)。IndexedDBの全テーブルをJSONに入出力する。
// テーブルは db.tables を走査して動的に扱うため、スキーマが増えても取りこぼさない。

const APP_ID = 'personal-dashboard';

export interface BackupFile {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** 全テーブルをダンプする */
export async function exportBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  await db.transaction('r', db.tables, async () => {
    for (const table of db.tables) {
      tables[table.name] = await table.toArray();
    }
  });
  return {
    app: APP_ID,
    schemaVersion: db.verno,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

/** バックアップJSONをファイルとしてダウンロードする */
export async function downloadBackup(): Promise<{ rowCount: number }> {
  const backup = await exportBackup();
  const rowCount = Object.values(backup.tables).reduce((acc, rows) => acc + rows.length, 0);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${APP_ID}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { rowCount };
}

function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('JSONとして読み込めません');
  }
  const b = raw as Partial<BackupFile>;
  if (b?.app !== APP_ID) {
    throw new Error('このアプリのバックアップファイルではありません');
  }
  if (typeof b.schemaVersion !== 'number' || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('バックアップの形式が不正です');
  }
  if (b.schemaVersion > db.verno) {
    throw new Error(
      `新しいバージョン(v${b.schemaVersion})のバックアップは、このアプリ(v${db.verno})では復元できません。アプリを更新してください`,
    );
  }
  return b as BackupFile;
}

/**
 * バックアップから全データを復元する(既存を置き換え)。
 * 既知テーブルのみ clear→bulkPut を1トランザクションで実行。未知テーブル名は無視する。
 */
export async function importBackup(text: string): Promise<{ restored: Record<string, number> }> {
  const backup = parseBackup(text);
  const known = new Map(db.tables.map((t) => [t.name, t]));
  const restored: Record<string, number> = {};

  await db.transaction('rw', db.tables, async () => {
    for (const [name, table] of known) {
      const rows = backup.tables[name];
      if (!Array.isArray(rows)) continue;
      await table.clear();
      await table.bulkPut(rows);
      restored[name] = rows.length;
    }
  });
  return { restored };
}
