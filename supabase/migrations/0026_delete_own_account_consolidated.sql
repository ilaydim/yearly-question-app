-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- delete_own_account(): 0023_delete_own_account_goals.sql (goal_items) ve
-- 0025_delete_own_account_someday_lists.sql (someday_lists) birbirinden habersiz,
-- CREATE OR REPLACE FUNCTION ile fonksiyonun tüm gövdesini ayrı ayrı yeniden
-- tanımlamıştı. Bu migration ikisini TEK, kanonik tanımda birleştirir — fonksiyon
-- artık bilinen tüm kullanıcı verisi tablolarını temizliyor: journal_photos,
-- journal_entries, profiles, year_words, future_letters, someday_lists,
-- someday_list, goal_items, en son da auth.users (bkz. 0014_delete_own_account.sql'deki
-- gerekçe — storage dışındaki tüm kullanıcı verisi burada açıkça siliniyor, auth.users
-- cascade'ine bırakılmıyor).
--
-- storage.objects satırları BİLEREK burada silinmiyor — dosyalar önce istemci
-- tarafında (lib/supabase/account.ts) storage.remove() ile temizleniyor; bu
-- fonksiyon sadece veritabanı satırlarından ve auth kullanıcısından sorumlu.
--
-- Bundan sonra delete_own_account()'a yeni bir tablo eklenmesi gerektiğinde bu
-- migration'ın tanımı esas alınıp yeni bir "delete_own_account_<tablo>" migration'ı
-- ile güncellenmelidir — 0023 ve 0025'teki gibi paralel, birbirinden habersiz
-- yeniden tanımlamalardan kaçınılmalı.

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
  delete from public.someday_lists where user_id = target_id;
  delete from public.goal_items where user_id = target_id;
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
