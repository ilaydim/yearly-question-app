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
  category_id TEXT NOT NULL,
  question_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  location_name TEXT,
  country TEXT,
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
`;

export const QUESTION_CATEGORY_ID = 'journal';
export const TRIP_CATEGORY_ID = 'trip';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'personal', name: 'Kişisel', color: '#4F46E5', is_default: 1 },
  { id: 'work', name: 'İş', color: '#059669', is_default: 1 },
  { id: 'dream', name: 'Rüya', color: '#7C3AED', is_default: 1 },
  { id: TRIP_CATEGORY_ID, name: 'Gezi', color: '#DB2777', is_default: 1 },
  { id: QUESTION_CATEGORY_ID, name: 'Soru Günlüğü', color: '#F59E0B', is_default: 1 },
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
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
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

let initPromise: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await migrate();
      await seedCategories();
      await seedQuestions();
      await seedQuestionTranslations();
    })();
  }
  return initPromise;
}
