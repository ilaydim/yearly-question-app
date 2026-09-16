-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Kullanıcının seçtiği renk paleti (açık ve koyu tema için ayrı ayrı) hesaba bağlı
-- olsun, cihaz değiştirince de korunsun diye profiles'a ekleniyor. NULL = varsayılan palet.

alter table public.profiles
  add column if not exists light_palette text,
  add column if not exists dark_palette text;
