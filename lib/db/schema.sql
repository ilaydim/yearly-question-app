CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  recurrence_month INTEGER NOT NULL,
  recurrence_day INTEGER NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  category_id TEXT NOT NULL,
  question_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);
