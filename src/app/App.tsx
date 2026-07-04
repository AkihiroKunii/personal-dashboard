import { useEffect, useState } from 'react';
import { registerAllParsers } from '../core/import/parsers';
import { importFromFragment } from '../core/import/urlImport';
import { GymPage } from '../features/gym/GymPage';
import { HabitPage } from '../features/habit/HabitPage';
import { VitalsPage } from '../features/vitals/VitalsPage';
import { ToastProvider, useToast } from './Toast';

registerAllParsers();

type TabId = 'vitals' | 'gym' | 'habit';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'vitals', label: 'バイタル', icon: '❤️' },
  { id: 'gym', label: 'ジム', icon: '🏋️' },
  { id: 'habit', label: '習慣', icon: '✅' },
];

function AppInner() {
  const [tab, setTab] = useState<TabId>('vitals');
  const toast = useToast();

  // V-F7: #import= 付きで開かれたら自動取込(フラグメントは即破棄される)
  useEffect(() => {
    importFromFragment()
      .then((summary) => {
        if (summary) {
          toast(
            `自動取込が完了しました(指標${summary.metricCount}件・睡眠${summary.sleepCount}件)`,
          );
        }
      })
      .catch((e: unknown) => {
        toast(`自動取込に失敗しました: ${e instanceof Error ? e.message : String(e)}`, 'error');
      });
  }, [toast]);

  return (
    <div className="app">
      <main className="app-main">
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
