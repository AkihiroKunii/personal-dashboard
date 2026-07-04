import { describe, expect, it } from 'vitest';
import {
  DAILY_EXPORT_SOURCE,
  normalizeSourceName,
  orderByPriority,
  pickPreferred,
  sourceLabel,
} from './sources';

describe('sources(ノーブレークスペース正規化と優先ソース選択)', () => {
  it('NBSPを半角スペースに正規化する', () => {
    // 実データ確認済み: "USER's Apple (U+00A0) Watch"
    expect(normalizeSourceName('USER’s Apple\u00a0Watch')).toBe("USER’s Apple Watch");
    expect(normalizeSourceName('  SOXAI RING ')).toBe('SOXAI RING');
  });

  it('NBSP有無で同一ソースと判定できる', () => {
    expect(normalizeSourceName('USER’s Apple\u00a0Watch')).toBe(
      normalizeSourceName('USER’s Apple Watch'),
    );
  });

  it('空source(日次エクスポート)を許容しラベル表示する', () => {
    expect(normalizeSourceName('')).toBe(DAILY_EXPORT_SOURCE);
    expect(sourceLabel(DAILY_EXPORT_SOURCE)).toBe('日次エクスポート');
  });

  it('既定の優先順は日次エクスポートが最優先', () => {
    expect(orderByPriority(['SOXAI RING', '', 'Apple Watch'], [])).toEqual([
      '',
      'Apple Watch',
      'SOXAI RING',
    ]);
  });

  it('設定した優先順位が既定順より優先される', () => {
    expect(orderByPriority(['', 'SOXAI RING', 'Apple Watch'], ['SOXAI RING'])).toEqual([
      'SOXAI RING',
      '',
      'Apple Watch',
    ]);
  });

  it('pickPreferredは最上位ソースの値のみ返す(合算しない)', () => {
    const bySource = new Map([
      ['SOXAI RING', 100],
      ['', 200],
    ]);
    expect(pickPreferred(bySource, [])).toBe(200);
    expect(pickPreferred(bySource, ['SOXAI RING'])).toBe(100);
    expect(pickPreferred(new Map<string, number>(), [])).toBeUndefined();
  });
});
