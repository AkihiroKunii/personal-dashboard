import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { todayJst } from '../../core/dates';
import { runCoachingExport } from './lib/coachingExport';
import { getCoachingReminder } from './lib/program';

// アプリ内リマインダー(初期構想: 月1程度のコーチングでプラン改訂)。
// プログラムの validUntil を基準に「そろそろ改訂の時期」を知らせ、その場で
// コーチング用サマリー(G-F11)を出力できる。アプリは判断せず記録の書き出しに徹する。

export function CoachingReminder() {
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const reminder = useLiveQuery(() => getCoachingReminder(todayJst()), []);

  if (dismissed || !reminder) return null;

  const { status, program, daysLeft } = reminder;
  const message =
    status === 'overdue'
      ? `「${program.programName}」の有効期間は ${program.validUntil} で終了しています。Claudeとのセッションでプランを更新しましょう。`
      : daysLeft <= 0
        ? `「${program.programName}」は今日で終了です。Claudeとのセッションでプランを更新しましょう。`
        : `「${program.programName}」の有効期限まであと${daysLeft}日です。そろそろClaudeとのセッションでプランを見直しましょう。`;

  const exportSummary = async () => {
    setBusy(true);
    try {
      const result = await runCoachingExport();
      toast(
        result === 'copied'
          ? 'コーチング用サマリーをコピーしました。セッションに貼り付けてください'
          : 'コーチング用サマリーをダウンロードしました',
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="coaching-reminder">
      <div className="summary-head">
        <h2>プラン改訂の時期です</h2>
        <button className="summary-close" aria-label="閉じる" onClick={() => setDismissed(true)}>
          ✕
        </button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        {message}
      </p>
      <button className="primary-btn" disabled={busy} onClick={() => void exportSummary()}>
        コーチング用サマリーを出力
      </button>
    </section>
  );
}
