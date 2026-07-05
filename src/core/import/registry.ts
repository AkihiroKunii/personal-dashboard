// パーサ登録制のインポート基盤(§3)。
// ①のJSON/XML・③のプログラムJSON・④の将来データはすべてこの枠組みに登録する。

export interface ImportOutcome {
  /** トースト表示用の結果メッセージ(日本語) */
  message: string;
  warnings: string[];
}

export interface RegisteredParser {
  id: string;
  displayName: string;
  /** ファイル名(拡張子)でこのパーサが候補になるか */
  matches(fileName: string): boolean;
  /**
   * 同一拡張子に複数パーサがあるとき、テキスト内容で担当を判定する。
   * 巨大ファイル(export.xml等)のパーサは実装しないこと(全文読込が走るため)。
   */
  canParseText?(text: string): boolean;
  importFile(file: File, onProgress?: (ratio: number) => void): Promise<ImportOutcome>;
  /** canParseText を実装するパーサは、読込済みテキストからの取込も実装する */
  importText?(text: string): Promise<ImportOutcome>;
}

const parsers: RegisteredParser[] = [];

export function registerParser(parser: RegisteredParser): void {
  if (!parsers.some((p) => p.id === parser.id)) parsers.push(parser);
}

/** ファイルを担当パーサで取り込む(拡張子→必要なら内容で判定) */
export async function importFile(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<ImportOutcome> {
  const candidates = parsers.filter((p) => p.matches(file.name));
  if (candidates.length === 0) {
    throw new Error(`対応していないファイル形式です: ${file.name}(.json / .xml に対応)`);
  }
  if (candidates.length === 1) return candidates[0].importFile(file, onProgress);

  const text = await file.text();
  const chosen = candidates.find((p) => p.canParseText?.(text));
  if (!chosen?.importText) {
    throw new Error(`ファイルの内容を判別できません: ${file.name}`);
  }
  return chosen.importText(text);
}
