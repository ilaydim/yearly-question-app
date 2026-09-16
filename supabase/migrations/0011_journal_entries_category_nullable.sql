-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "Soru Günlüğü" artık ayrı bir özellik (yıllık soru sistemi), bir kategori değil —
-- soru cevapları question_id ile, Yıl Sonu Kapsülü girişleri capsule_year ile zaten
-- işaretleniyor; category_id bu satırlarda artık NULL olabiliyor (yerel şemayla aynı
-- değişiklik). Mevcut veriyi bozmuyor, sadece kısıtı gevşetiyor.

alter table public.journal_entries
  alter column category_id drop not null;
