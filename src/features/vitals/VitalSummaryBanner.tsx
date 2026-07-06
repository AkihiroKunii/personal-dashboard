import { useLiveQuery } from 'dexie-react-hooks';
import type { MetricId } from '../../core/health/dailySeries';
import { METRIC_DEFS } from './metricDefs';
import { loadLatestVitals, type VitalSummaryEntry } from './vitalSummary';

// 朝の取込直後に出す「その晩のバイタルサマリ」。×ボタンで閉じられる(V-F 補助)。

const ORDER: MetricId[] = ['sleep', 'hrvSdnn', 'restingHr', 'steps', 'heartRate'];

/** バナーは幅が狭いので短いラベルを使う */
const SHORT_LABEL: Record<MetricId, string> = {
  sleep: '睡眠',
  hrvSdnn: 'HRV',
  restingHr: '安静時心拍',
  steps: '歩数',
  heartRate: '心拍数',
};

/** 指標ごとの表示桁(歩数は整数、それ以外は小数1桁) */
function roundFor(metric: MetricId, n: number): number {
  return metric === 'steps' ? Math.round(n) : Math.round(n * 10) / 10;
}

function mainValue(metric: MetricId, entry: VitalSummaryEntry): number {
  return roundFor(metric, entry.value);
}

/** 単位のあとに付く補足(心拍数は最小〜最大の範囲) */
function unitSuffix(metric: MetricId, entry: VitalSummaryEntry): string {
  if (metric === 'heartRate' && entry.min !== undefined && entry.max !== undefined) {
    return ` ${entry.min}–${entry.max}`;
  }
  return '';
}

// 直近30日平均との比較(主目的: 今日が普段と比べてどうか)
interface Comparison {
  averageText: string;
  arrow: '▲' | '▼' | '±';
  diffText: string;
  direction: 'up' | 'down' | 'flat';
}

function comparison(metric: MetricId, entry: VitalSummaryEntry): Comparison | null {
  if (entry.average === undefined) return null;
  const diff = roundFor(metric, entry.value - entry.average);
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '±';
  return {
    averageText: `平均${roundFor(metric, entry.average)}`,
    arrow,
    diffText: `${Math.abs(diff)}`,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
}

export function VitalSummaryBanner({ onClose }: { onClose: () => void }) {
  const summary = useLiveQuery(loadLatestVitals, []);
  if (!summary) return null;

  const entries = ORDER.filter((m) => summary[m] !== undefined);
  if (entries.length === 0) return null;

  const latestDate = entries
    .map((m) => summary[m]!.date)
    .sort()
    .at(-1);

  return (
    <section className="summary-banner" role="status">
      <div className="summary-head">
        <h2>今朝のバイタル{latestDate ? ` · ${latestDate.slice(5).replace('-', '/')}` : ''}</h2>
        <button className="summary-close" aria-label="閉じる" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="summary-rows">
        {entries.map((m) => {
          const def = METRIC_DEFS[m];
          const entry = summary[m]!;
          const cmp = comparison(m, entry);
          return (
            <div key={m} className="summary-row">
              <span className="summary-label">{SHORT_LABEL[m]}</span>
              <span className="summary-figures">
                <span className="summary-value" style={{ color: def.color }}>
                  {mainValue(m, entry)}
                  <small>
                    {def.unit}
                    {unitSuffix(m, entry)}
                  </small>
                </span>
                {cmp && (
                  <span className="summary-compare">
                    {cmp.averageText}
                    <span className={`summary-delta ${cmp.direction}`}>
                      {cmp.arrow}
                      {cmp.diffText}
                    </span>
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
