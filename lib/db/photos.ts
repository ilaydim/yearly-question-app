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
