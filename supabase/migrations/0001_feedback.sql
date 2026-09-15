-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Anonim, insert-only geri bildirim tablosu: anon role sadece satır ekleyebilir,
-- okuma/güncelleme/silme policy'si TANIMLANMADIĞI için RLS bunları varsayılan olarak reddeder.

create extension if not exists pgcrypto;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "anon can insert feedback"
  on public.feedback
  for insert
  to anon
  with check (true);
