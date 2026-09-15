-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- 0004/0005'te bilerek DELETE policy'si eklenmemişti (o zamanki kapsam upsert-only'ydi).
-- Şimdi local silme akışına best-effort cloud senkronu eklendiği için (deleteEntryFromCloud,
-- lib/supabase/backup.ts) bu iki tabloya DELETE izni gerekiyor — policy olmadan silme
-- isteği hata vermez, sessizce 0 satır siler (RLS varsayılanı budur), bu yüzden bu
-- migration olmadan yeni özellik hiçbir şey silmez.

create policy "users can delete own journal entries"
  on public.journal_entries for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "users can delete own journal photos"
  on public.journal_photos for delete
  to authenticated
  using (auth.uid() = user_id);
