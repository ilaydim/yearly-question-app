import * as SQLite from 'expo-sqlite';
import questionsData from '../../assets/questions.json';
import questionsDataEn from '../../assets/questions.en.json';
import type { Category } from './types';

const DB_NAME = 'app.db';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  text_en TEXT,
  recurrence_month INTEGER NOT NULL,
  recurrence_day INTEGER NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  category_id TEXT,
  question_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  location_name TEXT,
  country TEXT,
  capsule_year INTEGER,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);

-- "Yılın Kelimesi": entries ile ilgisi yok, ayrı ve küçük bir tablo. Aynı pencere
-- mantığını kullanıyor (bkz. lib/capsule.ts) ama günlük girişi değil.
CREATE TABLE IF NOT EXISTS year_words (
  year INTEGER PRIMARY KEY,
  word TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- "Geleceğe Mektup": entries/capsule ile ilgisi yok — sabit bir yıl döngüsü değil,
-- kullanıcının serbestçe seçtiği bir gelecek tarih. notification_id, o mektup için
-- zamanlanmış yerel bildirimin id'si (bkz. lib/notifications.ts) — mektup henüz
-- açılmadan silinirse bu id ile bildirim de iptal edilebilsin diye tutuluyor;
-- cihaza özgü olduğundan buluta senkronlanmıyor (bkz. lib/supabase/backup.ts).
CREATE TABLE IF NOT EXISTS future_letters (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  unlock_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notification_id TEXT
);

-- "Bir Gün Listesi": tarihe bağlı olmayan dilek/hayal listesi. completed_entry_id
-- BİLEREK bir FOREIGN KEY değil (entries silinebilir/kapsamı dışında kalabilir) —
-- sadece gevşek bir referans, entries.id'ye işaret eder ama karşılığı olmayabilir.
-- list_id de BİLEREK someday_lists(id)'e FK değil — cihazlar arası senkronda (bkz.
-- lib/supabase/backup.ts) bir madde, o listeyi temsil eden satırdan önce bu cihaza
-- inebilir; FK olsaydı bu sıralama farkı senkronu kırardı.
CREATE TABLE IF NOT EXISTS someday_list (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  completed_entry_id TEXT,
  created_at TEXT NOT NULL
);

-- "Bir Gün Listesi"nin kendisi artık çoklu liste destekliyor: her liste burada bir
-- satır. DEFAULT_SOMEDAY_LIST_ID id'li satır orijinal, örtük listeyi temsil eder
-- (is_custom=0, bkz. seedDefaultSomedayList) — free kullanıcı sadece bunu kullanır.
-- Diğer satırlar (is_custom=1) premium kullanıcının oluşturduğu özel listelerdir
-- (bkz. lib/db/somedayList.ts createList).
CREATE TABLE IF NOT EXISTS someday_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- "Hedeflerim": Günlük/Haftalık/Yıllık hedef listeleri. someday_list/seviye sistemiyle
-- HİÇ ilgisi yok, entries ile de bağlantısı yok — tamamen bağımsız bir özellik.
-- period_key, o listenin (bkz. lib/goalPeriods.ts) hangi periyoda ait olduğunu tutar;
-- "güncel" olan zaten period_key = getCurrentPeriodKey(list_type) olan satırlar olarak
-- canlı hesaplanıyor, ayrı bir arşive taşıma/rollover işlemi YOK. is_completed toggle
-- edilebilir (someday_list'in aksine geri alınabilir) — bu yüzden bulut senkronu için
-- (bkz. lib/supabase/backup.ts) bir updated_at sütunu gerekiyor.
CREATE TABLE IF NOT EXISTS goal_items (
  id TEXT PRIMARY KEY,
  list_type TEXT NOT NULL,
  period_key TEXT NOT NULL,
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_items_list_period ON goal_items(list_type, period_key);
`;

export const TRIP_CATEGORY_ID = 'trip';
export const DEFAULT_SOMEDAY_LIST_ID = 'default';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'personal', name: 'Kişisel', color: '#4F46E5', is_default: 1 },
  { id: 'work', name: 'İş', color: '#059669', is_default: 1 },
  { id: 'dream', name: 'Rüya', color: '#7C3AED', is_default: 1 },
  { id: TRIP_CATEGORY_ID, name: 'Gezi', color: '#DB2777', is_default: 1 },
];

interface QuestionSeed {
  id?: string;
  month: number;
  day: number;
  text: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (database) => {
      // SQLite'ta foreign_keys her bağlantıda ayrı ayrı açılmalı (kalıcı bir DB ayarı
      // değil) ve migration'lardan (execAsync(SCHEMA) vb.) ÖNCE açılmalı ki entries/
      // photos tabloları ilk oluşturulduğu andan itibaren FK zorlaması aktif olsun.
      await database.execAsync('PRAGMA foreign_keys = ON;');
      return database;
    });
  }
  return dbPromise;
}

export async function migrate(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(SCHEMA);
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(questions)');
  if (!columns.some((c) => c.name === 'text_en')) {
    await database.execAsync('ALTER TABLE questions ADD COLUMN text_en TEXT');
  }
  const photoColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(photos)');
  if (!photoColumns.some((c) => c.name === 'synced_at')) {
    await database.execAsync('ALTER TABLE photos ADD COLUMN synced_at TEXT');
  }
  const entryColumns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(entries)');
  if (!entryColumns.some((c) => c.name === 'latitude')) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN latitude REAL');
  }
  if (!entryColumns.some((c) => c.name === 'longitude')) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN longitude REAL');
  }
  if (!entryColumns.some((c) => c.name === 'location_name')) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN location_name TEXT');
  }
  if (!entryColumns.some((c) => c.name === 'country')) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN country TEXT');
  }
  if (!entryColumns.some((c) => c.name === 'capsule_year')) {
    await database.execAsync('ALTER TABLE entries ADD COLUMN capsule_year INTEGER');
  }
  const somedayListColumns = await database.getAllAsync<{ name: string }>(
    'PRAGMA table_info(someday_list)'
  );
  if (!somedayListColumns.some((c) => c.name === 'list_id')) {
    // Var olan tüm maddeler tek, örtük listeye aitti — çoklu liste desteği eklenirken
    // hepsi DEFAULT_SOMEDAY_LIST_ID'ye bağlanıyor (bkz. someday_lists tablosunun
    // yorumu ve seedDefaultSomedayList).
    await database.execAsync("ALTER TABLE someday_list ADD COLUMN list_id TEXT NOT NULL DEFAULT 'default'");
  }
  await migrateCategoryIdNullable(database);
  await cleanupOrphanedPhotos(database);
}

// Geçmişte (foreign_keys pragma'sı henüz açılmadan önce, bkz. deleteEntry) silinen
// entry'lerin photos satırları cascade çalışmadığı için yerelde öksüz kalmış olabilir.
// Böyle bir satır artık var olmayan bir entry_id'ye işaret ettiğinden bulutta hiçbir
// zaman karşılığı olmaz ve her backup'ta aynı FK ihlaliyle takılıp kalır. Sorgu
// idempotent olduğu için (öksüz kalan satır yoksa no-op) her açılışta çalıştırmak
// zararsız — ayrı bir "bir kere mi çalıştı" bayrağına gerek yok.
async function cleanupOrphanedPhotos(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(
    'DELETE FROM photos WHERE entry_id NOT IN (SELECT id FROM entries)'
  );
}

// SQLite'ta bir sütunun NOT NULL kısıtını kaldırmanın tek yolu tabloyu yeniden
// oluşturmak (yeni tablo + veri kopyala + eskiyi sil + yeniden adlandır). "Soru
// Günlüğü" artık ayrı bir özellik (yıllık soru sistemi), bir kategori değil — soru
// cevapları zaten question_id ile, kapsüller zaten capsule_year ile işaretleniyor,
// category_id='journal' fazladan/gereksiz bir ikinci işaretti.
async function migrateCategoryIdNullable(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string; notnull: number }>(
    'PRAGMA table_info(entries)'
  );
  const categoryColumn = columns.find((c) => c.name === 'category_id');
  // Sütun yoksa (olmaz) ya da zaten nullable ise (migration daha önce çalıştıysa) atla.
  if (!categoryColumn || categoryColumn.notnull === 0) return;

  // foreign_keys açıkken DROP TABLE, o tabloyu referans alan FK'ler için (photos.entry_id
  // ON DELETE CASCADE) örtük bir "önce hepsini sil" davranışı tetikler — yani aşağıdaki
  // DROP TABLE entries, foreign_keys=ON iken çalışırsa entries_new'e veri zaten kopyalanmış
  // olsa bile TÜM photos satırlarını (senkron olmuş olsun olmasın) sessizce siler. Bu
  // yüzden bu migration süresince foreign_keys'i geçici olarak kapatıyoruz. (PRAGMA,
  // transaction içindeyken değiştirilemediği için withExclusiveTransactionAsync'in
  // DIŞINDA açılıp kapatılıyor.)
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await database.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(`
        CREATE TABLE entries_new (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          content TEXT NOT NULL,
          mood TEXT,
          category_id TEXT,
          question_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          location_name TEXT,
          country TEXT,
          capsule_year INTEGER,
          FOREIGN KEY (category_id) REFERENCES categories(id),
          FOREIGN KEY (question_id) REFERENCES questions(id)
        );

        INSERT INTO entries_new
          (id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country, capsule_year)
        SELECT id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country, capsule_year
        FROM entries;

        DROP TABLE entries;
        ALTER TABLE entries_new RENAME TO entries;
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);

        UPDATE entries SET category_id = NULL WHERE question_id IS NOT NULL OR capsule_year IS NOT NULL;
        DELETE FROM categories WHERE id = 'journal';
      `);
    });
  } finally {
    await database.execAsync('PRAGMA foreign_keys = ON;');
  }
}

export async function seedCategories(): Promise<void> {
  const database = await getDatabase();
  for (const category of DEFAULT_CATEGORIES) {
    await database.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, color, is_default) VALUES (?, ?, ?, ?)',
      category.id,
      category.name,
      category.color,
      category.is_default
    );
  }
}

export async function seedQuestions(): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (txn) => {
    for (const question of questionsData as QuestionSeed[]) {
      const id =
        question.id ??
        `q-${String(question.month).padStart(2, '0')}-${String(question.day).padStart(2, '0')}`;
      await txn.runAsync(
        'INSERT OR IGNORE INTO questions (id, text, recurrence_month, recurrence_day, is_custom) VALUES (?, ?, ?, ?, 0)',
        id,
        question.text,
        question.month,
        question.day
      );
    }
  });
}

// "Bir Gün Listesi"nin orijinal, örtük listesi — seedCategories ile aynı desen
// (INSERT OR IGNORE, bu yüzden idempotent: her app açılışında çağrılması zararsız).
// İsim burada BİLEREK sabit Türkçe (DEFAULT_CATEGORIES'teki isimler gibi) — UI bu
// satırı listelerken is_custom=0 olduğu için ismi değil t.somedayList.title'ı
// gösterir (bkz. app/someday-list.tsx), bu yüzden burada seçilen dil önemsiz.
export async function seedDefaultSomedayList(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT OR IGNORE INTO someday_lists (id, name, is_custom, created_at) VALUES (?, ?, ?, ?)',
    DEFAULT_SOMEDAY_LIST_ID,
    'Bir Gün Listesi',
    0,
    new Date().toISOString()
  );
}

export async function seedQuestionTranslations(): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (txn) => {
    for (const question of questionsDataEn as QuestionSeed[]) {
      await txn.runAsync(
        'UPDATE questions SET text_en = ? WHERE recurrence_month = ? AND recurrence_day = ?',
        question.text,
        question.month,
        question.day
      );
    }
  });
}

// Hesap silme akışında kullanılır. foreign_keys artık her bağlantıda açık (bkz.
// getDatabase) ve photos.entry_id ON DELETE CASCADE tanımlı olduğundan entries
// silinince photos zaten otomatik temizlenir — ama photos'u burada YİNE DE açıkça,
// entries'ten ÖNCE siliyoruz: restoreFromCloud (lib/supabase/backup.ts) bazı eski/
// tutarsız bulut verilerinde (örn. artık var olmayan bir category_id'ye referans veren
// eski bir entry) FK ihlaliyle hata fırlatabiliyor ve bu hata orada yakalanmıyor —
// yani "FK açıkken bir INSERT/UPDATE'in beklenmedik şekilde kırılması" riski bu
// kod tabanında gerçek. Bu yüzden cascade'e tam güvenmek yerine güvenlik ağı olarak
// açık silmeye devam ediyoruz.
export async function deleteAllLocalData(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(
    // someday_lists'ten sadece özel (is_custom=1) listeler silinir — 'default' satırı
    // categories/questions gibi paylaşılan bir seed, kullanıcı verisi değil.
    `DELETE FROM photos; DELETE FROM entries; DELETE FROM year_words; DELETE FROM future_letters;
     DELETE FROM someday_list; DELETE FROM someday_lists WHERE is_custom = 1; DELETE FROM goal_items;`
  );
}

let initPromise: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await migrate();
      await seedCategories();
      await seedQuestions();
      await seedQuestionTranslations();
      await seedDefaultSomedayList();
    })();
  }
  return initPromise;
}
