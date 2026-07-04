import type { ImportResult } from '../types';
import { saveImportResult, type ImportSummary } from './importer';

// パーサ登録制のインポート基盤(§3)。
// ①のJSON/XML・③のプログラムJSON・④の将来データはすべてこの枠組みに登録する。

export interface RegisteredParser {
  id: string;
  displayName: string;
  /** ファイル名等からこのパーサが担当するか判定する */
  matches(fileName: string): boolean;
  parse(file: File, onProgress?: (ratio: number) => void): Promise<ImportResult>;
}

const parsers: RegisteredParser[] = [];

export function registerParser(parser: RegisteredParser): void {
  if (!parsers.some((p) => p.id === parser.id)) parsers.push(parser);
}

export function findParser(fileName: string): RegisteredParser | undefined {
  return parsers.find((p) => p.matches(fileName));
}

/** ファイルを担当パーサでパースし、IndexedDBへ冪等保存する */
export async function importFile(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<ImportSummary> {
  const parser = findParser(file.name);
  if (!parser) {
    throw new Error(`対応していないファイル形式です: ${file.name}(.json / .xml に対応)`);
  }
  const result = await parser.parse(file, onProgress);
  return saveImportResult(result);
}
