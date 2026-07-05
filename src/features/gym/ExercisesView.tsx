import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import { MUSCLE_GROUPS, type ExerciseRow, type MuscleGroup } from '../../core/types';
import { addExercise, deleteExercise, updateExercise } from './lib/exercises';
import { badgeStyle } from './RecordView';
import { MUSCLE_COLORS } from './muscleColors';

// G-F1b 種目マスタ + G-F2 部位マッピングの編集UI。

function MuscleSelect({
  value,
  onChange,
}: {
  value: MuscleGroup;
  onChange: (g: MuscleGroup) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as MuscleGroup)}>
      {MUSCLE_GROUPS.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}

export function ExercisesView() {
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<MuscleGroup>('胸');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState<MuscleGroup>('胸');

  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const setCounts =
    useLiveQuery(async () => {
      const counts = new Map<number, number>();
      await db.gymSets.each((s) => {
        counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1);
      });
      return counts;
    }, []) ?? new Map<number, number>();

  const run = (p: Promise<unknown>, done?: () => void) => {
    p.then(() => done?.()).catch((e: unknown) =>
      toast(e instanceof Error ? e.message : String(e), 'error'),
    );
  };

  const startEdit = (e: ExerciseRow) => {
    setEditingId(e.id!);
    setEditName(e.name);
    setEditGroup(e.muscleGroup);
  };

  return (
    <>
      <section className="card">
        <h2>種目を追加</h2>
        <div className="add-form">
          <input
            type="text"
            placeholder="種目名(例: ケーブルフライ)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <MuscleSelect value={newGroup} onChange={setNewGroup} />
          <button
            className="primary-btn small"
            onClick={() =>
              run(addExercise(newName, newGroup), () => {
                setNewName('');
                toast('種目を追加しました');
              })
            }
          >
            追加
          </button>
        </div>
      </section>

      {MUSCLE_GROUPS.map((g) => {
        const list = exercises.filter((e) => e.muscleGroup === g);
        if (list.length === 0) return null;
        return (
          <section key={g} className="card">
            <h2 style={{ color: MUSCLE_COLORS[g] }}>{g}</h2>
            {list.map((e) => {
              const count = setCounts.get(e.id!) ?? 0;
              if (editingId === e.id) {
                return (
                  <div key={e.id} className="exercise-row editing">
                    <input
                      type="text"
                      value={editName}
                      onChange={(ev) => setEditName(ev.target.value)}
                    />
                    <MuscleSelect value={editGroup} onChange={setEditGroup} />
                    <div className="edit-actions">
                      <button
                        className="primary-btn small"
                        onClick={() =>
                          run(
                            updateExercise(e.id!, { name: editName, muscleGroup: editGroup }),
                            () => setEditingId(null),
                          )
                        }
                      >
                        保存
                      </button>
                      <button className="ghost-btn small" onClick={() => setEditingId(null)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={e.id} className="exercise-row">
                  <span className="exercise-name">
                    {e.name}
                    <span className="muscle-badge" style={badgeStyle(e.muscleGroup)}>
                      {e.muscleGroup}
                    </span>
                  </span>
                  <span className="exercise-actions">
                    <span className="hint-inline">{count}件</span>
                    <button className="ghost-btn small" onClick={() => startEdit(e)}>
                      編集
                    </button>
                    {count === 0 && (
                      <button
                        className="danger small"
                        onClick={() => run(deleteExercise(e.id!), () => toast('削除しました'))}
                      >
                        削除
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="hint">記録がある種目は削除できません(名称・部位の編集は可能)。</p>
    </>
  );
}
