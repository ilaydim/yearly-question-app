export interface Category {
  id: string;
  name: string;
  color: string;
  is_default: 0 | 1;
}

export interface Question {
  id: string;
  text: string;
  text_en: string | null;
  recurrence_month: number;
  recurrence_day: number;
  is_custom: 0 | 1;
}

export interface Entry {
  id: string;
  date: string;
  content: string;
  mood: string | null;
  category_id: string | null;
  question_id: string | null;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  country: string | null;
  // Doluysa bu satır bir "Yıl Sonu Kapsülü" girişidir, normal bir günlük yazısı değil —
  // hangi yıl için yazıldığını tutar (bkz. lib/capsule.ts). Normal listeleme sorgularının
  // hepsi bu alanı NULL olarak filtreler, kapsüller günlük akışında hiç görünmez.
  capsule_year: number | null;
}

export interface Photo {
  id: string;
  entry_id: string;
  file_path: string;
  created_at: string;
  synced_at: string | null;
}
