// PWAアイコン生成(初回のみ実行し、生成物は public/icons/ にコミットする)
// 使い方: npm run icons
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="pulse" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#818cf8"/>
      <stop offset="1" stop-color="#2dd4bf"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.32" r="0.75">
      <stop offset="0" stop-color="#1d2a4d"/>
      <stop offset="1" stop-color="#0b1120"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#glow)"/>
  <path d="M64 288 h96 l32 -96 48 160 40 -120 24 56 h144"
        fill="none" stroke="url(#pulse)" stroke-width="30"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="256" cy="120" r="26" fill="#2dd4bf"/>
</svg>`;

mkdirSync('public/icons', { recursive: true });
const buf = Buffer.from(svg);
await sharp(buf).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(buf).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(buf).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
console.log('public/icons/ にアイコンを生成しました');
