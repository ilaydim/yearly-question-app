import { getDatabase } from './init';
import type { Entry } from './types';

export async function createEntry(entry: Entry): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO entries (id, date, content, mood, category_id, question_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.id,
    entry.date,
    entry.content,
    entry.mood,
    entry.category_id,
    entry.question_id,
    entry.created_at,
    entry.updated_at
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

export async function getEntryById(id: string): Promise<Entry | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Entry>('SELECT * FROM entries WHERE id = ?', id);
}

export async function updateEntry(
  id: string,
  updates: Partial<Pick<Entry, 'date' | 'content' | 'mood' | 'category_id' | 'question_id'>>
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
