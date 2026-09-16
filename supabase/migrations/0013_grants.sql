-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- "permission denied for table profiles" hatasının düzeltmesi.
--
-- RLS politikaları SATIR bazında filtreler ama rolün önce tablo seviyesinde temel
-- GRANT'e sahip olması gerekir — biri olmadan diğeri işe yaramaz. Bu projedeki hiçbir
-- migration bunu şu ana kadar açıkça vermemişti (normalde Supabase yeni tablolarda bunu
-- otomatik ayarlar, ama profiles tablosunda bir şekilde eksik kalmış); burada tüm
-- kullanıcı tablolarına authenticated rolü için gerekli izinleri açıkça veriyoruz.

grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.journal_photos to authenticated;
