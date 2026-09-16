-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "Hedeflerim" özelliği: Günlük/Haftalık/Yıllık hedef listeleri. Bir Gün Listesi/
-- seviye sistemiyle HİÇ ilgisi yok, journal_entries ile de bağlantısı yok —
-- tamamen bağımsız, kendi başına bir tablo. Her satır belirli bir liste türü +
-- periyot anahtarı (period_key) için bir hedef maddesi. Periyot geçtiğinde ayrı
-- bir "rollover" işlemi YOK — "güncel" olan madde zaten period_key, o listenin o
-- anki getCurrentPeriodKey() değeriyle eşleşen satırlar olarak canlı hesaplanıyor
-- (bkz. lib/goalPeriods.ts, lib/db/goals.ts); eşleşmeyenler otomatik arşiv sayılır.
--
-- updated_at: someday_list'in aksine buradaki is_completed GERİ ALINABİLİR
-- (toggleItem hem işaretler hem işareti kaldırır) — bu yüzden year_words'teki gibi
-- iki taraflı "hangi taraf daha yeni" senkronu gerekiyor (bkz. lib/supabase/backup.ts
-- syncGoals), tek yönlü someday_list mantığı burada yetersiz kalırdı.

create table if not exists public.goal_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  list_type text not null,
  period_key text not null,
  title text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null,
  completed_at timestamptz,
  updated_at timestamptz not null
);

create index if not exists idx_goal_items_user on public.goal_items (user_id);
create index if not exists idx_goal_items_list_period on public.goal_items (user_id, list_type, period_key);

alter table public.goal_items enable row level security;

-- Bu tablo tamamen mutable (is_completed 0<->1 iki yönlü, bkz. toggleItem) VE
-- istemci tarafından silinebilir olmalı (sadece güncel periyottaki maddeler için,
-- bu kısıtlama istemci tarafında uygulanıyor) — bu yüzden dört CRUD policy'si de
-- baştan var (bkz. someday_list'in aynı gerekçesi, 0020_someday_list.sql).
create policy "users can view own goal items"
  on public.goal_items for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own goal items"
  on public.goal_items for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own goal items"
  on public.goal_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own goal items"
  on public.goal_items for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS tek başına yetmiyor, rolün önce tablo seviyesinde temel GRANT'e de sahip
-- olması gerekiyor (bkz. 0013_grants.sql'in profiles için sonradan eklemek zorunda
-- kaldığı eksiklik) — bu sefer baştan ekliyoruz.
grant select, insert, update, delete on public.goal_items to authenticated;
