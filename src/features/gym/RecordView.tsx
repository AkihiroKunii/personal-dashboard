import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import { todayJst } from '../../core/dates';
import { MUSCLE_GROUPS, type ExerciseRow, type GymSetRow } from '../../core/types';
import { deleteSet, lastSetOf, recordSet, updateSet } from './lib/exercises';
import { MUSCLE_COLORS } from './muscleColors';

// G-F1 セット記録。§2.2: 3タップ以内(種目タップ→[調整]→記録)、前回値プリセット、即時保存。

const WEIGHT_STEP = 1;

function Stepper({
  label,
  unit,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button aria-label={`${label}を減らす`} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      <button aria-label={`${label}を増やす`} onClick={() => onChange(value + step)}>
        +
      </button>
      <span className="stepper-unit">{unit}</span>
    </div>
  );
}

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
  // 種目チップは最近使った順(履歴がなければマスタ順)
  const recentIds =
    useLiveQuery(async () => {
      const recent = await db.gymSets.orderBy('at').reverse().limit(100).toArray();
      return [...new Set(recent.map((s) => s.exerciseId))].slice(0, 8);
    }, []) ?? [];

  const byId = new Map(exercises.map((e) => [e.id!, e]));
  // 最近使った種目を先頭に、残りはマスタ順で8枠を埋める
  const recentSet = new Set(recentIds);
  const chipExercises: ExerciseRow[] = [
    ...recentIds.map((id) => byId.get(id)).filter((e): e is ExerciseRow => !!e),
    ...exercises.filter((e) => !recentSet.has(e.id!)),
  ].slice(0, 8);
  const selected = selectedId !== null ? byId.get(selectedId) : undefined;

  const selectExercise = async (id: number) => {
    setSelectedId(id);
    setShowAll(false);
    // 前回値プリセット(今日すでに記録していればその値が最新=そのまま引き継がれる)
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

  const chip = (e: ExerciseRow) => {
    const color = MUSCLE_COLORS[e.muscleGroup];
    const active = e.id === selectedId;
    return (
      <button
        key={e.id}
        className={`chip${active ? ' active' : ''}`}
        style={active ? { borderColor: color, color, boxShadow: `0 0 14px ${color}55` } : undefined}
        onClick={() => void selectExercise(e.id!)}
      >
        {e.name}
      </button>
    );
  };

  // 当日のセットを種目ごと(初回記録順)にまとめる
  const todayByExercise = new Map<number, GymSetRow[]>();
  for (const s of todaySets) {
    const list = todayByExercise.get(s.exerciseId);
    if (list) list.push(s);
    else todayByExercise.set(s.exerciseId, [s]);
  }

  return (
    <>
      <section className="card">
        <h2>種目を選ぶ</h2>
        <div className="chip-row">{chipExercises.map(chip)}</div>
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
                <div className="chip-row wrap">{list.map(chip)}</div>
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
            記録する(本日 {todayByExercise.get(selected.id!)?.length ?? 0} セット目まで済)
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
