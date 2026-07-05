import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '../../app/Toast';
import { db } from '../../core/db';
import type { HabitSpec, StepKind } from '../../../packages/habit-engine';
import { deleteActivity, registerActivity, updateLadderStep } from './lib/habitStore';

// H-F1 活動登録(→canonicalize)/ H-F2 分解ラダー編集 / 時間窓の確認。

const STEP_LABELS: Record<StepKind, string> = {
  minimal: '最小',
  standard: '標準',
  stretch: '伸長',
  recovery: '復旧',
};

const ACTIVITY_TYPE_LABELS: Record<HabitSpec['activityType'], string> = {
  skill: 'スキル',
  physical: '運動',
  admin: '事務',
  reflective: '内省',
  'environment-prep': '準備',
};

function ActivityCard({ spec }: { spec: HabitSpec }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const ladder = useLiveQuery(() => db.habitLadders.get(spec.id), [spec.id]);
  const usedCount = useLiveQuery(
    () => db.habitObservations.where('habitId').equals(spec.id).count(),
    [spec.id],
  );

  return (
    <section className="card">
      <h2>
        {spec.activity}
        <span className="hint-inline">
          週{spec.targetFrequencyPerWeek}回 · {ACTIVITY_TYPE_LABELS[spec.activityType]}
        </span>
      </h2>
      {spec.why && <p className="hint">理由: {spec.why}</p>}

      <button className="link-btn" onClick={() => setEditing(!editing)}>
        {editing ? '閉じる' : '分解ラダーを編集'}
      </button>
      {editing && ladder && (
        <div className="ladder-edit">
          {(['minimal', 'standard', 'stretch', 'recovery'] as StepKind[]).map((kind) => (
            <div key={kind} className="ladder-step">
              <span className="ladder-kind">{STEP_LABELS[kind]}</span>
              <input
                type="text"
                defaultValue={ladder[kind].label}
                onBlur={(e) => void updateLadderStep(spec.id, kind, { label: e.target.value })}
              />
              <input
                type="number"
                className="ladder-min"
                defaultValue={ladder[kind].minutes}
                min={0}
                onBlur={(e) => void updateLadderStep(spec.id, kind, { minutes: Number(e.target.value) })}
              />
              <span className="stepper-unit">分</span>
            </div>
          ))}
        </div>
      )}

      <div className="activity-footer">
        <span className="hint-inline">記録 {usedCount ?? 0}件</span>
        {(usedCount ?? 0) === 0 && (
          <button
            className="danger small"
            onClick={() =>
              void deleteActivity(spec.id)
                .then(() => toast('活動を削除しました'))
                .catch((e: unknown) => toast(e instanceof Error ? e.message : String(e), 'error'))
            }
          >
            削除
          </button>
        )}
      </div>
    </section>
  );
}

export function ActivitiesView() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [freq, setFreq] = useState(3);
  const [contexts, setContexts] = useState<string[]>([]);
  const [why, setWhy] = useState('');

  const specs = useLiveQuery(() => db.habitSpecs.toArray(), []) ?? [];
  const windows = useLiveQuery(() => db.habitWindows.toArray(), []);

  const toggleContext = (id: string) =>
    setContexts((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    try {
      await registerActivity({
        activity: name,
        targetFrequencyPerWeek: freq,
        preferredContexts: contexts,
        why: why.trim() || undefined,
      });
      toast(`「${name}」を登録しました`);
      setName('');
      setWhy('');
      setContexts([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  return (
    <>
      <section className="card">
        <h2>活動を追加</h2>
        <label className="field-label">活動名</label>
        <input
          type="text"
          className="full-input"
          placeholder="例: 英語のシャドーイング"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="field-label">週の目標頻度: {freq}回</label>
        <input
          type="range"
          min={1}
          max={7}
          value={freq}
          onChange={(e) => setFreq(Number(e.target.value))}
          style={{ width: '100%' }}
        />

        <label className="field-label">使える文脈(時間窓)</label>
        <div className="chip-row wrap">
          {(windows ?? []).map((w) => (
            <button
              key={w.id}
              className={`chip${contexts.includes(w.id) ? ' active' : ''}`}
              onClick={() => toggleContext(w.id)}
            >
              {w.anchorEvent ?? w.label}
            </button>
          ))}
        </div>

        <label className="field-label">価値理由(なぜ続けたいか)</label>
        <input
          type="text"
          className="full-input"
          placeholder="例: 海外で働けるようになる"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />

        <button className="primary-btn" onClick={() => void submit()}>
          登録する
        </button>
      </section>

      {specs.length === 0 ? (
        <section className="card">
          <p className="hint">
            まだ活動がありません。続けたい習慣を「行動」の形(例: 朝食後に5分シャドーイング)で登録すると、週間計画が作れます。
          </p>
        </section>
      ) : (
        specs.map((spec) => <ActivityCard key={spec.id} spec={spec} />)
      )}
    </>
  );
}
