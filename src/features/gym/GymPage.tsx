import { useEffect, useState } from 'react';
import { BodyView } from './BodyView';
import { ChartsView } from './ChartsView';
import { ExercisesView } from './ExercisesView';
import { KpiView } from './KpiView';
import { PlanView } from './PlanView';
import { RecordView } from './RecordView';
import { seedExercisesIfEmpty } from './lib/exercises';

type GymView = 'record' | 'charts' | 'plan' | 'body' | 'kpi' | 'exercises';

const VIEWS: Array<{ id: GymView; label: string }> = [
  { id: 'record', label: '記録' },
  { id: 'charts', label: '推移' },
  { id: 'plan', label: '計画' },
  { id: 'body', label: 'ボディ' },
  { id: 'kpi', label: 'KPI' },
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
      <div className="segment-bar" role="tablist" aria-label="ジム画面切替">
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
        <button
          role="tab"
          aria-selected={view === 'exercises'}
          className={`segment-more${view === 'exercises' ? ' active' : ''}`}
          onClick={() => setView('exercises')}
          aria-label="種目マスタ"
        >
          ⚙
        </button>
      </div>
      {view === 'record' && <RecordView />}
      {view === 'charts' && <ChartsView />}
      {view === 'plan' && <PlanView />}
      {view === 'body' && <BodyView />}
      {view === 'kpi' && <KpiView />}
      {view === 'exercises' && <ExercisesView />}
    </div>
  );
}
