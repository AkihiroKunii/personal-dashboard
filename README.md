# personal-dashboard

Personal health &amp; training dashboard PWA (vitals / gym / habits). Client-side only, no server — data stays in the browser. Deployed via GitHub Pages.

- 公開URL: https://akihirokunii.github.io/personal-dashboard/
- 要件: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) / 開発規約: [CLAUDE.md](CLAUDE.md)

## 開発

```
npm ci
npm run dev        # http://localhost:5173/personal-dashboard/
npm test           # 単体テスト
npm run build      # 型チェック + ビルド
npm run import-url # サンプルJSONから #import= 検証URLを生成(V-F7)
```

main への push で GitHub Actions がテスト・ビルドし GitHub Pages へ自動デプロイする。

## ジムのトレーニングプログラム(③)

`programs/current.json`(§2.3a のスキーマ)を**単一の真実**とする。ここを更新して push すると、ビルド時に以下が公開URLに配置され、カレンダーとアプリの両方へ自動反映される:

- `program.json` — アプリが起動時に自動取込(差分があるときだけ)
- `program.ics` — Googleカレンダーの購読用

月次コーチングでメニューを見直したら、`programs/current.json` を書き換えてコミットするだけでよい。

### カレンダー購読(初回1回)

1. Googleカレンダー →「他のカレンダー」＋ →「URL で追加」
2. `https://akihirokunii.github.io/personal-dashboard/program.ics` を登録
3. 週初め(月)に今週の全体メニュー、各トレ日の朝7:00に当日メニューの予定が入る

> ⚠️ **公開範囲**: `program.ics` / `program.json` は GitHub Pages 上の**公開URL**であり、トレーニングメニュー(種目・セット数)は誰でも閲覧可能。健康・睡眠データ(①)は公開されず端末内のみ。
> Google カレンダーの購読は登録した VALARM(通知)を無視することがあるため、通知が必要なら購読カレンダー側の「デフォルトの通知」を設定する。

アプリ内の「計画」タブから `.ics` を手動ダウンロードして取り込むこともできる(フォールバック)。
