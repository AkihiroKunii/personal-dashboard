import { useEffect, useState } from 'react';
import { registerParser } from '../core/import/registry';
import { registerAllParsers } from '../core/import/parsers';
import { importFromFragment } from '../core/import/urlImport';
import { GymPage } from '../features/gym/GymPage';
import { HabitPage } from '../features/habit/HabitPage';
import { VitalsPage } from '../features/vitals/VitalsPage';
import { VitalSummaryBanner } from '../features/vitals/VitalSummaryBanner';
import { seedExercisesIfEmpty } from '../features/gym/lib/exercises';
import { importProgramText } from '../features/gym/lib/program';
import { programJsonParser } from '../features/gym/lib/programParser';
import { ToastProvider, useToast } from './Toast';

registerAllParsers();
registerParser(programJsonParser);

/**
 * GitHub Pages上の program.json(programs/current.json のコミットで更新される)を
 * 起動時に自動取込する(§0.5「開いたら終わっている」)。オフライン・未配置は静かに無視。
 * 取込処理を単一のin-flightに束ねて、StrictModeの二重呼び出しなどでの競合を防ぐ。
 */
let programFetchInFlight: Promise<string | null> | null = null;

function autoFetchProgram(): Promise<string | null> {
  programFetchInFlight ??= (async () => {
    // 既定の種目マスタを先に投入してから取り込む(プログラム取込が
    // マスタを先に埋めてしまい、既定種目が欠ける事故を防ぐ)
    await seedExercisesIfEmpty();
    const res = await fetch(`${import.meta.env.BASE_URL}program.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const outcome = await importProgramText(await res.text());
    if (!outcome.updated) return null;
    const added =
      outcome.addedExercises.length > 0
        ? `(種目マスタに${outcome.addedExercises.length}件追加)`
        : '';
    return `プログラム「${outcome.program.programName}」を自動取込しました${added}`;
  })();
  return programFetchInFlight;
}

type TabId = 'vitals' | 'gym' | 'habit';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'vitals', label: 'バイタル', icon: '❤️' },
  { id: 'gym', label: 'ジム', icon: '🏋️' },
  { id: 'habit', label: '習慣', icon: '✅' },
];

function AppInner() {
  const [tab, setTab] = useState<TabId>('vitals');
  // 朝の取込直後に「その晩のバイタルサマリ」を出す(×で閉じられる)
  const [showVitalSummary, setShowVitalSummary] = useState(false);
  const toast = useToast();

  // V-F7: #import= 付きで開かれたら自動取込(フラグメントは即破棄される)
  useEffect(() => {
    importFromFragment()
      .then((summary) => {
        if (summary) {
          toast(
            `自動取込が完了しました(指標${summary.metricCount}件・睡眠${summary.sleepCount}件)`,
          );
          setShowVitalSummary(true);
        }
      })
      .catch((e: unknown) => {
        toast(`自動取込に失敗しました: ${e instanceof Error ? e.message : String(e)}`, 'error');
      });
  }, [toast]);

  // G-F6: 公開URLのプログラムJSONを自動取込(更新があったときだけ通知)
  useEffect(() => {
    autoFetchProgram()
      .then((message) => {
        if (message) toast(message);
      })
      .catch(() => {
        // オフラインや未配置は正常系として無視する
      });
  }, [toast]);

  return (
    <div className="app">
      <main className="app-main">
        {showVitalSummary && <VitalSummaryBanner onClose={() => setShowVitalSummary(false)} />}
        {tab === 'vitals' && <VitalsPage />}
        {tab === 'gym' && <GymPage />}
        {tab === 'habit' && <HabitPage />}
      </main>
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
