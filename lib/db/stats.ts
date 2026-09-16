import { getDatabase } from './init';
import { getWordForYear } from './yearWords';
import { getCapsuleForYear } from './entries';

export interface JournalStats {
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  wroteToday: boolean;
}

// "date" sütunu her zaman YYYY-MM-DD formatında saklanıyor (bkz. lib/date.ts:toDateString).
// Ardışıklığı gün sayısına indirgeyip karşılaştırmak için UTC epoch gün numarasına çeviriyoruz;
// bu adım sadece tarih aritmetiği için, saat dilimi kayması riski taşımıyor.
function toEpochDay(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

// Giriş tarihleri (entries.date) üzerinde DISTINCT + ORDER BY, idx_entries_date indeksini
// kullanır; her ekran açılışında tüm satırları/içerikleri taramak yerine sadece benzersiz
// günleri okur, ardından ardışıklık hesabı bellekte (gün sayısı kadar, satır sayısı kadar değil) yapılır.
export async function getJournalStats(todayStr: string): Promise<JournalStats> {
  const database = await getDatabase();

  // capsule_year IS NULL: Yıl Sonu Kapsülü girişleri günlük yazma serisine/toplam
  // sayıya dahil değil — bunlar günlük yazma alışkanlığının bir parçası değil.
  const totalRow = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM entries WHERE capsule_year IS NULL'
  );
  const totalEntries = totalRow?.count ?? 0;

  const dateRows = await database.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM entries WHERE capsule_year IS NULL ORDER BY date DESC'
  );

  if (dateRows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalEntries, wroteToday: false };
  }

  const days = dateRows.map((row) => toEpochDay(row.date));
  const daySet = new Set(days);
  const todayEpoch = toEpochDay(todayStr);
  const wroteToday = daySet.has(todayEpoch);

  let currentStreak = 0;
  let cursor = wroteToday ? todayEpoch : todayEpoch - 1;
  while (daySet.has(cursor)) {
    currentStreak++;
    cursor--;
  }

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i - 1] - days[i] === 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  return { currentStreak, longestStreak, totalEntries, wroteToday };
}

// --- Yıl Sonu Özeti (Wrapped) ---
// Kapsül/Yılın Kelimesi'nin aksine kullanıcının yazdığı bir şey değil — tamamen o
// yılın entries verisinden otomatik hesaplanan, bir kez o yıl bitince kalıcı olarak
// arşivde kalan bir özet (bkz. getWrappedAvailableYears).

export interface YearWrapped {
  year: number;
  totalEntries: number;
  mostActiveMonth: { month: number; count: number } | null;
  categoryBreakdown: { categoryId: string; count: number }[];
  topMood: { mood: string; count: number } | null;
  longestStreakInYear: number;
  firstEntryDate: string | null;
  lastEntryDate: string | null;
  totalPhotos: number;
  totalWords: number;
  longestSingleEntry: { date: string; length: number } | null;
  previousYearComparison: {
    previousYear: number;
    previousTotal: number;
    diff: number;
    percentChange: number;
  } | null;
  yearWord: string | null;
  capsuleText: string | null;
}

interface YearEntryRow {
  date: string;
  content: string;
  mood: string | null;
  category_id: string | null;
}

function topEntryByCount<K extends string | number>(
  counts: Map<K, number>
): { key: K; count: number } | null {
  let best: { key: K; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

// Basit kelime sayımı: gramer/noktalama hassasiyeti gerekmiyor, boşluklara göre
// bölüp boş parçaları eleme yeterli (birden fazla ardışık boşluk/satır sonu olsa da
// yanlış saymaz).
function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export async function getYearWrapped(year: number): Promise<YearWrapped> {
  const database = await getDatabase();
  // capsule_year IS NULL: kapsül girişleri buraya dahil değil, ayrı bir ritüel.
  const rows = await database.getAllAsync<YearEntryRow>(
    `SELECT date, content, mood, category_id FROM entries
     WHERE date BETWEEN ? AND ? AND capsule_year IS NULL
     ORDER BY date ASC`,
    `${year}-01-01`,
    `${year}-12-31`
  );

  const monthCounts = new Map<number, number>();
  const categoryCounts = new Map<string, number>();
  const moodCounts = new Map<string, number>();
  let totalWords = 0;
  let longestSingleEntry: { date: string; length: number } | null = null;

  for (const row of rows) {
    const month = Number(row.date.slice(5, 7));
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    if (row.category_id) {
      categoryCounts.set(row.category_id, (categoryCounts.get(row.category_id) ?? 0) + 1);
    }
    if (row.mood) {
      moodCounts.set(row.mood, (moodCounts.get(row.mood) ?? 0) + 1);
    }
    totalWords += countWords(row.content);
    if (!longestSingleEntry || row.content.length > longestSingleEntry.length) {
      longestSingleEntry = { date: row.date, length: row.content.length };
    }
  }

  const bestMonth = topEntryByCount(monthCounts);
  const bestMood = topEntryByCount(moodCounts);
  const categoryBreakdown = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId, count]) => ({ categoryId, count }));

  // getJournalStats'teki en uzun seri hesabıyla aynı mantık, sadece bu yılın
  // benzersiz tarihleriyle sınırlı (bkz. dosyanın başındaki toEpochDay).
  const uniqueDays = [...new Set(rows.map((r) => r.date))].map(toEpochDay).sort((a, b) => a - b);
  let longestStreakInYear = uniqueDays.length > 0 ? 1 : 0;
  let run = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    run = uniqueDays[i] - uniqueDays[i - 1] === 1 ? run + 1 : 1;
    if (run > longestStreakInYear) longestStreakInYear = run;
  }

  const photoCountRow = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM photos
     WHERE entry_id IN (SELECT id FROM entries WHERE date BETWEEN ? AND ? AND capsule_year IS NULL)`,
    `${year}-01-01`,
    `${year}-12-31`
  );

  const previousYear = year - 1;
  const previousCountRow = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM entries WHERE date BETWEEN ? AND ? AND capsule_year IS NULL`,
    `${previousYear}-01-01`,
    `${previousYear}-12-31`
  );
  const previousTotal = previousCountRow?.count ?? 0;
  const previousYearComparison =
    previousTotal > 0
      ? {
          previousYear,
          previousTotal,
          diff: rows.length - previousTotal,
          percentChange: Math.round(((rows.length - previousTotal) / previousTotal) * 100),
        }
      : null;

  const [yearWordRow, capsuleEntry] = await Promise.all([
    getWordForYear(year),
    getCapsuleForYear(year),
  ]);

  return {
    year,
    totalEntries: rows.length,
    mostActiveMonth: bestMonth ? { month: bestMonth.key, count: bestMonth.count } : null,
    categoryBreakdown,
    topMood: bestMood ? { mood: bestMood.key, count: bestMood.count } : null,
    longestStreakInYear,
    firstEntryDate: rows[0]?.date ?? null,
    lastEntryDate: rows[rows.length - 1]?.date ?? null,
    totalPhotos: photoCountRow?.count ?? 0,
    totalWords,
    longestSingleEntry,
    previousYearComparison,
    yearWord: yearWordRow?.word ?? null,
    capsuleText: capsuleEntry?.content ?? null,
  };
}

// Bir yılın özeti, o yıl bittiği an (bugünün yılından önceki her yıl) kalıcı olarak
// açılır — kilitli/pencereli değil. Hiç girişi olmayan bir yıl için boş bir ekran
// göstermeye gerek yok, bu yüzden en az 1 girişi olma şartı da SQL'de birlikte
// süzülüyor (JS'de ayrıca filtrelemeye gerek kalmasın diye).
export async function getWrappedAvailableYears(): Promise<number[]> {
  const database = await getDatabase();
  const currentYear = new Date().getFullYear();
  const rows = await database.getAllAsync<{ year: number }>(
    `SELECT DISTINCT CAST(substr(date, 1, 4) AS INTEGER) as year FROM entries
     WHERE capsule_year IS NULL AND CAST(substr(date, 1, 4) AS INTEGER) < ?
     ORDER BY year DESC`,
    currentYear
  );
  return rows.map((row) => row.year);
}
