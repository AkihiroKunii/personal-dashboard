import { useEffect, useState } from 'react';
import { ChartsView } from './ChartsView';
import { ExercisesView } from './ExercisesView';
import { seedExercisesIfEmpty } from './lib/exercises';
import { RecordView } from './RecordView';

type GymView = 'record' | 'charts' | 'exercises';

const VIEWS: Array<{ id: GymView; label: string }> = [
  { id: 'record', label: '記録' },
  { id: 'charts', label: '推移' },
  { id: 'exercises', label: '種目' },
];

export function GymPage() {
  const [view, setView] = useState<GymView>('record');

  // 初回のみ初期種目マスタを投入(空でなければ何もしない)
  useEffect(() => {
    void seedExercisesIfEmpty();
  }, []);

  return (
    <div className="page">
      <h1>ジム</h1>
      <div className="range-switcher" role="tablist" aria-label="ジム画面切替">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={view === v.id ? 'active' : ''}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'record' && <RecordView />}
      {view === 'charts' && <ChartsView />}
      {view === 'exercises' && <ExercisesView />}
    </div>
  );
}
