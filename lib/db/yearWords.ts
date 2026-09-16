import { getDatabase } from './init';

export interface YearWord {
  year: number;
  word: string;
  updated_at: string;
}

const MAX_WORD_LENGTH = 30;

export async function getWordForYear(year: number): Promise<YearWord | null> {
  const database = await getDatabase();
  return database.getFirstAsync<YearWord>('SELECT * FROM year_words WHERE year = ?', year);
}

// En yeni yıldan en eskiye.
export async function getAllYearWords(): Promise<YearWord[]> {
  const database = await getDatabase();
  return database.getAllAsync<YearWord>('SELECT * FROM year_words ORDER BY year DESC');
}

// updatedAt verilmezse şimdi kullanılır. lib/supabase/backup.ts buluttan bir satır
// çekip yerele yazarken (pull) buluttaki updated_at'i koruyabilmek için bu parametreyi
// override ediyor — aksi halde her senkronda "şimdi" yazılır ve iki taraf hangisinin
// daha yeni olduğunu bir daha asla anlayamaz.
export async function upsertYearWord(
  year: number,
  word: string,
  updatedAt?: string
): Promise<void> {
  const trimmed = word.trim().slice(0, MAX_WORD_LENGTH);
  if (!trimmed) return;

  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO year_words (year, word, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(year) DO UPDATE SET word = excluded.word, updated_at = excluded.updated_at`,
    year,
    trimmed,
    updatedAt ?? new Date().toISOString()
  );
}
