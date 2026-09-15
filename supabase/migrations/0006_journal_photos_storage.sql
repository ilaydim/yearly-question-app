-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- avatars bucket'ının aksine PRIVATE: public=false, okuma da sadece dosya sahibine açık
-- (restore sırasında imzalı URL (createSignedUrl) ile geçici erişim veriliyor).

insert into storage.buckets (id, name, public)
values ('journal-photos', 'journal-photos', false)
on conflict (id) do nothing;

-- Yazma ve okuma sadece kendi klasörüne: path {user_id}/{photo_id}.jpg olduğu için
-- storage.foldername(name)'in ilk parçası auth.uid() ile eşleşmiyorsa reddedilir.
create policy "users can read their own journal photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can upload their own journal photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own journal photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own journal photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'journal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
