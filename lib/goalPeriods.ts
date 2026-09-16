import { toDateString } from './date';

// "Hedeflerim" özelliği: Bir Gün Listesi/seviye sistemiyle hiç ilgisi yok, tamamen
// bağımsız. Her liste türünün kendi "periyot anahtarı" var — günlük 'YYYY-MM-DD'
// (bugün), haftalık haftanın Pazartesi tarihi, yıllık 'YYYY'. Bir madde, ekli olduğu
// period_key artık getCurrentPeriodKey ile eşleşmeyince otomatik olarak "geçmiş"
// sayılır (bkz. lib/db/goals.ts) — ayrı bir rollover job'ı yok.
export type GoalListType = 'daily' | 'weekly' | 'yearly';

// toDateString gibi UTC gün sınırına göre çalışıyor (bkz. lib/date.ts) ki tüm tarih
// alanlarıyla tutarlı olsun. Pazartesi = haftanın başlangıcı.
function getMondayOfWeek(date: Date): Date {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay(); // 0 = Pazar, 1 = Pazartesi, ..., 6 = Cumartesi
  const diff = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return utcDate;
}

export function getCurrentPeriodKey(listType: GoalListType, now: Date = new Date()): string {
  switch (listType) {
    case 'daily':
      return toDateString(now);
    case 'weekly':
      return toDateString(getMondayOfWeek(now));
    case 'yearly':
      return String(now.getUTCFullYear());
  }
}
