import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../core/db';
import { jstDateOf } from '../../core/dates';
import { orderByPriority, sourceLabel } from '../../core/health/sources';
import { getSourcePriority, setSourcePriority } from '../../core/settings';
import { useToast } from '../../app/Toast';
import { METRIC_DEFS } from './metricDefs';
import type { MetricId } from '../../core/health/dailySeries';

// V-F6: 保存済みデータの期間・件数の確認と全削除。
// §1.4: ソース優先順位の並べ替え(表示は合算ではなく優先ソース選択)。

interface MetricStat {
  metric: string;
  source: string;
  count: number;
  from: string;
  to: string;
}

async function loadStats() {
  const rows = await db.dailyMetrics.toArray();
  const byKey = new Map<string, MetricStat>();
  for (const r of rows) {
    const key = `${r.metric}|${r.source}`;
    const cur = byKey.get(key);
    if (cur) {
      cur.count += 1;
      if (r.date < cur.from) cur.from = r.date;
      if (r.date > cur.to) cur.to = r.date;
    } else {
      byKey.set(key, { metric: r.metric, source: r.source, count: 1, from: r.date, to: r.date });
    }
  }
  const sleepCount = await db.sleepRecords.count();
  const firstSleep = await db.sleepRecords.orderBy('start').first();
  const lastSleep = await db.sleepRecords.orderBy('start').last();
  const sleepSources = new Set<string>();
  await db.sleepRecords.each((r) => {
    sleepSources.add(r.source);
  });
  return {
    metricStats: [...byKey.values()].sort(
      (a, b) => a.metric.localeCompare(b.metric) || a.source.localeCompare(b.source, 'ja'),
    ),
    sleep: {
      count: sleepCount,
      from: firstSleep ? jstDateOf(firstSleep.start) : null,
      to: lastSleep ? jstDateOf(lastSleep.start) : null,
      sources: [...sleepSources],
    },
  };
}

export function DataPanel() {
  const toast = useToast();
  const stats = useLiveQuery(loadStats, []);
  const priority = useLiveQuery(getSourcePriority, [], [] as string[]);

  const allSources = orderByPriority(
    [
      ...new Set([
        ...(stats?.metricStats.map((s) => s.source) ?? []),
        ...(stats?.sleep.sources ?? []),
      ]),
    ],
    priority,
  );

  const move = async (index: number, delta: -1 | 1) => {
    const next = [...allSources];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    await setSourcePriority(next);
  };

  const deleteAll = async () => {
    if (!window.confirm('保存済みの健康データをすべて削除します。よろしいですか?')) return;
    await db.transaction('rw', db.dailyMetrics, db.sleepRecords, async () => {
      await db.dailyMetrics.clear();
      await db.sleepRecords.clear();
    });
    toast('すべてのデータを削除しました');
  };

  if (!stats) return null;
  const isEmpty = stats.metricStats.length === 0 && stats.sleep.count === 0;

  return (
    <section className="card">
      <h2>データ管理</h2>
      {isEmpty ? (
        <p className="hint">保存済みデータはありません。</p>
      ) : (
        <>
          <table className="stats-table">
            <thead>
              <tr>
                <th>指標</th>
                <th>ソース</th>
                <th>件数</th>
                <th>期間</th>
              </tr>
            </thead>
            <tbody>
              {stats.metricStats.map((s) => (
                <tr key={`${s.metric}|${s.source}`}>
                  <td>{METRIC_DEFS[s.metric as MetricId]?.label ?? s.metric}</td>
                  <td>{sourceLabel(s.source)}</td>
                  <td>{s.count}</td>
                  <td>
                    {s.from}〜{s.to}
                  </td>
                </tr>
              ))}
              {stats.sleep.count > 0 && (
                <tr>
                  <td>睡眠レコード</td>
                  <td>{stats.sleep.sources.map(sourceLabel).join(' / ')}</td>
                  <td>{stats.sleep.count}</td>
                  <td>
                    {stats.sleep.from}〜{stats.sleep.to}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {allSources.length > 1 && (
            <>
              <h3>ソース優先順位</h3>
              <p className="hint">
                同じ日に複数ソースのデータがある場合、上にあるソースの値だけを表示します(合算しません)。
              </p>
              <ol className="priority-list">
                {allSources.map((source, i) => (
                  <li key={source || '(daily)'}>
                    <span>{sourceLabel(source)}</span>
                    <span className="priority-buttons">
                      <button onClick={() => void move(i, -1)} disabled={i === 0} aria-label="上へ">
                        ↑
                      </button>
                      <button
                        onClick={() => void move(i, 1)}
                        disabled={i === allSources.length - 1}
                        aria-label="下へ"
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}

          <button className="danger" onClick={() => void deleteAll()}>
            すべてのデータを削除
          </button>
        </>
      )}
    </section>
  );
}
