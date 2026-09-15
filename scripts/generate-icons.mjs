// Halka verileri: lib/rings.ts ile senkron tut (kaynak: design/icon-splash-concept.html).
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SIZES_DIR = path.join(ASSETS_DIR, 'icon-sizes');

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

const REST_BG = { light: '#FFFFFF', dark: '#00487C' };

function ringCircles(colors) {
  return RADII.map((r, i) => `<circle cx="70" cy="70" r="${r}" fill="${colors[i]}"/>`).join('');
}

function opaqueIconSvg(scheme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    <rect width="140" height="140" fill="${REST_BG[scheme]}"/>
    ${ringCircles(RING_COLORS[scheme])}
  </svg>`;
}

function backgroundOnlySvg(scheme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    <rect width="140" height="140" fill="${REST_BG[scheme]}"/>
  </svg>`;
}

function transparentIconSvg(scheme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    ${ringCircles(RING_COLORS[scheme])}
  </svg>`;
}

// Android adaptive-icon safe zone ~%66 çap; %55'e küçültüp merkeze alıyoruz (güvenli pay).
function adaptiveForegroundSvg(scheme) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    <g transform="translate(70 70) scale(0.55) translate(-70 -70)">
      ${ringCircles(RING_COLORS[scheme])}
    </g>
  </svg>`;
}

function monochromeSvg() {
  const circles = RADII.map((r) => `<circle cx="70" cy="70" r="${r}" fill="#000000"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
    <g transform="translate(70 70) scale(0.55) translate(-70 -70)">${circles}</g>
  </svg>`;
}

async function renderPng(svg, size, outPath, { flattenBg } = {}) {
  let pipeline = sharp(Buffer.from(svg), { density: 384 }).resize(size, size);
  if (flattenBg) pipeline = pipeline.flatten({ background: flattenBg });
  await pipeline.png().toFile(outPath);
  console.log('✓', path.relative(process.cwd(), outPath));
}

const EXTRA_SIZES = [512, 192, 180, 167, 152, 120, 87, 80, 76, 60, 40, 29];

async function main() {
  await mkdir(ASSETS_DIR, { recursive: true });
  await mkdir(SIZES_DIR, { recursive: true });

  // Ana ikon (opak — App Store alfa kanalı içeren ikonları reddedebiliyor, flatten şart)
  await renderPng(opaqueIconSvg('light'), 1024, path.join(ASSETS_DIR, 'icon-light.png'), {
    flattenBg: REST_BG.light,
  });
  await renderPng(opaqueIconSvg('dark'), 1024, path.join(ASSETS_DIR, 'icon-dark.png'), {
    flattenBg: REST_BG.dark,
  });

  // Android adaptive icon (tek varyant — Android app.json'da light/dark ayrımını desteklemiyor)
  await renderPng(
    adaptiveForegroundSvg('light'),
    1024,
    path.join(ASSETS_DIR, 'adaptive-icon-foreground.png')
  );
  await renderPng(
    backgroundOnlySvg('light'),
    1024,
    path.join(ASSETS_DIR, 'adaptive-icon-background.png'),
    { flattenBg: REST_BG.light }
  );
  await renderPng(monochromeSvg(), 1024, path.join(ASSETS_DIR, 'adaptive-icon-monochrome.png'));

  // Native splash için durağan ikon (şeffaf zemin, plugin kendi arka plan rengini uyguluyor)
  await renderPng(transparentIconSvg('light'), 512, path.join(ASSETS_DIR, 'splash-icon-light.png'));
  await renderPng(transparentIconSvg('dark'), 512, path.join(ASSETS_DIR, 'splash-icon-dark.png'));

  // Referans için ek boyutlar (Expo, app.json'daki 1024'lük kaynaktan platform boyutlarını
  // kendi build sürecinde otomatik üretir; bunlar sadece manuel ihtiyaçlar için)
  for (const scheme of ['light', 'dark']) {
    for (const size of EXTRA_SIZES) {
      await renderPng(
        opaqueIconSvg(scheme),
        size,
        path.join(SIZES_DIR, `icon-${scheme}-${size}.png`),
        { flattenBg: REST_BG[scheme] }
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
