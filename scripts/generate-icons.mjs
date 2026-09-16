// NOT: Bu script artık sadece native splash ekranının durağan ikonunu (splash-icon-*.png)
// üretiyor — uygulama ikonunun kendisi (assets/icon-light.png, icon-dark.png,
// adaptive-icon-foreground.png) artık halka tasarımından değil, iconikai-icon-pack
// kaynaklı statik bir görselden geliyor (bkz. app.config.js yorumu). O yüzden bu
// script'i çalıştırmak uygulama ikonunu ESKİ halka tasarımına GERİ DÖNDÜRMEZ,
// sadece splash-icon dosyalarını (hâlâ halka tasarımını kullanan) yeniden üretir.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const RADII = [60, 54, 48, 42, 36, 30, 24, 18, 12, 6];

const RING_COLORS = {
  light: [
    '#2EC4B6',
    '#74D9D0',
    '#BAEEEA',
    '#DCF7F5',
    '#F3FCFC',
    '#FFF1DE',
    '#FFD49B',
    '#FFBB60',
    '#FFAD3E',
    '#FF9F1C',
  ],
  dark: [
    '#00487C',
    '#1C557E',
    '#3E6680',
    '#2A6D9A',
    '#0F76BD',
    '#0281D9',
    '#038DEF',
    '#0C99FF',
    '#2BA6FE',
    '#4BB3FD',
  ],
};

function ringCircles(colors) {
  return RADII.map((r, i) => `<circle cx="70" cy="70" r="${r}" fill="${colors[i]}"/>`).join('');
}

function transparentIconSvg(scheme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    ${ringCircles(RING_COLORS[scheme])}
  </svg>`;
}

async function renderPng(svg, size, outPath) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log('✓', path.relative(process.cwd(), outPath));
}

async function main() {
  await mkdir(ASSETS_DIR, { recursive: true });

  // Native splash için durağan ikon (şeffaf zemin, plugin kendi arka plan rengini uyguluyor)
  await renderPng(transparentIconSvg('light'), 512, path.join(ASSETS_DIR, 'splash-icon-light.png'));
  await renderPng(transparentIconSvg('dark'), 512, path.join(ASSETS_DIR, 'splash-icon-dark.png'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
