import { getDatabase } from './init';

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

  const totalRow = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM entries'
  );
  const totalEntries = totalRow?.count ?? 0;

  const dateRows = await database.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM entries ORDER BY date DESC'
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
