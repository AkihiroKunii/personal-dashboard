import { jstDateOf, parseHealthKitDate } from '../../dates';
import { mapXmlStage } from '../../health/stageMap';
import { normalizeSourceName } from '../../health/sources';
import type { DailyMetricRow, ImportResult, SleepRecordRow } from '../../types';
import { saveImportResult } from '../importer';
import type { RegisteredParser } from '../registry';

// Apple標準 export.xml のパーサ(V-F3b)。
// - 実運用ファイルは数百MBのため、チャンク単位のタグ走査でストリーミング処理し、全展開しない
// - 整形式XMLに依存しない(実データ由来の抜粋には未閉鎖の <Record> がある)
// - 未知のレコード型は無視し、既知の5指標のみ取り込む寛容設計(§1.4)
// - 日次集計(steps合算・心拍min/max/avg・HRV平均・安静時心拍)は走査中に逐次集約する

const TYPE_SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const TYPE_HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
const TYPE_RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate';
const TYPE_STEPS = 'HKQuantityTypeIdentifierStepCount';
const TYPE_HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';

const ATTR_RE = /([\w:.-]+)="([^"]*)"/g;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

interface MinMaxSum {
  min: number;
  max: number;
  sum: number;
  count: number;
}

export class HealthXmlAggregator {
  private pending = '';
  private steps = new Map<string, number>();
  private heartRate = new Map<string, MinMaxSum>();
  private hrv = new Map<string, MinMaxSum>();
  private restingHr = new Map<string, MinMaxSum>();
  private sleepRecords = new Map<string, SleepRecordRow>();
  private skippedSleepValues = new Set<string>();

  /** テキストチャンクを処理する。タグがチャンク境界をまたいでもよい */
  push(chunk: string): void {
    const buf = this.pending + chunk;
    let searchFrom = 0;
    for (;;) {
      const idx = buf.indexOf('<Record', searchFrom);
      if (idx === -1) {
        // '<Recor' のような部分トークンが末尾に残る可能性に備えて尾を保持
        this.pending = buf.slice(Math.max(buf.length - '<Record'.length, searchFrom));
        return;
      }
      const close = buf.indexOf('>', idx);
      if (close === -1) {
        this.pending = buf.slice(idx);
        return;
      }
      this.handleTag(buf.slice(idx, close));
      searchFrom = close + 1;
    }
  }

  private handleTag(tag: string): void {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(ATTR_RE)) attrs[m[1]] = m[2];
    const type = attrs.type;
    const { sourceName, startDate, endDate, value } = attrs;
    if (!type || !sourceName || !startDate || value === undefined) return;

    let startMs: number;
    try {
      startMs = parseHealthKitDate(startDate);
    } catch {
      return;
    }
    const source = normalizeSourceName(decodeXmlEntities(sourceName));
    const date = jstDateOf(startMs);
    const key = `${date}|${source}`;

    switch (type) {
      case TYPE_SLEEP: {
        const stage = mapXmlStage(value);
        if (!stage) {
          this.skippedSleepValues.add(value);
          return;
        }
        if (!endDate) return;
        let endMs: number;
        try {
          endMs = parseHealthKitDate(endDate);
        } catch {
          return;
        }
        const rec: SleepRecordRow = { source, start: startMs, end: endMs, stage };
        // ファイル内の重複レコードも1件に畳む(保存キーと同じ複合キー)
        this.sleepRecords.set(`${source}|${startMs}|${endMs}|${stage}`, rec);
        return;
      }
      case TYPE_STEPS: {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        this.steps.set(key, (this.steps.get(key) ?? 0) + n);
        return;
      }
      case TYPE_HEART_RATE:
        this.accumulate(this.heartRate, key, Number(value));
        return;
      case TYPE_HRV:
        this.accumulate(this.hrv, key, Number(value));
        return;
      case TYPE_RESTING_HR:
        this.accumulate(this.restingHr, key, Number(value));
        return;
      default:
        return; // 未知のレコード型は無視する
    }
  }

  private accumulate(map: Map<string, MinMaxSum>, key: string, n: number): void {
    if (!Number.isFinite(n)) return;
    const cur = map.get(key);
    if (cur) {
      cur.min = Math.min(cur.min, n);
      cur.max = Math.max(cur.max, n);
      cur.sum += n;
      cur.count += 1;
    } else {
      map.set(key, { min: n, max: n, sum: n, count: 1 });
    }
  }

  finish(): ImportResult {
    const dailyMetrics: DailyMetricRow[] = [];
    const split = (key: string): [string, string] => {
      const i = key.indexOf('|');
      return [key.slice(0, i), key.slice(i + 1)];
    };
    for (const [key, sum] of this.steps) {
      const [date, source] = split(key);
      dailyMetrics.push({ metric: 'steps', date, source, value: sum });
    }
    for (const [key, s] of this.heartRate) {
      const [date, source] = split(key);
      dailyMetrics.push({
        metric: 'heartRate',
        date,
        source,
        value: s.sum / s.count,
        min: s.min,
        max: s.max,
      });
    }
    for (const [key, s] of this.hrv) {
      const [date, source] = split(key);
      dailyMetrics.push({ metric: 'hrvSdnn', date, source, value: s.sum / s.count });
    }
    for (const [key, s] of this.restingHr) {
      const [date, source] = split(key);
      dailyMetrics.push({ metric: 'restingHr', date, source, value: s.sum / s.count });
    }
    const warnings =
      this.skippedSleepValues.size > 0
        ? [`未知の睡眠ステージ値をスキップしました: ${[...this.skippedSleepValues].join(', ')}`]
        : [];
    return { dailyMetrics, sleepRecords: [...this.sleepRecords.values()], warnings };
  }
}

/** File をストリーミングで読みながら集約する(メモリに全展開しない) */
export async function parseAppleHealthXml(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<ImportResult> {
  const aggregator = new HealthXmlAggregator();
  const decoder = new TextDecoder();
  const reader = file.stream().getReader();
  let processedBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    processedBytes += value.byteLength;
    aggregator.push(decoder.decode(value, { stream: true }));
    onProgress?.(file.size > 0 ? processedBytes / file.size : 1);
  }
  aggregator.push(decoder.decode());
  return aggregator.finish();
}

export const appleHealthXmlParser: RegisteredParser = {
  id: 'apple-health-xml',
  displayName: 'ヘルスケア標準エクスポート(export.xml)',
  matches: (fileName) => /\.xml$/i.test(fileName),
  // canParseText は実装しない(数百MBの全文読込を防ぐ。拡張子のみで判定)
  importFile: async (file, onProgress) => {
    const summary = await saveImportResult(await parseAppleHealthXml(file, onProgress));
    const range = summary.dateRange ? `(${summary.dateRange[0]}〜${summary.dateRange[1]})` : '';
    return {
      message: `指標${summary.metricCount}件・睡眠${summary.sleepCount}件を保存しました${range}`,
      warnings: summary.warnings,
    };
  },
};
