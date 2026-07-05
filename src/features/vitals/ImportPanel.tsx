import { useRef, useState } from 'react';
import { importFile } from '../../core/import/registry';
import { useToast } from '../../app/Toast';

// V-F3: ファイルインポート(日次JSON + export.xml バックフィル)。
// 自動化ファースト原則によりURL連携(V-F7)が主動線で、こちらはフォールバック。

export function ImportPanel() {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        setProgress(`${file.name} を取込中…`);
        try {
          const outcome = await importFile(file, (ratio) => {
            setProgress(`${file.name} を取込中… ${Math.floor(ratio * 100)}%`);
          });
          toast(`${file.name}: ${outcome.message}`);
          if (outcome.warnings.length > 0) {
            console.warn(`${file.name}:`, outcome.warnings);
          }
        } catch (e) {
          toast(`${file.name}: ${e instanceof Error ? e.message : String(e)}`, 'error');
        }
      }
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <section className="card">
      <h2>インポート</h2>
      <p className="hint">
        日次エクスポートJSON(ショートカット)/ ヘルスケア標準 export.xml
        に対応。同じファイルを再取込しても重複しません。
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.xml,application/json,text/xml"
        multiple
        disabled={busy}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {progress && <p className="progress">{progress}</p>}
      <p className="hint">
        通常はショートカットからのURL自動取込(#import=)を使用し、ファイル選択はバックフィル・復旧用です。
      </p>
    </section>
  );
}
