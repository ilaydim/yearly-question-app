-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "Bir Gün Listesi" artık çoklu liste destekliyor: kullanıcı (premium ise) kendi ek
-- listelerini oluşturabiliyor. Bu tablo her listeyi bir satır olarak tutar — 'default'
-- id'li satır orijinal, örtük listeyi temsil eder (bkz. lib/db/init.ts
-- seedDefaultSomedayList), diğerleri (is_custom=true) kullanıcının oluşturduğu özel
-- listelerdir. İsim/is_custom oluşturulduktan sonra hiç değişmiyor (future_letters ile
-- aynı gerekçeyle update policy'si BİLEREK yok).
--
-- id, cihazdaki yerel someday_lists.id ile birebir aynı tutulur (diğer tüm
-- tablolardaki gibi upsert/insert-only backup için).

create table if not exists public.someday_lists (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_custom boolean not null default false,
  created_at timestamptz not null
);

create index if not exists idx_someday_lists_user on public.someday_lists (user_id);

alter table public.someday_lists enable row level security;

create policy "users can view own someday lists"
  on public.someday_lists for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own someday lists"
  on public.someday_lists for insert
  to authenticated
  with check (auth.uid() = user_id);

-- RLS tek başına yetmiyor, rolün önce tablo seviyesinde temel GRANT'e de sahip
-- olması gerekiyor (bkz. 0013_grants.sql'in profiles için sonradan eklemek zorunda
-- kaldığı eksiklik) — bu sefer baştan ekliyoruz.
grant select, insert on public.someday_lists to authenticated;

-- Var olan tüm someday_list satırları tek, örtük listeye aitti — DEFAULT 'default'
-- hem yeni sütunu geriye dönük dolduruyor (backfill) hem de list_id göndermeyen eski
-- istemci sürümlerine karşı bir güvenlik ağı.
alter table public.someday_list add column if not exists list_id text not null default 'default';
