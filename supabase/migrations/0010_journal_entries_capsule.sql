-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Yıl Sonu Kapsülü girişlerinin de normal günlük yazıları gibi yedeklenebilmesi için.

alter table public.journal_entries
  add column if not exists capsule_year integer;
