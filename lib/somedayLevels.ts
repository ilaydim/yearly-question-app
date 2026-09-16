import { getDictionary } from './i18n';

const ITEMS_PER_LEVEL = 3;

export interface LevelInfo {
  level: number;
  title: string;
  completedInCurrentLevel: number;
  neededForNextLevel: number;
}

// Her 3 tamamlanan madde = 1 seviye. Unvan listesi 7 girişten oluşuyor (bkz.
// lib/i18n/*.ts somedayList.levelTitles) — 7. seviyeden sonra unvan "Efsanevi
// Hayalci"/"Legendary Dreamer" olarak SABİT kalır, seviye numarası artmaya devam
// eder (bu yüzden index min(level - 1, titles.length - 1) ile clamp'leniyor).
export function getLevelInfo(completedCount: number): LevelInfo {
  const titles = getDictionary().somedayList.levelTitles;
  const level = Math.floor(completedCount / ITEMS_PER_LEVEL) + 1;
  const title = titles[Math.min(level - 1, titles.length - 1)];
  const completedInCurrentLevel = completedCount % ITEMS_PER_LEVEL;
  const neededForNextLevel = ITEMS_PER_LEVEL - completedInCurrentLevel;
  return { level, title, completedInCurrentLevel, neededForNextLevel };
}
