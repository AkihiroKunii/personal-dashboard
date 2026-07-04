import { useLiveQuery } from 'dexie-react-hooks';
import {
  loadMetricSeries,
  loadSleepSeries,
  type MetricId,
  type SeriesPoint,
} from '../../core/health/dailySeries';
import { getSourcePriority } from '../../core/settings';

/**
 * 指標の日次系列を購読する。優先ソース設定の読み取りもクエリ内で行うため、
 * インポートや設定変更で自動的に再描画される(V-F4)。
 */
export function useSeries(metric: MetricId, from: string, to: string): SeriesPoint[] | undefined {
  return useLiveQuery(async () => {
    const priority = await getSourcePriority();
    return metric === 'sleep'
      ? loadSleepSeries(from, to, priority)
      : loadMetricSeries(metric, from, to, priority);
  }, [metric, from, to]);
}
