import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import { todayJst } from '../../core/dates';
import { MUSCLE_GROUPS, type ExerciseRow, type GymSetRow } from '../../core/types';
import { toggleProtein } from './lib/bodyProtein';
import { deleteSet, lastSetOf, recordSet, updateSet } from './lib/exercises';
import { activeProgramOn } from './lib/program';
import { menuForDate } from './lib/programSchema';
import { MUSCLE_COLORS } from './muscleColors';
import { Stepper } from './Stepper';

// G-F1 セット記録。§2.2: 3タップ以内(種目タップ→[調整]→記録)、前回値プリセット、即時保存。
// G-F6: 当日メニューがある日は種目をプリセット。G-F9: タンパク質の二値トグル。

const WEIGHT_STEP = 1;

export function RecordView() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(10);
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState(0);
  const [editReps, setEditReps] = useState(0);

  const today = todayJst();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const todaySets =
    useLiveQuery(() => db.gymSets.where('date').equals(today).sortBy('at'), [today]) ?? [];
  const recentIds =
    useLiveQuery(async () => {
      const recent = await db.gymSets.orderBy('at').reverse().limit(100).toArray();
      return [...new Set(recent.map((s) => s.exerciseId))].slice(0, 8);
    }, []) ?? [];
  // G-F6: 当日メニュー(アクティブプログラム)
  const todayMenu =
    useLiveQuery(async () => {
      const program = await activeProgramOn(today);
      return program ? (menuForDate(program, today) ?? null) : null;
    }, [today]) ?? null;
  // G-F9: 今日のタンパク質達成フラグ
  const proteinDay = useLiveQuery(() => db.proteinDays.get(today), [today]);
  const proteinTarget =
    useLiveQuery(async () => (await activeProgramOn(today))?.nutritionTargets?.proteinGramsPerDay, [
      today,
    ]) ?? undefined;

  const byId = new Map(exercises.map((e) => [e.id!, e]));
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const recentSet = new Set(recentIds);
  const chipExercises: ExerciseRow[] = [
    ...recentIds.map((id) => byId.get(id)).filter((e): e is ExerciseRow => !!e),
    ...exercises.filter((e) => !recentSet.has(e.id!)),
  ].slice(0, 8);
  const selected = selectedId !== null ? byId.get(selectedId) : undefined;

  const selectExercise = async (id: number) => {
    setSelectedId(id);
    setShowAll(false);
    const last = await lastSetOf(id);
    if (last) {
      setWeight(last.weightKg);
      setReps(last.reps);
    }
  };

  const doRecord = async () => {
    if (selectedId === null || !selected) return;
    try {
      await recordSet(selectedId, weight, reps);
      toast(`${selected.name} ${weight}kg × ${reps}回を記録しました`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const startEdit = (s: GymSetRow) => {
    setEditingId(s.id!);
    setEditWeight(s.weightKg);
    setEditReps(s.reps);
  };

  const setCountOf = (exerciseId: number) => todaySets.filter((s) => s.exerciseId === exerciseId).length;

  const chip = (e: ExerciseRow, targetSets?: number) => {
    const color = MUSCLE_COLORS[e.muscleGroup];
    const active = e.id === selectedId;
    const done = setCountOf(e.id!);
    return (
      <button
        key={e.id}
        className={`chip${active ? ' active' : ''}`}
        style={active ? { borderColor: color, color, boxShadow: `0 0 14px ${color}55` } : undefined}
        onClick={() => void selectExercise(e.id!)}
      >
        {e.name}
        {targetSets !== undefined && (
          <span className="chip-badge">
            {done}/{targetSets}
          </span>
        )}
      </button>
    );
  };

  const todayByExercise = new Map<number, GymSetRow[]>();
  for (const s of todaySets) {
    const list = todayByExercise.get(s.exerciseId);
    if (list) list.push(s);
    else todayByExercise.set(s.exerciseId, [s]);
  }

  const proteinState = proteinDay === undefined ? 'none' : proteinDay.achieved ? 'yes' : 'no';

  return (
    <>
      {todayMenu && (
        <section className="card menu-card">
          <h2>
            今日のメニュー
            <span className="hint-inline">{todayMenu.focus}</span>
          </h2>
          <div className="chip-row wrap">
            {todayMenu.exercises.map((pe) => {
              const e = byName.get(pe.name);
              return e ? (
                chip(e, pe.sets)
              ) : (
                <span key={pe.name} className="chip disabled">
                  {pe.name}
                </span>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <button
          className={`protein-toggle ${proteinState}`}
          onClick={() => void toggleProtein(today)}
        >
          <span>タンパク質{proteinTarget !== undefined ? ` 目標${proteinTarget}g` : ''}</span>
          <span className="protein-state">
            {proteinState === 'yes' ? '✓ 達成' : proteinState === 'no' ? '✕ 未達' : '未記録'}
          </span>
        </button>
      </section>

      <section className="card">
        <h2>種目を選ぶ</h2>
        <div className="chip-row">{chipExercises.map((e) => chip(e))}</div>
        <button className="link-btn" onClick={() => setShowAll(!showAll)}>
          {showAll ? '閉じる' : 'すべての種目から選ぶ'}
        </button>
        {showAll &&
          MUSCLE_GROUPS.map((g) => {
            const list = exercises.filter((e) => e.muscleGroup === g);
            if (list.length === 0) return null;
            return (
              <div key={g}>
                <h3 style={{ color: MUSCLE_COLORS[g] }}>{g}</h3>
                <div className="chip-row wrap">{list.map((e) => chip(e))}</div>
              </div>
            );
          })}
      </section>

      {selected && (
        <section className="card record-panel">
          <h2>
            {selected.name}
            <span className="muscle-badge" style={badgeStyle(selected.muscleGroup)}>
              {selected.muscleGroup}
            </span>
          </h2>
          <Stepper label="重量" unit="kg" value={weight} step={WEIGHT_STEP} min={0} onChange={setWeight} />
          <Stepper label="回数" unit="回" value={reps} step={1} min={1} onChange={setReps} />
          <button className="primary-btn" onClick={() => void doRecord()}>
            記録する(本日 {setCountOf(selected.id!)} セット済)
          </button>
        </section>
      )}

      <section className="card">
        <h2>今日の記録</h2>
        {todaySets.length === 0 && <p className="hint">まだ記録がありません。</p>}
        {[...todayByExercise.entries()].map(([exerciseId, sets]) => {
          const e = byId.get(exerciseId);
          return (
            <div key={exerciseId} className="today-group">
              <h3 style={{ color: e ? MUSCLE_COLORS[e.muscleGroup] : undefined }}>
                {e?.name ?? '不明な種目'}
              </h3>
              {sets.map((s, i) =>
                editingId === s.id ? (
                  <div key={s.id} className="set-row editing">
                    <Stepper label="重量" unit="kg" value={editWeight} step={WEIGHT_STEP} min={0} onChange={setEditWeight} />
                    <Stepper label="回数" unit="回" value={editReps} step={1} min={1} onChange={setEditReps} />
                    <div className="edit-actions">
                      <button
                        className="primary-btn small"
                        onClick={() => {
                          void updateSet(s.id!, { weightKg: editWeight, reps: editReps }).then(() =>
                            setEditingId(null),
                          );
                        }}
                      >
                        保存
                      </button>
                      <button
                        className="danger small"
                        onClick={() => {
                          void deleteSet(s.id!).then(() => setEditingId(null));
                        }}
                      >
                        削除
                      </button>
                      <button className="ghost-btn small" onClick={() => setEditingId(null)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <button key={s.id} className="set-row" onClick={() => startEdit(s)}>
                    <span className="set-index">#{i + 1}</span>
                    <span className="set-value">
                      {s.weightKg}kg × {s.reps}回
                    </span>
                    <span className="set-time">
                      {new Date(s.at).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                ),
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

export function badgeStyle(group: keyof typeof MUSCLE_COLORS) {
  const color = MUSCLE_COLORS[group];
  return { background: `${color}1f`, color, border: `1px solid ${color}55` };
}
