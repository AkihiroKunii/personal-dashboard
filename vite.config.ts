import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { buildProgramIcs } from './src/features/gym/lib/ics';
import { parseProgramContent } from './src/features/gym/lib/programSchema';

// programs/current.json(コーチング成果物)を単一の真実として、
// ビルド時に program.json(アプリの自動取込用)と program.ics(カレンダー購読用)を
// GitHub Pages の固定URLに配置する(G-F6/G-F7、自動化ファースト §0.5)。
function programAssets(): Plugin {
  const load = () => {
    const path = new URL('./programs/current.json', import.meta.url).pathname;
    if (!existsSync(path)) return null;
    const text = readFileSync(path, 'utf8');
    return { json: text, ics: buildProgramIcs(parseProgramContent(text)) };
  };
  return {
    name: 'program-assets',
    generateBundle() {
      const assets = load();
      if (!assets) return;
      this.emitFile({ type: 'asset', fileName: 'program.json', source: assets.json });
      this.emitFile({ type: 'asset', fileName: 'program.ics', source: assets.ics });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.endsWith('/program.json') && !url.endsWith('/program.ics')) return next();
        const assets = load();
        if (!assets) return next();
        const isIcs = url.endsWith('.ics');
        res.setHeader(
          'Content-Type',
          isIcs ? 'text/calendar; charset=utf-8' : 'application/json; charset=utf-8',
        );
        res.end(isIcs ? assets.ics : assets.json);
      });
    },
  };
}

export default defineConfig({
  base: '/personal-dashboard/',
  plugins: [
    react(),
    programAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '健康ダッシュボード',
        short_name: '健康',
        description: 'バイタル・ジム・習慣の個人用ダッシュボード',
        lang: 'ja',
        display: 'standalone',
        start_url: '/personal-dashboard/',
        scope: '/personal-dashboard/',
        theme_color: '#0b1120',
        background_color: '#0b1120',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: '/personal-dashboard/index.html',
      },
    }),
  ],
});
