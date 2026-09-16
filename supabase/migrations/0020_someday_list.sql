-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "Bir Gün Listesi" özelliği: tarihe bağlı olmayan, sürekli açık bir dilek/hayal
-- listesi + tamamlama seviyesi sistemi. journal_entries ile ilgisi yok, kendi başına
-- bir tablo — bir madde tamamlanınca (yansıma/fotoğraf varsa) ayrıca GERÇEK bir
-- journal_entries satırı oluşur, completed_entry_id ona sadece gevşek bir referans.
--
-- id, cihazdaki yerel someday_list.id ile birebir aynı tutulur. completed_entry_id
-- BİLEREK bir FOREIGN KEY değil — journal_entries satırı bağımsız olarak silinebilir,
-- bu referansın karşılığı kalmayabilir (lib/db/somedayList.ts'teki gerekçeyle aynı).

create table if not exists public.someday_list (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_entry_id text,
  created_at timestamptz not null
);

create index if not exists idx_someday_list_user on public.someday_list (user_id);

alter table public.someday_list enable row level security;

-- year_words/future_letters'ın aksine bu tablo tamamen mutable (is_completed 0->1
-- geçişi bir UPDATE) VE istemci tarafından silinebilir olmalı (bkz. deleteItem +
-- lib/supabase/backup.ts deleteSomedayItemFromCloud) — bu yüzden dört CRUD policy'si
-- de baştan var.
create policy "users can view own someday items"
  on public.someday_list for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own someday items"
  on public.someday_list for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can update own someday items"
  on public.someday_list for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own someday items"
  on public.someday_list for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS tek başına yetmiyor, rolün önce tablo seviyesinde temel GRANT'e de sahip
-- olması gerekiyor (bkz. 0013_grants.sql'in profiles için sonradan eklemek zorunda
-- kaldığı eksiklik) — bu sefer baştan ekliyoruz.
grant select, insert, update, delete on public.someday_list to authenticated;
