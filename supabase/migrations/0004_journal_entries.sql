-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- id, cihazdaki yerel entries.id ile birebir aynı tutulur (upsert-only backup için).

create table if not exists public.journal_entries (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,
  content text not null,
  mood text,
  category_id text not null,
  question_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

-- Backup'ın "updated_at > last_backup_at" sorgusu ve restore'un "user_id'ye göre çek"
-- sorgusu bu bileşik indeksi kullanır.
create index if not exists idx_journal_entries_user_updated
  on public.journal_entries (user_id, updated_at);

alter table public.journal_entries enable row level security;

-- Kullanıcı sadece kendi satırlarını görebilir/ekleyebilir/güncelleyebilir.
-- Silme policy'si BİLEREK yok — bu upsert-only bir backup, tombstone/silme senkronu kapsam dışı.
create policy "users can view own journal entries"
  on public.journal_entries for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own journal entries"
  on public.journal_entries for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own journal entries"
  on public.journal_entries for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
