-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).
-- Harita ekranındaki dünya → ülke → şehir kademeli kümeleme için ülke adının
-- ayrı bir alan olarak tutulması gerekiyor (location_name sadece mahalle/şehir içeriyor).

alter table public.journal_entries
  add column if not exists country text;
