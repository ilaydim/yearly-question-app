-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- 0004_journal_entries.sql'den SONRA çalıştır (journal_entries'e FK referansı var).

create table if not exists public.journal_photos (
  id text primary key,
  entry_id text not null references public.journal_entries (id) on delete cascade,
  -- user_id burada denormalize: RLS'in her sorguda journal_entries'e join yapmasına
  -- gerek kalmasın diye (performans) — entry_id'nin sahibiyle her zaman aynı tutulmalı.
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null
);

create index if not exists idx_journal_photos_entry_id on public.journal_photos (entry_id);
create index if not exists idx_journal_photos_user_id on public.journal_photos (user_id);

alter table public.journal_photos enable row level security;

create policy "users can view own journal photos"
  on public.journal_photos for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own journal photos"
  on public.journal_photos for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own journal photos"
  on public.journal_photos for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
