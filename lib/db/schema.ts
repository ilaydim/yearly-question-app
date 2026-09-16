import type { Entry } from './types';

// entries tablosundaki, buluttaki journal_entries ile senkronlanan TÜM sütunlar —
// lib/supabase/backup.ts hem yedeklerken (toCloudEntry) hem geri yüklerken
// (restoreFromCloud) SADECE bu listeyi kullanıyor, alan adlarını tek tek elle
// yazmıyor. Yeni bir sütun eklendiğinde tek yapılması gereken şey bunu hem Entry
// arayüzüne (lib/db/types.ts) hem aşağıdaki ENTRY_COLUMN_FLAGS'e eklemek.
//
// ENTRY_COLUMN_FLAGS bilerek Record<keyof Entry, true> olarak yazıldı: Entry'ye yeni
// bir alan eklenip burası güncellenmezse (ya da burada olmayan bir alan yazılırsa)
// TypeScript derleme hatası verir — yani "unutma riski" derleme zamanında yakalanır,
// sadece kod incelemesine güvenilmez.
const ENTRY_COLUMN_FLAGS: Record<keyof Entry, true> = {
  id: true,
  date: true,
  content: true,
  mood: true,
  category_id: true,
  question_id: true,
  latitude: true,
  longitude: true,
  location_name: true,
  country: true,
  capsule_year: true,
  created_at: true,
  updated_at: true,
};

export const SYNCED_ENTRY_COLUMNS: readonly (keyof Entry)[] = Object.keys(
  ENTRY_COLUMN_FLAGS
) as (keyof Entry)[];
