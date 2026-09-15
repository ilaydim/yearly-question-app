import { getDatabase } from './init';
import type { Entry } from './types';

export async function createEntry(entry: Entry): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO entries
       (id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    entry.country
  );
}

export async function getEntriesByDate(date: string): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE date = ? ORDER BY created_at DESC',
    date
  );
}

export async function getAllEntries(): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>('SELECT * FROM entries ORDER BY date DESC');
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
       (id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    entry.country
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

export async function deleteEntry(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM entries WHERE id = ?', id);
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
// burada da garanti altına alıyoruz ki her yerden aynı davransın).
export async function searchEntries(query: string, categoryIds: string[]): Promise<Entry[]> {
  const trimmed = query.trim();
  const conditions: string[] = [];
  const params: string[] = [];

  if (trimmed) {
    conditions.push("content LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLikePattern(trimmed)}%`);
  }
  if (categoryIds.length > 0) {
    conditions.push(`category_id IN (${categoryIds.map(() => '?').join(', ')})`);
    params.push(...categoryIds);
  }
  if (conditions.length === 0) return [];

  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    `SELECT * FROM entries WHERE ${conditions.join(' AND ')} ORDER BY date DESC`,
    ...params
  );
}
