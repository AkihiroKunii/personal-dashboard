import { useLiveQuery } from 'dexie-react-hooks';
import { loadSleepStageSeries, type SleepStageKey } from '../../core/health/dailySeries';
import { getSourcePriority } from '../../core/settings';
import { SleepStageChart, type StageSeries } from './SleepStageChart';

// 睡眠ステージ表示(①拡張、§1.4)。深い/コア/レム(+未分類)の内訳を積み上げ棒で表示。
// 合計睡眠時間(InBed/Awake除外)と整合。ステージ解釈は stageMap 経由の正準キーのみ扱う。

const STAGE_META: Array<{ key: SleepStageKey; label: string; color: string }> = [
  { key: 'deep', label: '深い', color: '#4f46e5' },
  { key: 'core', label: 'コア', color: '#38bdf8' },
  { key: 'rem', label: 'レム', color: '#a78bfa' },
  { key: 'other', label: '未分類', color: '#64748b' },
];

function formatHm(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

export function SleepStageCard({ from, to }: { from: string; to: string }) {
  const stages = useLiveQuery(async () => {
    const priority = await getSourcePriority();
    return loadSleepStageSeries(from, to, priority);
  }, [from, to]);

  if (!stages) return null;

  const hasData = STAGE_META.some((s) => stages[s.key].some((p) => p.value !== null));
  if (!hasData) return null;

  // 直近夜(最後に値がある日)の内訳をヘッダに出す
  const lastIndex = (() => {
    const anyKey = stages.deep;
    for (let i = anyKey.length - 1; i >= 0; i--) {
      if (STAGE_META.some((s) => stages[s.key][i]?.value !== null)) return i;
    }
    return -1;
  })();
  const latest =
    lastIndex >= 0
      ? STAGE_META.map((s) => ({ ...s, hours: stages[s.key][lastIndex]?.value ?? 0 })).filter(
          (s) => s.hours > 0,
        )
      : [];

  const series: StageSeries[] = STAGE_META.map((s) => ({
    key: s.key,
    label: s.label,
    color: s.color,
    points: stages[s.key],
  }));

  return (
    <section className="card">
      <h2>睡眠ステージ</h2>
      {latest.length > 0 && (
        <p className="stage-latest">
          直近: {latest.map((s) => `${s.label} ${formatHm(s.hours)}`).join(' ・ ')}
        </p>
      )}
      <SleepStageChart series={series} />
      <div className="stage-legend">
        {STAGE_META.map((s) => (
          <span key={s.key} className="stage-legend-item">
            <span className="stage-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </section>
  );
}
