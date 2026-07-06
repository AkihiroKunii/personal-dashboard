import { db } from '../../../core/db';
import { daysBetween } from '../../../core/dates';
import type { ProgramContent, ProgramRow } from '../../../core/types';
import { addExercise } from './exercises';
import { inferMuscleGroup, parseProgramContent } from './programSchema';

// プログラム(G-F6)のDB操作。パース等の純関数は programSchema.ts に分離してある。

export interface ProgramImportOutcome {
  program: ProgramContent;
  /** 内容が既存と同一で何もしなかった場合 false */
  updated: boolean;
  /** 自動でマスタに追加した種目名(G-F1b) */
  addedExercises: string[];
}

/**
 * プログラムJSONテキストを取り込む。
 * 同一 programName+validFrom は上書き(冪等)。内容が同一なら何もしない
 * (アプリ起動ごとの自動フェッチで走るため、無駄な書き込み・トーストを避ける)。
 */
export async function importProgramText(text: string): Promise<ProgramImportOutcome> {
  const content = parseProgramContent(text);

  const existing = await db.programs.get([content.programName, content.validFrom]);
  if (existing && existing.raw === text) {
    return { program: content, updated: false, addedExercises: [] };
  }

  // 未知の種目を部位推定つきでマスタへ自動追加
  const known = new Set((await db.exercises.toArray()).map((e) => e.name));
  const addedExercises: string[] = [];
  for (const day of content.weeklySchedule) {
    for (const ex of day.exercises) {
      if (known.has(ex.name)) continue;
      await addExercise(ex.name, inferMuscleGroup(day.focus));
      known.add(ex.name);
      addedExercises.push(ex.name);
    }
  }

  // 自然キー([programName+validFrom])での put のため、再取込は上書き=冪等
  const row: ProgramRow = { ...content, importedAt: Date.now(), raw: text };
  await db.programs.put(row);
  return { program: content, updated: true, addedExercises };
}

/** 指定日に有効なプログラム。期間が重複する場合は validFrom が最新の世代を採用 */
export async function activeProgramOn(date: string): Promise<ProgramRow | undefined> {
  const candidates = await db.programs
    .where('validFrom')
    .belowOrEqual(date)
    .and((p) => p.validUntil >= date)
    .toArray();
  return candidates.sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1);
}

export type ProgramStatus = 'active' | 'upcoming' | 'past';

/**
 * 計画表示用: 有効なプログラム、なければ次の予定、それもなければ直近の過去。
 * 記録画面の「今日のメニュー」は activeProgramOn(=有効なもののみ)を使うこと。
 */
export async function currentOrNextProgram(
  date: string,
): Promise<{ program: ProgramRow; status: ProgramStatus } | undefined> {
  const active = await activeProgramOn(date);
  if (active) return { program: active, status: 'active' };
  const upcoming = await db.programs.where('validFrom').above(date).sortBy('validFrom');
  if (upcoming[0]) return { program: upcoming[0], status: 'upcoming' };
  const all = await db.programs.orderBy('validFrom').toArray();
  return all.at(-1) ? { program: all.at(-1)!, status: 'past' } : undefined;
}

/** 有効期限のこの日数以内になったら次のコーチングを促す */
export const COACHING_REMIND_WITHIN_DAYS = 5;

export interface CoachingReminder {
  /** due-soon=期限が近い / overdue=期限切れで次が未設定 */
  status: 'due-soon' | 'overdue';
  program: ProgramRow;
  /** 有効期限までの残り日数(過ぎていれば負) */
  daysLeft: number;
}

/**
 * コーチングセッション(プラン改訂)を促すべきかを判定する(アプリ内リマインダー用)。
 * プログラム自身の validUntil を基準にするため、周期はコーチングが決めた期間に自動追従する。
 * - 有効なプログラムの期限が残り COACHING_REMIND_WITHIN_DAYS 日以内 → due-soon
 * - 有効なプログラムがなく、直近が期限切れ(次の予定もない) → overdue
 * - 次の予定がある/そもそも未設定 → null(促さない)
 */
export async function getCoachingReminder(date: string): Promise<CoachingReminder | null> {
  const active = await activeProgramOn(date);
  if (active) {
    const daysLeft = daysBetween(date, active.validUntil);
    if (daysLeft > COACHING_REMIND_WITHIN_DAYS) return null;
    // 期限が近くても、次の世代が既に用意されていれば促さない(改訂済み)
    const hasNext = (await db.programs.where('validFrom').above(active.validUntil).count()) > 0;
    return hasNext ? null : { status: 'due-soon', program: active, daysLeft };
  }
  const found = await currentOrNextProgram(date);
  if (found?.status === 'past') {
    return { status: 'overdue', program: found.program, daysLeft: daysBetween(date, found.program.validUntil) };
  }
  return null;
}
