import { useLiveQuery } from 'dexie-react-hooks';
import { weeklyReview } from './lib/habitStore';
import { STAGE_LABEL } from './Momentum';

// H-F7 週次レビュー。文言は評価ではなく観察ベース(点数化・自己批判を避ける)。

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function ReviewView() {
  const review = useLiveQuery(() => weeklyReview(), []);
  if (!review) return null;

  const { overall, perHabit } = review;
  const hasData = overall.attempts > 0;

  return (
    <>
      <section className="card">
        <h2>今週のふりかえり(直近7日)</h2>
        {!hasData ? (
          <p className="hint">記録が貯まると、実行の様子がここに表示されます。</p>
        ) : (
          <>
            <p className="review-line">
              計画に対して <strong>{overall.attempts}回</strong> のうち{' '}
              <strong>{overall.completions}回</strong> 実行しました。
            </p>
            <div className="review-metrics">
              <div>
                <span className="kpi-label">実行した割合</span>
                <span className="kpi-value">{pct(overall.completionRate)}</span>
              </div>
              <div>
                <span className="kpi-label">計画通りの文脈で</span>
                <span className="kpi-value">{pct(overall.contextMatchRate)}</span>
              </div>
              <div>
                <span className="kpi-label">自分から始めた</span>
                <span className="kpi-value">{pct(overall.selfInitiationRate)}</span>
              </div>
            </div>
          </>
        )}
      </section>

      {perHabit.map((h) => (
        <section key={h.habitId} className="card">
          <h2>
            {h.activity}
            <span className="hint-inline">{STAGE_LABEL[h.stage]}</span>
          </h2>
          <p className="review-line">
            {h.metrics.attempts}回中 {h.metrics.completions}回 実行。
            {h.metrics.averageEffort !== null &&
              ` 努力感は平均 ${Math.round(h.metrics.averageEffort * 10) / 10}(3段階)。`}
          </p>
          <p className="hint">
            自分から始めた割合 {pct(h.metrics.selfInitiationRate)} / 勢い{' '}
            {Math.round(h.momentum * 10) / 10}
          </p>
        </section>
      ))}
    </>
  );
}
