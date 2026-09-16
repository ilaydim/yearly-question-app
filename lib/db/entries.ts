import { getDatabase } from './init';
import { generateId } from './id';
import { toDateString } from '../date';
import type { Entry } from './types';

export async function createEntry(entry: Entry): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO entries
       (id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country, capsule_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.date,
    entry.content,
    entry.mood,
    entry.category_id,
    entry.question_id,
    entry.created_at,
    entry.updated_at,
    entry.latitude,
    entry.longitude,
    entry.location_name,
    entry.country,
    entry.capsule_year
  );
}

// Not: capsule_year IS NULL filtresi bilerek YOK — bu fonksiyon şu an hiçbir yerde
// kullanılmıyor ama ileride kullanılırsa diğer tüm listeleme sorgularıyla aynı
// davranışı (kapsülleri gizleme) miras alsın diye burada da ekliyoruz.
export async function getEntriesByDate(date: string): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE date = ? AND capsule_year IS NULL ORDER BY created_at DESC',
    date
  );
}

export async function getAllEntries(): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE capsule_year IS NULL ORDER BY date DESC'
  );
}

// "Geçmiş Yıllarda Bugün" carousel'i için: date her zaman 'YYYY-MM-DD' formatında
// saklandığından ay/gün substr ile karşılaştırılıyor, bugünün yılı hariç tutuluyor.
// ORDER BY date DESC, aynı ay/gün için yıl DESC ile aynı anlama geldiğinden (tarih
// string'inin baş kısmı yıl), en yeni yıldan en eskiye sıralamayı otomatik veriyor.
export async function getEntriesForMonthDay(
  month: number,
  day: number,
  excludeYear: number
): Promise<Entry[]> {
  const database = await getDatabase();
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return database.getAllAsync<Entry>(
    `SELECT * FROM entries
     WHERE substr(date, 6, 2) = ? AND substr(date, 9, 2) = ? AND substr(date, 1, 4) != ?
       AND capsule_year IS NULL
     ORDER BY date DESC`,
    mm,
    dd,
    String(excludeYear)
  );
}

export async function getEntriesUpdatedSince(sinceIso: string): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE updated_at > ? ORDER BY updated_at ASC',
    sinceIso
  );
}

export async function hasAnyEntries(): Promise<boolean> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ x: number }>('SELECT 1 as x FROM entries LIMIT 1');
  return row != null;
}

// Restore sırasında kullanılır: id zaten buluttan geldiği için deterministik —
// aynı giriş yerelde zaten varsa (id çakışırsa) sessizce atlanır.
export async function insertEntryIfMissing(entry: Entry): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT OR IGNORE INTO entries
       (id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country, capsule_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.date,
    entry.content,
    entry.mood,
    entry.category_id,
    entry.question_id,
    entry.created_at,
    entry.updated_at,
    entry.latitude,
    entry.longitude,
    entry.location_name,
    entry.country,
    entry.capsule_year
  );
  return result.changes > 0;
}

export async function getEntryById(id: string): Promise<Entry | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Entry>('SELECT * FROM entries WHERE id = ?', id);
}

export async function updateEntry(
  id: string,
  updates: Partial<
    Pick<
      Entry,
      | 'date'
      | 'content'
      | 'mood'
      | 'category_id'
      | 'question_id'
      | 'latitude'
      | 'longitude'
      | 'location_name'
      | 'country'
    >
  >
): Promise<void> {
  const fields = Object.keys(updates) as Array<keyof typeof updates>;
  if (fields.length === 0) return;

  const database = await getDatabase();
  const setClause = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => updates[field] ?? null);

  await database.runAsync(
    `UPDATE entries SET ${setClause}, updated_at = ? WHERE id = ?`,
    ...values,
    new Date().toISOString(),
    id
  );
}

// photos.entry_id -> entries.id FK'si ON DELETE CASCADE tanımlı ve foreign_keys artık
// her bağlantıda açık (bkz. lib/db/init.ts getDatabase), yani cascade gerçekten
// çalışıyor. Yine de photos'u burada açıkça siliyoruz — güvenlik ağı olarak (bkz.
// lib/db/init.ts deleteAllLocalData yorumu: FK açıkken restoreFromCloud gibi başka
// yollarla yakalanmayan bir FK ihlali oluşabiliyor, o yüzden cascade'e tek başına
// güvenmiyoruz). Bunsuz, entry silindikten sonra da o entry_id'ye sahip yerel photos
// satırı kalabilir ve her backup'ta bulutta artık var olmayan (silinmiş) entry'ye
// referans vererek FK ihlaliyle sonsuza dek başarısız olmaya devam eder.
export async function deleteEntry(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM photos WHERE entry_id = ?', id);
    await txn.runAsync('DELETE FROM entries WHERE id = ?', id);
  });
}

// Harita sekmesi için: konum bilgisi olan (latitude/longitude dolu) tüm girişler.
// Kategoriye göre filtrelemiyoruz çünkü latitude/longitude zaten sadece "trip" formundan
// yazılıyor — ileride başka kategoriler de konum eklerse bu sorgu değişiklik gerektirmez.
export async function getEntriesWithLocation(): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE latitude IS NOT NULL AND longitude IS NOT NULL ORDER BY date DESC'
  );
}

// LIKE deseninde özel anlamı olan karakterleri (% ve _) kaçırıyoruz, yoksa kullanıcının
// arama metnindeki bu karakterler yanlışlıkla joker karakter gibi davranır.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Boş sorgu + boş kategori seçimi → boş sonuç (çağıran taraf da bunu bekliyor, ama
// burada da garanti altına alıyoruz ki her yerden aynı davransın). capsule_year
// filtresi ise KOŞULSUZ ekleniyor — kapsüller arama sonuçlarında hiç görünmemeli.
export async function searchEntries(query: string, categoryIds: string[]): Promise<Entry[]> {
  const trimmed = query.trim();
  const conditions: string[] = ['capsule_year IS NULL'];
  const params: string[] = [];
  let hasUserCriteria = false;

  if (trimmed) {
    conditions.push("content LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLikePattern(trimmed)}%`);
    hasUserCriteria = true;
  }
  if (categoryIds.length > 0) {
    conditions.push(`category_id IN (${categoryIds.map(() => '?').join(', ')})`);
    params.push(...categoryIds);
    hasUserCriteria = true;
  }
  if (!hasUserCriteria) return [];

  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE ${conditions.join(' AND ')} ORDER BY date DESC`,
    ...params
  );
}

// --- Yıl Sonu Kapsülü ---

export async function getCapsuleForYear(year: number): Promise<Entry | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Entry>(
    'SELECT * FROM entries WHERE capsule_year = ?',
    year
  );
}

// Premium'un "Tüm Kapsüllerin" listesi için — en yeni yıldan en eskiye.
export async function getAllCapsules(): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE capsule_year IS NOT NULL ORDER BY capsule_year DESC'
  );
}

// O yıl için zaten bir kapsül varsa günceller, yoksa oluşturur. Kapsüller bir
// kategori değil, kendi başına ayrı bir özellik — category_id artık nullable
// olduğundan (bkz. migrateCategoryIdNullable) burada gerçek bir kategoriye
// ihtiyaç yok, doğrudan NULL veriyoruz.
export async function upsertCapsule(year: number, content: string): Promise<void> {
  const existing = await getCapsuleForYear(year);
  const now = new Date().toISOString();

  if (existing) {
    await updateEntry(existing.id, { content });
    return;
  }

  await createEntry({
    id: generateId(),
    date: toDateString(new Date()),
    content,
    mood: null,
    category_id: null,
    question_id: null,
    created_at: now,
    updated_at: now,
    latitude: null,
    longitude: null,
    location_name: null,
    country: null,
    capsule_year: year,
  });
}
