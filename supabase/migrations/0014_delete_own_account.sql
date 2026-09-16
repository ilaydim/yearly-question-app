-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Hesabı kalıcı olarak silme: kullanıcı SADECE kendi verisini (auth.uid()) silebilir.
--
-- SECURITY DEFINER gerekli çünkü normal 'authenticated' rolünün auth.users'a DELETE
-- yetkisi yok; fonksiyon SQL Editor'de "postgres" sahipliğiyle oluşturulacağından onun
-- yetkisiyle çalışır (0002_profiles.sql'deki handle_new_user() ile aynı desen — Supabase'in
-- kendi önerdiği self-service hesap silme yaklaşımı budur).
--
-- storage.objects satırları BİLEREK burada silinmiyor — dosyalar önce istemci tarafında
-- (lib/supabase/account.ts) storage.remove() ile temizleniyor; bu fonksiyon sadece
-- veritabanı satırlarından ve auth kullanıcısından sorumlu.

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
  delete from public.profiles where id = target_id;
  delete from auth.users where id = target_id;
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
