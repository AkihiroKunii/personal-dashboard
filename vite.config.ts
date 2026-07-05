import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/personal-dashboard/',
  plugins: [
    react(),
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
