import { Directory, File, Paths } from 'expo-file-system';
import { supabase, isSupabaseConfigured } from './client';
import {
  getEntriesUpdatedSince,
  insertEntryIfMissing,
} from '../db/entries';
import {
  getUnsyncedPhotos,
  insertPhotoIfMissing,
  markPhotoSynced,
} from '../db/photos';
import { getAllYearWords, upsertYearWord } from '../db/yearWords';
import { getAllLetters, insertLetterIfMissing, type FutureLetter } from '../db/futureLetters';
import {
  getAllLists,
  insertListIfMissing,
  getAllItems,
  mergeFromCloud,
  type SomedayList,
  type SomedayItem,
} from '../db/somedayList';
import {
  getAllItems as getAllGoalItems,
  upsertFromCloud as upsertGoalItemFromCloud,
  type GoalItem,
} from '../db/goals';
import { SYNCED_ENTRY_COLUMNS } from '../db/schema';
import type { Entry, Photo } from '../db/types';

export const BACKUP_NOT_CONFIGURED = 'BACKUP_NOT_CONFIGURED';

const PHOTO_BUCKET = 'journal-photos';
const ENTRY_BATCH_SIZE = 20;
const EPOCH = '1970-01-01T00:00:00.000Z';
const SIGNED_URL_TTL_SECONDS = 60;

export interface BackupResult {
  entriesSynced: number;
  entriesIncomplete: boolean;
  photosSynced: number;
  photosFailed: number;
  yearWordsFailed: boolean;
  futureLettersFailed: boolean;
  somedayListsFailed: boolean;
  somedayListFailed: boolean;
  goalsFailed: boolean;
  newCursor: string;
}

interface CloudPhotoRow {
  id: string;
  entry_id: string;
  storage_path: string;
  created_at: string;
}

interface CloudYearWordRow {
  year: number;
  word: string;
  updated_at: string;
}

type CloudFutureLetterRow = Omit<FutureLetter, 'notification_id'>;

// Cloud'daki is_custom `boolean`, yereldeki SQLite sütunu `0 | 1` — is_completed ile
// aynı gerekçeyle (yukarıdaki CloudSomedayItemRow) SomedayList'ten ayrı bir tip.
interface CloudSomedayListRow {
  id: string;
  name: string;
  is_custom: boolean;
  created_at: string;
}

// Cloud'daki is_completed `boolean` (true/false), yereldeki SQLite sütunu ise
// `0 | 1` (INTEGER) — supabase-js bunu JS boolean olarak döndürür, bu yüzden
// SomedayItem'dan doğrudan türetmek yerine ayrı bir tip tanımlıyoruz.
interface CloudSomedayItemRow {
  id: string;
  list_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_entry_id: string | null;
  created_at: string;
}

// Cloud'daki is_completed `boolean`, yereldeki SQLite sütunu `0 | 1` — aynı gerekçeyle
// (yukarıdaki CloudSomedayItemRow) GoalItem'dan ayrı bir tip tanımlıyoruz.
interface CloudGoalItemRow {
  id: string;
  list_type: string;
  period_key: string;
  title: string;
  is_completed: boolean;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// columns, kaynağın (T) TÜM alanlarını kapsıyorsa (SYNCED_ENTRY_COLUMNS'un Entry için
// yaptığı gibi) dönen değer T ile birebir aynı şekle sahip olur — bu yüzden aşağıda
// hem "Entry + user_id" (toCloudEntry) hem de "cloud satırından Entry" (restore)
// için tip zorlaması (cast) gerekmeden kullanılabiliyor.
function pickColumns<T extends object, K extends keyof T>(
  source: T,
  columns: readonly K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const column of columns) {
    result[column] = source[column];
  }
  return result;
}

// SYNCED_ENTRY_COLUMNS (lib/db/schema.ts), entries tablosunun buluta senkronlanan
// TÜM sütunlarının tek kaynağı — yeni bir sütun eklendiğinde SADECE oraya eklemek
// yeterli, burayı ya da aşağıdaki restore mantığını elle güncellemeye gerek yok.
function toCloudEntry(userId: string, entry: Entry) {
  return { user_id: userId, ...pickColumns(entry, SYNCED_ENTRY_COLUMNS) };
}

// syncCursor: local entries tablosunda updated_at > syncCursor olan satırlar gönderilir
// (null ise hiç yedeklenmemiş demektir, epoch'tan başlanır). Gruplar sırayla, artan
// updated_at ile gönderiliyor; bir grup başarısız olursa döngü orada durur ve newCursor
// SADECE başarıyla gönderilen son grubun updated_at'inde kalır — böylece bir sonraki
// backup, başarısız olan (ve ondan sonraki) satırları otomatik tekrar dener, önceden
// başarıyla gönderilenler tekrar gönderilmez.
export async function runBackup(userId: string, syncCursor: string | null): Promise<BackupResult> {
  if (!isSupabaseConfigured) throw new Error(BACKUP_NOT_CONFIGURED);

  const since = syncCursor ?? EPOCH;
  const pending = await getEntriesUpdatedSince(since);

  let entriesSynced = 0;
  let newCursor = since;
  let entriesIncomplete = false;

  for (const batch of chunk(pending, ENTRY_BATCH_SIZE)) {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .upsert(
          batch.map((entry) => toCloudEntry(userId, entry)),
          { onConflict: 'id' }
        );
      if (error) throw error;
      entriesSynced += batch.length;
      newCursor = batch[batch.length - 1].updated_at;
    } catch (error) {
      console.error('Yedekleme: giriş grubu gönderilemedi:', error);
      entriesIncomplete = true;
      break;
    }
  }

  // Fotoğraflar, gönderilmesi kesin olan girişlerden bağımsız olarak deneniyor; bir
  // fotoğrafın entry'si henüz bulutta yoksa (FK ihlali) o fotoğraf sadece atlanır ve
  // synced_at set edilmez — bir sonraki backup'ta (entry'si de gönderildikten sonra)
  // otomatik tekrar denenir.
  const unsyncedPhotos = await getUnsyncedPhotos();
  let photosSynced = 0;
  let photosFailed = 0;

  for (const photo of unsyncedPhotos) {
    try {
      await uploadOnePhoto(userId, photo);
      photosSynced++;
    } catch (error) {
      console.error(`Yedekleme: fotoğraf yüklenemedi (${photo.id}):`, error);
      photosFailed++;
    }
  }

  let yearWordsFailed = false;
  try {
    await syncYearWords(userId);
  } catch (error) {
    console.error('Yedekleme: yılın kelimesi senkronlanamadı:', error);
    yearWordsFailed = true;
  }

  let futureLettersFailed = false;
  try {
    await syncFutureLetters(userId);
  } catch (error) {
    console.error('Yedekleme: geleceğe mektuplar senkronlanamadı:', error);
    futureLettersFailed = true;
  }

  // Listeler İTEMLER'den ÖNCE senkronlanır: bir maddenin list_id'si karşılık gelen
  // someday_lists satırından önce bu cihaza inirse sorun olmaz (list_id gevşek bir
  // referans, bkz. lib/db/init.ts SCHEMA yorumu) ama bu sıralama UI'da bir maddenin
  // "bilinmeyen" bir listeye ait görünmesi riskini azaltır.
  let somedayListsFailed = false;
  try {
    await syncSomedayLists(userId);
  } catch (error) {
    console.error('Yedekleme: bir gün listeleri senkronlanamadı:', error);
    somedayListsFailed = true;
  }

  let somedayListFailed = false;
  try {
    await syncSomedayList(userId);
  } catch (error) {
    console.error('Yedekleme: bir gün listesi senkronlanamadı:', error);
    somedayListFailed = true;
  }

  // Hedefler (goal_items), Bir Gün Listesi/seviye sistemiyle ilgisi olmayan tamamen
  // bağımsız bir özellik — kendi try/catch'i, kendi başarısız bayrağı.
  let goalsFailed = false;
  try {
    await syncGoals(userId);
  } catch (error) {
    console.error('Yedekleme: hedefler senkronlanamadı:', error);
    goalsFailed = true;
  }

  return {
    entriesSynced,
    entriesIncomplete,
    photosSynced,
    photosFailed,
    yearWordsFailed,
    futureLettersFailed,
    somedayListsFailed,
    somedayListFailed,
    goalsFailed,
    newCursor,
  };
}

// year_words entries/photos'un aksine bir cursor'la değil, her seferinde TAM
// karşılaştırmayla senkronlanıyor — bir kullanıcının ömrü boyunca en fazla birkaç
// düzine satır olacağından (yılda bir) bu ucuz ve basit; ayrı bir cursor state'i
// tutmaya değmez. İki yönlü: her yıl için hangi taraf (yerel/bulut) daha yeniyse
// (updated_at) diğerine yazılır — böylece bu tablo restoreFromCloud'a da ihtiyaç
// duymadan, normal her backup çağrısında kendiliğinden iki cihaz arasında eşitlenir.
async function syncYearWords(userId: string): Promise<void> {
  const [localWords, cloudResult] = await Promise.all([
    getAllYearWords(),
    supabase
      .from('year_words')
      .select('year, word, updated_at')
      .eq('user_id', userId)
      .returns<CloudYearWordRow[]>(),
  ]);
  if (cloudResult.error) throw cloudResult.error;
  const cloudWords = cloudResult.data ?? [];

  const localByYear = new Map(localWords.map((w) => [w.year, w]));
  const cloudByYear = new Map(cloudWords.map((w) => [w.year, w]));
  const years = new Set([...localByYear.keys(), ...cloudByYear.keys()]);

  const toPush: { year: number; word: string; updated_at: string }[] = [];
  const toPull: CloudYearWordRow[] = [];

  for (const year of years) {
    const local = localByYear.get(year);
    const cloud = cloudByYear.get(year);
    if (local && !cloud) toPush.push(local);
    else if (!local && cloud) toPull.push(cloud);
    else if (local && cloud && local.updated_at !== cloud.updated_at) {
      if (local.updated_at > cloud.updated_at) toPush.push(local);
      else toPull.push(cloud);
    }
  }

  if (toPush.length > 0) {
    const { error } = await supabase
      .from('year_words')
      .upsert(
        toPush.map((w) => ({ user_id: userId, year: w.year, word: w.word, updated_at: w.updated_at })),
        { onConflict: 'user_id,year' }
      );
    if (error) throw error;
  }

  for (const row of toPull) {
    await upsertYearWord(row.year, row.word, row.updated_at);
  }
}

// future_letters da (year_words gibi) cursor'suz, tam karşılaştırmalı senkronlanıyor.
// year_words'ten farklı olarak mektuplar İMMUTABLE (update policy'si yok) — bu yüzden
// "hangi taraf daha yeni" karşılaştırması gerekmiyor, sadece "hangi tarafta var, hangi
// tarafta yok" yeterli. Silme burada ELE ALINMIYOR: bir mektup yerelde silinince
// deleteFutureLetterFromCloud ayrıca, best-effort olarak çağrılıyor (bkz. o fonksiyon) —
// bu tam karşılaştırma silmeyi de kapsasaydı, offline silinen bir mektup bir sonraki
// senkronda "cloud-only" görünüp sessizce geri pull edilirdi.
async function syncFutureLetters(userId: string): Promise<void> {
  const [localLetters, cloudResult] = await Promise.all([
    getAllLetters(),
    supabase
      .from('future_letters')
      .select('id, content, unlock_date, created_at')
      .eq('user_id', userId)
      .returns<CloudFutureLetterRow[]>(),
  ]);
  if (cloudResult.error) throw cloudResult.error;
  const cloudLetters = cloudResult.data ?? [];

  const localIds = new Set(localLetters.map((l) => l.id));
  const cloudIds = new Set(cloudLetters.map((l) => l.id));

  const toPush = localLetters.filter((l) => !cloudIds.has(l.id));
  const toPull = cloudLetters.filter((l) => !localIds.has(l.id));

  if (toPush.length > 0) {
    const { error } = await supabase.from('future_letters').upsert(
      toPush.map((l) => ({
        id: l.id,
        user_id: userId,
        content: l.content,
        unlock_date: l.unlock_date,
        created_at: l.created_at,
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  // insertLetterIfMissing, hâlâ açılmamış bir mektup için BU cihazda da yerel bir
  // bildirim kurar (bkz. lib/db/futureLetters.ts) — cloud satırında notification_id
  // hiç yok, her cihaz kendi bildirimini kendi zamanlar.
  for (const row of toPull) {
    await insertLetterIfMissing(row);
  }
}

// someday_lists, future_letters ile AYNI desen: cursor'suz, tam karşılaştırmalı,
// İMMUTABLE (isim/is_custom oluşturulduktan sonra hiç değişmiyor — update policy'si
// de yok, bkz. 0022_someday_lists.sql) — bu yüzden "hangi taraf var, hangi tarafta
// yok" yeterli, "hangisi daha yeni" karşılaştırmasına gerek yok.
async function syncSomedayLists(userId: string): Promise<void> {
  const [localLists, cloudResult] = await Promise.all([
    getAllLists(),
    supabase
      .from('someday_lists')
      .select('id, name, is_custom, created_at')
      .eq('user_id', userId)
      .returns<CloudSomedayListRow[]>(),
  ]);
  if (cloudResult.error) throw cloudResult.error;
  const cloudLists = cloudResult.data ?? [];

  const localIds = new Set(localLists.map((l) => l.id));
  const cloudIds = new Set(cloudLists.map((l) => l.id));

  const toPush = localLists.filter((l) => !cloudIds.has(l.id));
  const toPull = cloudLists.filter((l) => !localIds.has(l.id));

  if (toPush.length > 0) {
    const { error } = await supabase.from('someday_lists').upsert(
      toPush.map((l) => ({
        id: l.id,
        user_id: userId,
        name: l.name,
        is_custom: l.is_custom === 1,
        created_at: l.created_at,
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  for (const row of toPull) {
    await insertListIfMissing({
      id: row.id,
      name: row.name,
      is_custom: row.is_custom ? 1 : 0,
      created_at: row.created_at,
    });
  }
}

// someday_list da cursor'suz, tam karşılaştırmalı senkronlanıyor ama year_words'ten
// FARKLI: bir updated_at sütunu yok. Bu tabloda buna ihtiyaç da yok, çünkü satırlar
// tek yönlü bir yaşam döngüsü izliyor (is_completed sadece false -> true, asla geri
// gitmiyor; title completeItem sonrası hiç değişmiyor) — bu yüzden "hangi taraf daha
// yeni" yerine "hangi taraf tamamlanmış" yeterli bir karşılaştırma (bkz. mergeFromCloud).
async function syncSomedayList(userId: string): Promise<void> {
  const [localItems, cloudResult] = await Promise.all([
    getAllItems(),
    supabase
      .from('someday_list')
      .select('id, list_id, title, is_completed, completed_at, completed_entry_id, created_at')
      .eq('user_id', userId)
      .returns<CloudSomedayItemRow[]>(),
  ]);
  if (cloudResult.error) throw cloudResult.error;
  const cloudItems = cloudResult.data ?? [];

  const cloudById = new Map(cloudItems.map((i) => [i.id, i]));
  const localById = new Map(localItems.map((i) => [i.id, i]));

  const toPush: SomedayItem[] = [];
  for (const local of localItems) {
    const cloud = cloudById.get(local.id);
    const localCompleted = local.is_completed === 1;
    if (!cloud || (localCompleted && !cloud.is_completed)) toPush.push(local);
  }

  const toPull: CloudSomedayItemRow[] = [];
  for (const cloud of cloudItems) {
    const local = localById.get(cloud.id);
    const localCompleted = local ? local.is_completed === 1 : false;
    if (!local || (cloud.is_completed && !localCompleted)) toPull.push(cloud);
  }

  if (toPush.length > 0) {
    const { error } = await supabase.from('someday_list').upsert(
      toPush.map((i) => ({
        id: i.id,
        user_id: userId,
        list_id: i.list_id,
        title: i.title,
        is_completed: i.is_completed === 1,
        completed_at: i.completed_at,
        completed_entry_id: i.completed_entry_id,
        created_at: i.created_at,
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  // mergeFromCloud yeni bir journal_entries satırı OLUŞTURMAZ — completed_entry_id
  // sadece taşınan bir referans, bu cihazda karşılığı olmayabilir (bkz. lib/db/somedayList.ts).
  for (const row of toPull) {
    await mergeFromCloud({
      id: row.id,
      list_id: row.list_id,
      title: row.title,
      is_completed: row.is_completed ? 1 : 0,
      completed_at: row.completed_at,
      completed_entry_id: row.completed_entry_id,
      created_at: row.created_at,
    });
  }
}

// goal_items, year_words ile AYNI desen: cursor'suz, tam karşılaştırmalı, updated_at
// bazlı iki yönlü senkron. someday_list'in aksine burada is_completed GERİ ALINABİLİR
// (toggleItem, bkz. lib/db/goals.ts) — bu yüzden "hangi taraf tamamlanmış" yeterli
// olmuyor, year_words'teki gibi gerçek "hangi taraf daha yeni" karşılaştırması gerekiyor.
async function syncGoals(userId: string): Promise<void> {
  const [localItems, cloudResult] = await Promise.all([
    getAllGoalItems(),
    supabase
      .from('goal_items')
      .select('id, list_type, period_key, title, is_completed, created_at, completed_at, updated_at')
      .eq('user_id', userId)
      .returns<CloudGoalItemRow[]>(),
  ]);
  if (cloudResult.error) throw cloudResult.error;
  const cloudItems = cloudResult.data ?? [];

  const localById = new Map(localItems.map((i) => [i.id, i]));
  const cloudById = new Map(cloudItems.map((i) => [i.id, i]));
  const ids = new Set([...localById.keys(), ...cloudById.keys()]);

  const toPush: GoalItem[] = [];
  const toPull: CloudGoalItemRow[] = [];

  for (const id of ids) {
    const local = localById.get(id);
    const cloud = cloudById.get(id);
    if (local && !cloud) toPush.push(local);
    else if (!local && cloud) toPull.push(cloud);
    else if (local && cloud && local.updated_at !== cloud.updated_at) {
      if (local.updated_at > cloud.updated_at) toPush.push(local);
      else toPull.push(cloud);
    }
  }

  if (toPush.length > 0) {
    const { error } = await supabase.from('goal_items').upsert(
      toPush.map((i) => ({
        id: i.id,
        user_id: userId,
        list_type: i.list_type,
        period_key: i.period_key,
        title: i.title,
        is_completed: i.is_completed === 1,
        created_at: i.created_at,
        completed_at: i.completed_at,
        updated_at: i.updated_at,
      })),
      { onConflict: 'id' }
    );
    if (error) throw error;
  }

  for (const row of toPull) {
    await upsertGoalItemFromCloud({
      id: row.id,
      list_type: row.list_type as GoalItem['list_type'],
      period_key: row.period_key,
      title: row.title,
      is_completed: row.is_completed ? 1 : 0,
      created_at: row.created_at,
      completed_at: row.completed_at,
      updated_at: row.updated_at,
    });
  }
}

async function uploadOnePhoto(userId: string, photo: Photo): Promise<void> {
  const file = new File(photo.file_path);
  const arrayBuffer = await file.arrayBuffer();
  const storagePath = `${userId}/${photo.id}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from('journal_photos').upsert(
    {
      id: photo.id,
      entry_id: photo.entry_id,
      user_id: userId,
      storage_path: storagePath,
      created_at: photo.created_at,
    },
    { onConflict: 'id' }
  );
  if (insertError) throw insertError;

  await markPhotoSynced(photo.id, new Date().toISOString());
}

export async function hasCloudBackup(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { count, error } = await supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export interface RestoreProgress {
  phase: 'entries' | 'photos';
  completed: number;
  total: number;
}

export interface RestoreResult {
  entriesRestored: number;
  photosRestored: number;
}

export async function restoreFromCloud(
  userId: string,
  onProgress?: (progress: RestoreProgress) => void
): Promise<RestoreResult> {
  if (!isSupabaseConfigured) throw new Error(BACKUP_NOT_CONFIGURED);

  const { data: cloudEntries, error: entriesError } = await supabase
    .from('journal_entries')
    .select(SYNCED_ENTRY_COLUMNS.join(', '))
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .returns<Entry[]>();
  if (entriesError) throw entriesError;

  const entryTotal = cloudEntries?.length ?? 0;
  let entriesRestored = 0;
  let entriesProcessed = 0;
  // "Restore kısmen başarılı oldu" gibi bir bilgiyi ileride kullanıcıya göstermek
  // istersek diye burada topluyoruz — şimdilik sadece console.warn ile özetleniyor,
  // ayrı bir UI/return alanı yok.
  const failedEntryIds: string[] = [];

  for (const row of cloudEntries ?? []) {
    try {
      const inserted = await insertEntryIfMissing(pickColumns(row, SYNCED_ENTRY_COLUMNS));
      if (inserted) entriesRestored++;
    } catch (error) {
      failedEntryIds.push(row.id);
      console.error(`Restore: giriş eklenemedi (${row.id}):`, error);
    }
    entriesProcessed++;
    onProgress?.({ phase: 'entries', completed: entriesProcessed, total: entryTotal });
  }

  if (failedEntryIds.length > 0) {
    console.warn(`Restore: ${failedEntryIds.length} giriş eklenemedi, atlandı:`, failedEntryIds);
  }

  const { data: cloudPhotos, error: photosError } = await supabase
    .from('journal_photos')
    .select('id, entry_id, storage_path, created_at')
    .eq('user_id', userId)
    .returns<CloudPhotoRow[]>();
  if (photosError) throw photosError;

  const photoTotal = cloudPhotos?.length ?? 0;
  let photosRestored = 0;
  let photosProcessed = 0;

  for (const row of cloudPhotos ?? []) {
    try {
      await downloadOnePhoto(row);
      photosRestored++;
    } catch (error) {
      console.error(`Restore: fotoğraf indirilemedi (${row.id}):`, error);
    }
    photosProcessed++;
    onProgress?.({ phase: 'photos', completed: photosProcessed, total: photoTotal });
  }

  return { entriesRestored, photosRestored };
}

async function downloadOnePhoto(row: CloudPhotoRow): Promise<void> {
  const { data: signed, error: signError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) throw signError ?? new Error('İmzalı URL alınamadı');

  const destination = new File(new Directory(Paths.document), `photo-restored-${row.id}.jpg`);
  const localFile = await File.downloadFileAsync(signed.signedUrl, destination, { idempotent: true });

  await insertPhotoIfMissing({
    id: row.id,
    entry_id: row.entry_id,
    file_path: localFile.uri,
    created_at: row.created_at,
    // Buluttan geldi, zaten senkron — bir sonraki backup bunu tekrar yüklemeye çalışmasın.
    synced_at: new Date().toISOString(),
  });
}

// Local silme akışından (app/entry/[id].tsx) çağrılır. Tamamen best-effort: local silme
// zaten tamamlanmış olur, burası ne olursa olsun onu geri almaz/engellemez — bu yüzden
// hiçbir hata dışarı fırlatılmıyor (isSupabaseConfigured=false, oturum yok, ağ hatası,
// RLS/izin hatası — hepsi burada sessizce yutuluyor, sadece loglanıyor).
//
// BİLİNEN SINIR: Bu, gerçek bir tombstone/silme senkronu DEĞİL. Cihaz o an offline'sa
// (ya da bu çağrı herhangi bir sebeple başarısız olursa) journal_entries/journal_photos'taki
// kayıt bulutta kalmaya devam eder — upsert-only backup mantığı bunu bir daha asla
// "silinecek" olarak işaretlemez. Böyle bir durumda bu cihaz (ya da başka bir cihaz)
// daha sonra restore çalıştırırsa, o "silinmiş" giriş buluttan geri gelebilir.
export async function deleteEntryFromCloud(userId: string, entryId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: photos, error: fetchError } = await supabase
      .from('journal_photos')
      .select('storage_path')
      .eq('entry_id', entryId)
      .eq('user_id', userId)
      .returns<{ storage_path: string }[]>();
    if (fetchError) throw fetchError;

    const storagePaths = (photos ?? []).map((photo) => photo.storage_path);
    if (storagePaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(storagePaths);
      if (removeError) throw removeError;
    }

    // journal_photos satırları journal_entries üzerindeki ON DELETE CASCADE FK'siyle
    // otomatik silinir (bkz. 0005_journal_photos.sql), burada ayrıca silmiyoruz.
    const { error: deleteError } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', entryId)
      .eq('user_id', userId);
    if (deleteError) throw deleteError;
  } catch (error) {
    console.warn(`Cloud silme senkronu başarısız oldu (entry ${entryId}), local silme etkilenmedi:`, error);
  }
}

// app/future-letters.tsx'teki local silme akışından çağrılır — deleteEntryFromCloud
// ile AYNI best-effort desen: local silme zaten tamamlanmış olur, burası ne olursa
// olsun onu geri almaz/engellemez, hata dışarı fırlatılmaz.
//
// BİLİNEN SINIR: deleteEntryFromCloud'daki ile aynı — gerçek bir tombstone senkronu
// değil. Bu çağrı offline'ken ya da başka bir sebeple başarısız olursa, bir sonraki
// backup'ta syncFutureLetters bu satırı hâlâ "cloud-only" görüp yerele geri pull eder.
export async function deleteFutureLetterFromCloud(userId: string, letterId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase
      .from('future_letters')
      .delete()
      .eq('id', letterId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.warn(
      `Cloud silme senkronu başarısız oldu (mektup ${letterId}), local silme etkilenmedi:`,
      error
    );
  }
}

// app/someday-list.tsx'teki local silme akışından çağrılır — deleteEntryFromCloud
// ile AYNI best-effort desen ve aynı BİLİNEN SINIR (bkz. o fonksiyonun yorumu).
export async function deleteSomedayItemFromCloud(userId: string, itemId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase
      .from('someday_list')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.warn(
      `Cloud silme senkronu başarısız oldu (madde ${itemId}), local silme etkilenmedi:`,
      error
    );
  }
}

// app/goals.tsx'teki local silme akışından çağrılır — deleteEntryFromCloud ile AYNI
// best-effort desen ve aynı BİLİNEN SINIR (bkz. o fonksiyonun yorumu). deleteItem zaten
// sadece güncel periyottaki maddelere izin veriyor, bu yüzden burada ayrıca bir kontrol
// yok — çağıran taraf (app/goals.tsx) o kısıtlamayı zaten uyguladıktan sonra çağırıyor.
export async function deleteGoalItemFromCloud(userId: string, itemId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase
      .from('goal_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (error) {
    console.warn(
      `Cloud silme senkronu başarısız oldu (hedef ${itemId}), local silme etkilenmedi:`,
      error
    );
  }
}
