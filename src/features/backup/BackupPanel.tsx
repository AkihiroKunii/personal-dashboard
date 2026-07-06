import { useRef, useState } from 'react';
import { useToast } from '../../app/Toast';
import { downloadBackup, importBackup } from '../../core/backup';

// 全データのバックアップUI(§5)。エクスポート=保存、復元=置き換え。
// バイタル・ジム・習慣の全データが対象(機種変更・ブラウザ移行の保険)。

export function BackupPanel() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const { rowCount } = await downloadBackup();
      toast(`バックアップを保存しました(全${rowCount}件)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (!window.confirm('現在のデータをすべて置き換えます。よろしいですか?')) {
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setBusy(true);
    try {
      const { restored } = await importBackup(await file.text());
      const total = Object.values(restored).reduce((acc, n) => acc + n, 0);
      toast(`バックアップから復元しました(全${total}件)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="card">
      <h2>バックアップ(全データ)</h2>
      <p className="hint">
        バイタル・ジム・習慣のすべてのデータをJSONで保存/復元します(機種変更・ブラウザ移行用)。データは端末内のみで、外部には送信されません。
      </p>
      <button className="primary-btn" disabled={busy} onClick={() => void doExport()}>
        バックアップを保存(エクスポート)
      </button>
      <p className="hint" style={{ marginTop: 14 }}>
        復元は現在のデータをすべて上書きします。
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={(e) => void doImport(e.target.files?.[0])}
      />
    </section>
  );
}
