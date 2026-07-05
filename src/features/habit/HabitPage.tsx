import { useEffect, useState } from 'react';
import { ActivitiesView } from './ActivitiesView';
import { PlanView } from './PlanView';
import { ReviewView } from './ReviewView';
import { TodayView } from './TodayView';
import { seedWindowsIfEmpty } from './lib/habitStore';

type HabitView = 'today' | 'plan' | 'activities' | 'review';

const VIEWS: Array<{ id: HabitView; label: string }> = [
  { id: 'today', label: '今日' },
  { id: 'plan', label: '計画' },
  { id: 'activities', label: '活動' },
  { id: 'review', label: 'レビュー' },
];

export function HabitPage() {
  const [view, setView] = useState<HabitView>('today');

  // 初回のみサンプル時間窓を提案投入(空でなければ何もしない)
  useEffect(() => {
    void seedWindowsIfEmpty();
  }, []);

  return (
    <div className="page">
      <h1>習慣</h1>
      <div className="segment-bar" role="tablist" aria-label="習慣画面切替">
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
      {view === 'today' && <TodayView onGoToPlan={() => setView('plan')} />}
      {view === 'plan' && <PlanView />}
      {view === 'activities' && <ActivitiesView />}
      {view === 'review' && <ReviewView />}
    </div>
  );
}
