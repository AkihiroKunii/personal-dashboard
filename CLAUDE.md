# CLAUDE.md — personal-dashboard 開発ガイド

個人用健康ダッシュボードPWA。利用者は開発者本人のみ。UIは日本語。
**セッション開始時にまず本書を読み、詳細仕様は [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) の該当セクションを参照すること。**

## 確定事項(変更不可 — REQUIREMENTS §0.1)

- PWA(iPhone + ホーム画面追加)。ネイティブアプリ不採用
- 対象ブラウザ = ユーザーの既定ブラウザ(現在 iPhone の Chrome)。**Safari固有機能に依存しない**。IndexedDBはブラウザ単位のため単一ブラウザ運用前提
- ホスティング = GitHub Pages(無料枠のみ)。サーバーなし・完全クライアントサイド。**健康データを外部送信しない**
- アナリティクス・外部フォント・CDN依存の禁止(プライバシー + オフライン動作のため)
- データ永続化 = IndexedDB。データ入力 = ファイルインポート + URLフラグメント連携
- Web Push は使わない(通知はicsカレンダー購読で代替。§2.3 G-F7)

## 設計原則: 自動化ファースト(§0.5 — 全設計判断に優先適用)

1. 反復操作は設計課題として扱う(毎日・毎週の手動操作は自動化・統合・削減を必ず検討)
2. タップ数を設計指標にする(日次定常運用は「朝の通知1タップ+アプリ内数タップ」以内)
3. ファイル選択より自動連携を優先(ファイルピッカーは常にフォールバック)
4. 「開いたら終わっている」状態を作る(ショートカット→URL起動で取込済みが標準動線)
5. 設定は一度きり(初回セットアップの手間は許容、定常運用に手作業を残さない)

## 技術スタック

React + TypeScript(strict) + Vite / Recharts(`<ErrorBar>` がG-F3のエラーバー要件を満たすことを検証済み) / Dexie.js + dexie-react-hooks / vite-plugin-pwa / Vitest + fake-indexeddb。
Vite の `base` は `/personal-dashboard/`。デプロイは push(main) → GitHub Actions → GitHub Pages(Source: GitHub Actions 設定済み)。
公開URL: https://akihirokunii.github.io/personal-dashboard/

## リポジトリ構成

```
CLAUDE.md                        # 本書
docs/REQUIREMENTS.md             # 要件定義(正)
docs/habit-algorithm.md          # ④習慣化エンジン仕様
docs/samples/                    # 実データ由来のサンプル(テストのフィクスチャ)
scripts/make-import-url.mjs      # JSONから #import= 検証URLを生成
scripts/generate-icons.mjs       # PWAアイコン生成(生成物はコミット済み)
src/app/                         # PWAシェル・タブナビ・トースト・#import起動処理
src/core/                        # 共通層: db, 日付, インポート基盤, 健康データ処理, チャート部品
  core/import/registry.ts        # パーサ登録制。新データ形式はここに登録する(①JSON/XML・③プログラムJSON・④が同じ枠組みに乗る)
  core/health/stageMap.ts        # 睡眠ステージ表記のマッピング表(集約箇所。ここ以外で表記文字列を解釈しない)
  core/health/sources.ts         # ソース名正規化・優先ソース解決(集約箇所)
  core/charts/TimeSeriesChart.tsx# 共通日次時系列チャート(範囲切替・2軸・エラーバー)
src/features/vitals|gym|habit/   # 機能別UI
packages/habit-engine/           # ④エンジン(フェーズ3で作成。純粋関数・UI非依存・単体テスト必須)
```

## フェーズ分割と現在地(§0.4)

1. ~~フェーズ1: PWAシェル + core + ①バイタル + 初回デプロイ~~ ← **完了(本セッション)**
2. フェーズ2a: ③記録+可視化(G-F1〜G-F5)
3. フェーズ2b: ③プログラム実行支援(G-F6〜G-F11、ics生成Actions)
4. フェーズ3以降: ④習慣化(docs/habit-algorithm.md のフェーズ表に従う)

フェーズ2以降の未着手事項: バックアップJSONエクスポート/インポート(§5)、睡眠ステージ表示、ジム・習慣タブの実装。

## コーディング規約

- TypeScript strict。UI文言・エラーメッセージは日本語
- 依存追加は最小限に。外部CDN・外部フォント読み込み禁止(すべてバンドル)
- ルーターは使わない(タブはstate管理)。**hashルーティング禁止** — `#import=` フラグメント(V-F7)と衝突する
- ソース名の比較・表示は必ず `core/health/sources.ts` の `normalizeSourceName` を通す
- 睡眠ステージ文字列の解釈は必ず `core/health/stageMap.ts` を通す
- 日付処理は `core/dates.ts` を使う(Asia/Tokyo固定、端末TZ非依存の実装)
- インポートは必ず registry 経由で冪等(同一キーは上書き)に保存する
- データ処理ロジック(パーサ・セッション化・集計)には単体テストを付ける。UIコンポーネントのテストは必須ではない
- コミットは日本語または英語どちらでも可。main へ直接 push(個人開発)

## コマンド

```
npm run dev        # 開発サーバー(http://localhost:5173/personal-dashboard/)
npm test           # 単体テスト(vitest run)
npm run build      # 型チェック + ビルド
npm run import-url # サンプルJSONから #import= 検証URLを生成
```

## 実データで確認済みの罠(フェーズ1で対処済み。今後も遵守)

- **sourceName にノーブレークスペース**(`USER's Apple Watch`)が含まれる。比較前に必ず正規化
- **日次JSON(§1.3a)の source は空文字列**があり得る(正常)。数値がクォート付き文字列の場合もある(両方受理)
- **export.xml の抜粋サンプルは整形式XMLではない**(`<Record>` 未閉鎖)。実運用ファイルは264MB。→ XMLパーサは整形式性に依存しないタグ走査型ストリーミング(全展開禁止、V-F3b)。未知レコード型は無視する寛容設計
- **睡眠の帰属は連続セッション単位・起床日基準**(§1.4 + ユーザー確認済み): 隣接レコード(隙間30分以内)を1セッションに束ね、セッション開始がJST正午前→その日、正午以降→翌日に帰属。**レコード単位の正午判定は禁止**(正午をまたぐ実セッションあり)
- **実睡眠時間 = Core/Deep/REM/Asleep(未分類) の合計。InBed と Awake は除外**(ユーザー確認済み)
- **多ソース(SOXAI RING / Apple Watch / iPhone 等)は合算しない**。日×指標ごとにソース別保存し、表示時は優先順位最上位のソースのみ採用(設定で変更可、既定は日次エクスポート='' が最優先)。Plan B(XML)→Plan A(JSON)の重複期間の二重計上はこの機構で防止
- 睡眠ステージのXML表記は `HKCategoryValueSleepAnalysisAsleepCore` 等、日次JSONは `"Core"` 等で別表記。マッピングは stageMap.ts に集約済み
