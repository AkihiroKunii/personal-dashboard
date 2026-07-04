import { db } from './db';

const SOURCE_PRIORITY_KEY = 'sourcePriority';

/** ソース優先順位リスト(先頭が最優先)。未設定は空配列(=既定順: 日次エクスポート優先) */
export async function getSourcePriority(): Promise<string[]> {
  const row = await db.settings.get(SOURCE_PRIORITY_KEY);
  return Array.isArray(row?.value) ? (row.value as string[]) : [];
}

export async function setSourcePriority(priority: string[]): Promise<void> {
  await db.settings.put({ key: SOURCE_PRIORITY_KEY, value: priority });
}
