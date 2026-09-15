-- Supabase SQL Editor'de çalıştır (Project → SQL Editor → New query).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Kullanıcı sadece kendi satırını görebilir/oluşturabilir/güncelleyebilir (auth.uid() = id).
create policy "users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Yeni kullanıcı sign up olduğunda auth.users'a otomatik boş bir profiles satırı eklenir.
-- security definer + sabit search_path: auth.users üzerindeki trigger, normal kullanıcı
-- yetkisiyle public.profiles'a insert yapamayacağı için gerekli (Supabase'in kendi önerdiği desen).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
