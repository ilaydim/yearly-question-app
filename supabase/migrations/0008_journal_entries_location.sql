-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Gezi (trip) girişlerindeki konum bilgisinin backup/restore'a dahil olması için.

alter table public.journal_entries
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_name text;
