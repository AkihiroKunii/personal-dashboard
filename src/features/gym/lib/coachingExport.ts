import { db } from '../../../core/db';
import { addDays, todayJst } from '../../../core/dates';
import { loadSleepSeries } from '../../../core/health/dailySeries';
import { getSourcePriority } from '../../../core/settings';
import type { ExerciseRow } from '../../../core/types';
import { buildCoachingSummary } from './kpi';
import { activeProgramOn, currentOrNextProgram } from './program';

// G-F11 コーチング用サマリー出力。KPIタブとコーチングリマインダーの両方から使う共通関数。
// 月次のClaudeセッションに持ち込むデータ(e1RM変化・部位別ボリューム・実施率・体組成・睡眠要約)を
// クリップボードにコピー(失敗時はダウンロード)する。アプリは判断せず「記録の書き出し」に徹する。

export type CoachingExportResult = 'copied' | 'downloaded';

export async function runCoachingExport(): Promise<CoachingExportResult> {
  const today = todayJst();
  const priority = await getSourcePriority();
  // 対象プログラム(有効なもの、なければ直近)。期間はプログラム開始〜今日
  const active = (await activeProgramOn(today)) ?? (await currentOrNextProgram(today))?.program;
  const period = { from: active?.validFrom ?? addDays(today, -29), to: today };

  const [sets, exercises, bodyRows, proteinDays, sleepPeriod] = await Promise.all([
    db.gymSets.where('date').between(period.from, period.to, true, true).toArray(),
    db.exercises.toArray(),
    db.bodyMetrics.where('date').between(period.from, period.to, true, true).toArray(),
    db.proteinDays.toArray(),
    loadSleepSeries(period.from, period.to, priority),
  ]);
  const byId = new Map<number, ExerciseRow>(exercises.map((e) => [e.id!, e]));
  const sVals = sleepPeriod.map((p) => p.value).filter((v): v is number => v !== null);

  const { json, text } = buildCoachingSummary({
    period,
    programName: active?.programName,
    exercisesById: byId,
    sets,
    program: active ?? undefined,
    bodyRows,
    proteinDays,
    sleepAvgHours: sVals.length > 0 ? sVals.reduce((a, b) => a + b, 0) / sVals.length : undefined,
  });
  const payload = `${text}\n\n---\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\`\n`;

  try {
    await navigator.clipboard.writeText(payload);
    return 'copied';
  } catch {
    const blob = new Blob([payload], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coaching-summary-${today}.md`;
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  }
}
