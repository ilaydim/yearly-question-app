import { getDatabase } from './init';
import { generateId } from './id';
import type { Photo } from './types';

export async function addPhoto(entryId: string, filePath: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO photos (id, entry_id, file_path, created_at) VALUES (?, ?, ?, ?)',
    generateId(),
    entryId,
    filePath,
    new Date().toISOString()
  );
}

export async function getPhotosByEntryId(entryId: string): Promise<Photo[]> {
  const database = await getDatabase();
  return database.getAllAsync<Photo>(
    'SELECT * FROM photos WHERE entry_id = ? ORDER BY created_at DESC',
    entryId
  );
}

export async function deletePhoto(photoId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM photos WHERE id = ?', photoId);
}

export async function getPhotoMap(): Promise<Record<string, string>> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Photo>('SELECT * FROM photos');
  return Object.fromEntries(rows.map((row) => [row.entry_id, row.file_path]));
}

export async function getUnsyncedPhotos(): Promise<Photo[]> {
  const database = await getDatabase();
  return database.getAllAsync<Photo>('SELECT * FROM photos WHERE synced_at IS NULL');
}

export async function markPhotoSynced(photoId: string, syncedAt: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE photos SET synced_at = ? WHERE id = ?', syncedAt, photoId);
}

// Restore sırasında kullanılır: id zaten buluttan geldiği için deterministik —
// aynı fotoğraf yerelde zaten varsa (id çakışırsa) sessizce atlanır.
export async function insertPhotoIfMissing(photo: Photo): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync(
    'INSERT OR IGNORE INTO photos (id, entry_id, file_path, created_at, synced_at) VALUES (?, ?, ?, ?, ?)',
    photo.id,
    photo.entry_id,
    photo.file_path,
    photo.created_at,
    photo.synced_at
  );
  return result.changes > 0;
}
