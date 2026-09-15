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
  newCursor: string;
}

interface CloudEntryRow {
  id: string;
  date: string;
  content: string;
  mood: string | null;
  category_id: string;
  question_id: string | null;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  country: string | null;
}

interface CloudPhotoRow {
  id: string;
  entry_id: string;
  storage_path: string;
  created_at: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toCloudEntry(userId: string, entry: Entry) {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    content: entry.content,
    mood: entry.mood,
    category_id: entry.category_id,
    question_id: entry.question_id,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    latitude: entry.latitude,
    longitude: entry.longitude,
    location_name: entry.location_name,
    country: entry.country,
  };
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

  return { entriesSynced, entriesIncomplete, photosSynced, photosFailed, newCursor };
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
    .select(
      'id, date, content, mood, category_id, question_id, created_at, updated_at, latitude, longitude, location_name, country'
    )
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .returns<CloudEntryRow[]>();
  if (entriesError) throw entriesError;

  const entryTotal = cloudEntries?.length ?? 0;
  let entriesRestored = 0;
  let entriesProcessed = 0;

  for (const row of cloudEntries ?? []) {
    const inserted = await insertEntryIfMissing({
      id: row.id,
      date: row.date,
      content: row.content,
      mood: row.mood,
      category_id: row.category_id,
      question_id: row.question_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      latitude: row.latitude,
      longitude: row.longitude,
      location_name: row.location_name,
      country: row.country,
    });
    if (inserted) entriesRestored++;
    entriesProcessed++;
    onProgress?.({ phase: 'entries', completed: entriesProcessed, total: entryTotal });
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
