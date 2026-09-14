export interface Category {
  id: string;
  name: string;
  color: string;
  is_default: 0 | 1;
}

export interface Question {
  id: string;
  text: string;
  recurrence_month: number;
  recurrence_day: number;
  is_custom: 0 | 1;
}

export interface Entry {
  id: string;
  date: string;
  content: string;
  mood: string | null;
  category_id: string;
  question_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  entry_id: string;
  file_path: string;
  created_at: string;
}
