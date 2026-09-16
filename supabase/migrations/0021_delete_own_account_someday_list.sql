-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- delete_own_account(): "Bir Gün Listesi" (someday_list) eklendiğinden hesap silme
-- akışının da bu tabloyu açıkça temizlemesi gerekiyor (bkz. 0014_delete_own_account.sql'deki
-- gerekçe — storage dışındaki tüm kullanıcı verisi burada açıkça siliniyor, auth.users
-- cascade'ine bırakılmıyor).

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid := auth.uid();
begin
  if target_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.journal_photos where user_id = target_id;
  delete from public.journal_entries where user_id = target_id;
  delete from public.year_words where user_id = target_id;
  delete from public.future_letters where user_id = target_id;
  delete from public.someday_list where user_id = target_id;
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;
end;
$$;
