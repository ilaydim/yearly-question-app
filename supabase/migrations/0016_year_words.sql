-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "Yılın Kelimesi" özelliği: yılda bir kez seçilen bir kelime/kısa tema.
-- journal_entries ile ilgisi yok, kendi başına küçük bir tablo.

create table if not exists public.year_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year integer not null,
  word text not null,
  updated_at timestamptz not null,
  unique (user_id, year)
);

create index if not exists idx_year_words_user on public.year_words (user_id);

alter table public.year_words enable row level security;

-- Kullanıcı sadece kendi satırlarını görebilir/ekleyebilir/güncelleyebilir.
-- Silme policy'si BİLEREK yok (journal_entries ile aynı desen) — bu upsert-only bir
-- senkron, tombstone/silme senkronu kapsam dışı.
create policy "users can view own year words"
  on public.year_words for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own year words"
  on public.year_words for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own year words"
  on public.year_words for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS tek başına yetmiyor, rolün önce tablo seviyesinde temel GRANT'e de sahip olması
-- gerekiyor (bkz. 0013_grants.sql).
grant select, insert, update on public.year_words to authenticated;
