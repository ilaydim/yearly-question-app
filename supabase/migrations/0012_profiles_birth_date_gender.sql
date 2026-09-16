-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Kayıt formuna eklenen doğum tarihi (zorunlu) ve cinsiyet (isteğe bağlı) alanları için.

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists gender text;
