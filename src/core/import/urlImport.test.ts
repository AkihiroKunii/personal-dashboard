import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeBase64Utf8, extractImportFragment } from './urlImport';

const sampleJson = readFileSync('docs/samples/daily_export_sample.json', 'utf8');

describe('URLフラグメント取込(V-F7)', () => {
  it('#import= のペイロードを抽出する', () => {
    expect(extractImportFragment('#import=abc')).toBe('abc');
    expect(extractImportFragment('')).toBeNull();
    expect(extractImportFragment('#other=1')).toBeNull();
    expect(extractImportFragment('#import=')).toBeNull();
  });

  it('標準base64(スクリプト生成のURL)をUTF-8復元できる', () => {
    const b64 = Buffer.from(sampleJson, 'utf8').toString('base64');
    expect(decodeBase64Utf8(b64)).toBe(sampleJson);
  });

  it('URL-safe base64・パディング欠落・percent-encodingも受理する', () => {
    const text = '{"日本語":"テスト+/?="}';
    const std = Buffer.from(text, 'utf8').toString('base64');
    const urlSafe = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeBase64Utf8(urlSafe)).toBe(text);
    expect(decodeBase64Utf8(encodeURIComponent(std))).toBe(text);
  });

  it('不正なbase64はエラーにする', () => {
    expect(() => decodeBase64Utf8('!!!!')).toThrow(/base64/);
  });
});
