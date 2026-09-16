import { getDatabase, DEFAULT_SOMEDAY_LIST_ID } from './init';
import { generateId } from './id';
import { toDateString } from '../date';
import { createEntry } from './entries';
import { addPhoto } from './photos';

export { DEFAULT_SOMEDAY_LIST_ID };

export interface SomedayList {
  id: string;
  name: string;
  is_custom: 0 | 1;
  created_at: string;
}

export interface SomedayItem {
  id: string;
  list_id: string;
  title: string;
  is_completed: 0 | 1;
  completed_at: string | null;
  completed_entry_id: string | null;
  created_at: string;
}

// 'default' (is_custom=0) her zaman en başta, özel listeler oluşturulma sırasına göre.
export async function getAllLists(): Promise<SomedayList[]> {
  const database = await getDatabase();
  return database.getAllAsync<SomedayList>(
    'SELECT * FROM someday_lists ORDER BY is_custom ASC, created_at ASC'
  );
}

// Premium kontrolü (useIsPremiumUser) BURADA değil, UI'da yapılır — diğer premium
// özelliklerle aynı desen (bkz. lib/premium.ts, app/(tabs)/map.tsx).
export async function createList(name: string): Promise<SomedayList> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Liste adı boş olamaz.');

  const list: SomedayList = {
    id: generateId(),
    name: trimmed,
    is_custom: 1,
    created_at: new Date().toISOString(),
  };

  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO someday_lists (id, name, is_custom, created_at) VALUES (?, ?, ?, ?)',
    list.id,
    list.name,
    list.is_custom,
    list.created_at
  );
  return list;
}

// lib/supabase/backup.ts'in syncSomedayLists'i için: id yerelde yoksa buluttaki
// hâliyle ekler. Listeler oluşturulduktan sonra değişmez (isim/is_custom hiç
// güncellenmiyor), bu yüzden mergeFromCloud'daki gibi bir "hangisi daha yeni" kontrolü
// gerekmiyor.
export async function insertListIfMissing(list: SomedayList): Promise<boolean> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM someday_lists WHERE id = ?',
    list.id
  );
  if (existing) return false;

  await database.runAsync(
    'INSERT INTO someday_lists (id, name, is_custom, created_at) VALUES (?, ?, ?, ?)',
    list.id,
    list.name,
    list.is_custom,
    list.created_at
  );
  return true;
}

// Tamamlanmamışlar üstte (eklenme sırasına göre, en eskiden en yeniye — bir listeyi
// sırayla "işleme" hissini korur), tamamlananlar altta (en son tamamlanan en üstte,
// küçük bir "başarı geçmişi" gibi). Tek bir ORDER BY yerine iki ayrı sorgu + birleştirme
// daha okunaklı, is_completed=0/1 gruplarının her biri kendi mantığıyla sıralanıyor.
export async function getItemsForList(listId: string): Promise<SomedayItem[]> {
  const database = await getDatabase();
  const [incomplete, completed] = await Promise.all([
    database.getAllAsync<SomedayItem>(
      'SELECT * FROM someday_list WHERE list_id = ? AND is_completed = 0 ORDER BY created_at ASC',
      listId
    ),
    database.getAllAsync<SomedayItem>(
      'SELECT * FROM someday_list WHERE list_id = ? AND is_completed = 1 ORDER BY completed_at DESC',
      listId
    ),
  ]);
  return [...incomplete, ...completed];
}

// Liste filtresi OLMADAN TÜM maddeler — sadece lib/supabase/backup.ts'in tam
// karşılaştırmalı senkronu (syncSomedayList) için, tek bir listenin UI'ı için DEĞİL
// (bkz. getItemsForList).
export async function getAllItems(): Promise<SomedayItem[]> {
  const database = await getDatabase();
  return database.getAllAsync<SomedayItem>('SELECT * FROM someday_list');
}

// list_id'den BİLEREK bağımsız: seviye/unvan sistemi tüm listelerdeki (orijinal +
// özel) tamamlamaların toplamına dayanıyor, tek bir listeye filtrelenmiyor.
export async function getCompletedCount(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM someday_list WHERE is_completed = 1'
  );
  return row?.count ?? 0;
}

export async function addItem(listId: string, title: string): Promise<SomedayItem> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Başlık boş olamaz.');

  const item: SomedayItem = {
    id: generateId(),
    list_id: listId,
    title: trimmed,
    is_completed: 0,
    completed_at: null,
    completed_entry_id: null,
    created_at: new Date().toISOString(),
  };

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO someday_list (id, list_id, title, is_completed, completed_at, completed_entry_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.list_id,
    item.title,
    item.is_completed,
    item.completed_at,
    item.completed_entry_id,
    item.created_at
  );
  return item;
}

export interface CompleteItemOptions {
  reflectionText?: string;
  photoUri?: string;
}

// reflectionText ya da photoUri verilirse GERÇEK bir günlük girişi (entries) oluşturulur
// — kapsül/Geleceğe Mektup gibi gizli bir şey DEĞİL, normal Ana Sayfa/Arama/Takvim
// akışında görünen, kutlanacak bir an. category_id/question_id NULL (upsertCapsule'daki
// desenle aynı — bir kategoriye ait değil, kendi başına bir özellik). İkisi de
// verilmezse hiç entries satırı oluşturulmaz, completed_entry_id null kalır.
export async function completeItem(id: string, options: CompleteItemOptions = {}): Promise<void> {
  const database = await getDatabase();
  const item = await database.getFirstAsync<SomedayItem>(
    'SELECT * FROM someday_list WHERE id = ?',
    id
  );
  if (!item) return;

  const completedAt = new Date().toISOString();
  const trimmedReflection = options.reflectionText?.trim();
  let completedEntryId: string | null = null;

  if (trimmedReflection || options.photoUri) {
    completedEntryId = generateId();
    await createEntry({
      id: completedEntryId,
      date: toDateString(new Date()),
      // Kullanıcı sadece fotoğraf ekleyip metin yazmamış olabilir — content NOT NULL
      // olduğundan, boşsa maddenin başlığına düşüyoruz ("Kilimanjaro'ya tırman" gibi
      // anlamlı bir varsayılan, boş bir giriş yerine).
      content: trimmedReflection || item.title,
      mood: null,
      category_id: null,
      question_id: null,
      created_at: completedAt,
      updated_at: completedAt,
      latitude: null,
      longitude: null,
      location_name: null,
      country: null,
      capsule_year: null,
    });
    if (options.photoUri) {
      await addPhoto(completedEntryId, options.photoUri);
    }
  }

  await database.runAsync(
    'UPDATE someday_list SET is_completed = 1, completed_at = ?, completed_entry_id = ? WHERE id = ?',
    completedAt,
    completedEntryId,
    id
  );
}

// Sadece someday_list satırını siler — bağlı bir entries satırı varsa ona DOKUNMAZ.
// completeItem sonrası oluşan giriş artık bağımsız, gerçek bir günlük yazısı; kullanıcı
// dilek listesinden bu maddeyi kaldırsa bile o anıyı günlüğünde tutmaya devam eder.
export async function deleteItem(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM someday_list WHERE id = ?', id);
}

// lib/supabase/backup.ts'in syncSomedayList'i için: id yerelde yoksa buluttaki hâliyle
// ekler, varsa (ve yerelde hâlâ tamamlanmamışsa) buluttaki tamamlanma durumuyla
// eşitler. completeItem'ın AKSİNE yeni bir entries satırı OLUŞTURMAZ — o satır zaten
// tamamlamayı yapan cihazda oluşturulmuştu; completed_entry_id burada sadece taşınan
// (gevşek) bir referans. Bu cihazda o entry henüz yoksa (ör. henüz restore edilmediyse)
// sorun değil, UI böyle bir referansı sessizce yok sayıyor.
export async function mergeFromCloud(row: SomedayItem): Promise<void> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ is_completed: 0 | 1 }>(
    'SELECT is_completed FROM someday_list WHERE id = ?',
    row.id
  );

  if (!existing) {
    await database.runAsync(
      `INSERT INTO someday_list (id, list_id, title, is_completed, completed_at, completed_entry_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.list_id,
      row.title,
      row.is_completed,
      row.completed_at,
      row.completed_entry_id,
      row.created_at
    );
    return;
  }

  // is_completed sadece 0 -> 1 yönünde ilerler (bkz. completeItem — geri alınmıyor);
  // yerel satır zaten tamamlanmışsa buluttan gelen "tamamlanmamış" bir hâl asla üstüne
  // yazmaz (o zaten senkronlanmamış eski bir durum olurdu, bkz. syncSomedayList).
  if (existing.is_completed === 0 && row.is_completed === 1) {
    await database.runAsync(
      'UPDATE someday_list SET is_completed = 1, completed_at = ?, completed_entry_id = ? WHERE id = ?',
      row.completed_at,
      row.completed_entry_id,
      row.id
    );
  }
}
