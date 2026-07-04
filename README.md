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
