import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import { dowOf, todayJst } from '../../core/dates';
import type { Effort, PlanAssignment } from '../../../packages/habit-engine';
import { MomentumBar } from './Momentum';
import {
  checkIn,
  getRecoveryInterventions,
  undoCheckIn,
} from './lib/habitStore';
import { currentWeekStart } from './lib/week';

// H-F4 日次チェックイン(1タップ=10秒以内)/ H-F5 momentum表示 / H-F6 失敗回復の介入提示。

const EFFORT_LABELS: Record<Effort, string> = { 1: '楽だった', 2: '普通', 3: 'きつかった' };

function CheckInRow({ assignment }: { assignment: PlanAssignment }) {
  const toast = useToast();
  const today = todayJst();
  const [expanded, setExpanded] = useState(false);

  const spec = useLiveQuery(() => db.habitSpecs.get(assignment.habitId), [assignment.habitId]);
  const obs = useLiveQuery(
    () =>
      db.habitObservations
        .where('[habitId+contextKey]')
        .equals([assignment.habitId, assignment.windowId])
        .and((o) => o.date === today)
        .first(),
    [assignment.habitId, assignment.windowId, today],
  );

  const done = obs?.completed === true;
  const skipped = obs?.completed === false;

  const record = (completed: boolean, effort?: Effort, contextMatch = true) =>
    checkIn({
      habitId: assignment.habitId,
      contextKey: assignment.windowId,
      completed,
      effort,
      contextMatch,
      stepKind: assignment.step.kind,
    })
      .then(() => setExpanded(false))
      .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'error'));

  return (
    <div className={`checkin-row${done ? ' done' : ''}${skipped ? ' skipped' : ''}`}>
      <div className="checkin-main">
        <div className="checkin-info">
          <span className="checkin-anchor">{assignment.anchor.label}</span>
          <span className="checkin-step">{assignment.step.label}</span>
        </div>
        {obs === undefined ? (
          <button className="primary-btn checkin-done" onClick={() => void record(true, 2)}>
            完了
          </button>
        ) : (
          <button className="ghost-btn small" onClick={() => void undoCheckIn(assignment.habitId, assignment.windowId)}>
            {done ? '✓ 完了' : '— 未実行'} · 取消
          </button>
        )}
      </div>
      {obs === undefined && (
        <button className="link-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '閉じる' : '努力感・未実行を記録'}
        </button>
      )}
      {expanded && (
        <div className="checkin-detail">
          <div className="effort-row">
            {([1, 2, 3] as Effort[]).map((e) => (
              <button key={e} className="chip" onClick={() => void record(true, e)}>
                {EFFORT_LABELS[e]}
              </button>
            ))}
          </div>
          <button className="ghost-btn small" onClick={() => void record(false)}>
            今日は未実行だった
          </button>
        </div>
      )}
      {!spec && <span className="hint">この活動は削除されています</span>}
    </div>
  );
}

export function TodayView({ onGoToPlan }: { onGoToPlan: () => void }) {
  const today = todayJst();
  const planRow = useLiveQuery(() => db.habitPlans.get(currentWeekStart()), []);
  const states = useLiveQuery(() => db.habitStates.toArray(), []) ?? [];
  const specs = useLiveQuery(() => db.habitSpecs.toArray(), []) ?? [];
  const recovery = useLiveQuery(() => getRecoveryInterventions(), []) ?? [];

  const specById = new Map(specs.map((s) => [s.id, s]));
  // 活動ごとに最も勢いの高い文脈を代表として表示
  const momentumByHabit = new Map<string, (typeof states)[number]>();
  for (const s of states) {
    const cur = momentumByHabit.get(s.habitId);
    if (!cur || s.momentum > cur.momentum) momentumByHabit.set(s.habitId, s);
  }

  const dow = dowOf(today);
  const todaysAssignments = planRow?.plan.assignments.filter((a) => a.day === dow) ?? [];

  return (
    <>
      {momentumByHabit.size > 0 && (
        <section className="card">
          <h2>いまの勢い</h2>
          {[...momentumByHabit.values()].map((s) => (
            <MomentumBar
              key={`${s.habitId}|${s.contextKey}`}
              activity={specById.get(s.habitId)?.activity ?? s.habitId}
              momentum={s.momentum}
              stage={s.stage}
            />
          ))}
        </section>
      )}

      {recovery.length > 0 && (
        <section className="card recovery-card">
          <h2>立て直しの提案</h2>
          {recovery.map((r) => (
            <div key={r.state.habitId + r.state.contextKey} className="recovery-item">
              <span className="recovery-activity">{r.activity}</span>
              <p className="recovery-message">{r.intervention.message}</p>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>
          今日やること
          <span className="hint-inline">{todaysAssignments.length}件</span>
        </h2>
        {!planRow ? (
          <>
            <p className="hint">今週の計画がまだありません。</p>
            <button className="primary-btn" onClick={onGoToPlan}>
              計画をつくる
            </button>
          </>
        ) : todaysAssignments.length === 0 ? (
          <p className="hint">今日の予定はありません。ゆっくり休みましょう。</p>
        ) : (
          todaysAssignments.map((a) => (
            <CheckInRow key={`${a.habitId}|${a.windowId}`} assignment={a} />
          ))
        )}
      </section>
    </>
  );
}
