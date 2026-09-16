-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "Geleceğe Mektup" özelliği: kullanıcının serbestçe seçtiği bir gelecek tarihte
-- açılan, kilitli mektup. journal_entries/kapsül ile ilgisi yok (sabit bir yıl
-- döngüsü değil, serbest tarihli), kendi başına bir tablo.
--
-- id, cihazdaki yerel future_letters.id ile birebir aynı tutulur (diğer tüm
-- tablolardaki gibi upsert/insert-only backup için). notification_id BİLEREK
-- burada yok — o, zamanlanmış yerel bildirimin id'si, cihaza özgü ve anlamsız bir
-- alan; her cihaz "aktif" bir mektubu buluttan çektiğinde kendi bildirimini kendi
-- kurar (bkz. lib/db/futureLetters.ts: insertLetterIfMissing).

create table if not exists public.future_letters (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  unlock_date date not null,
  created_at timestamptz not null
);

create index if not exists idx_future_letters_user on public.future_letters (user_id);

alter table public.future_letters enable row level security;

-- Mektuplar oluşturulduktan sonra değiştirilemez (update policy'si BİLEREK yok) —
-- görüntülenebilir, eklenebilir, ya da (henüz açılmamışsa; bu istemci tarafında
-- kontrol edilir, bkz. lib/db/futureLetters.ts deleteLetter) silinebilir.
create policy "users can view own future letters"
  on public.future_letters for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert own future letters"
  on public.future_letters for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can delete own future letters"
  on public.future_letters for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS tek başına yetmiyor, rolün önce tablo seviyesinde temel GRANT'e de sahip
-- olması gerekiyor (bkz. 0013_grants.sql'in profiles için sonradan eklemek zorunda
-- kaldığı eksiklik) — bu sefer baştan ekliyoruz.
grant select, insert, delete on public.future_letters to authenticated;
