create extension if not exists pgcrypto;

create table if not exists public.families (id uuid primary key default gen_random_uuid(), name text not null, invite_code text not null unique, created_at timestamptz not null default now());
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, family_id uuid not null references public.families(id) on delete restrict, display_name text not null, avatar_url text, role text not null default 'member' check (role in ('member','admin')), created_at timestamptz not null default now());
create table if not exists public.threads (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), pinned boolean not null default false);
create table if not exists public.posts (id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.threads(id) on delete cascade, user_id uuid not null references public.profiles(id), parent_post_id uuid references public.posts(id) on delete cascade, content text not null, image_url text, created_at timestamptz not null default now());
create table if not exists public.itineraries (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null, start_date date not null, end_date date not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create table if not exists public.itinerary_items (id uuid primary key default gen_random_uuid(), itinerary_id uuid not null references public.itineraries(id) on delete cascade, day_index integer not null check (day_index > 0), start_time time, title text not null, note text, location text, order_index integer not null default 0);
create table if not exists public.albums (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null, description text not null default '', created_at timestamptz not null default now());
alter table public.albums add column if not exists description text not null default '';
alter table public.profiles add column if not exists title_badge text not null default '';
alter table public.profiles add column if not exists title_color text not null default '#285c4d';
alter table public.profiles add column if not exists title_size text not null default 'medium';
create table if not exists public.photos (id uuid primary key default gen_random_uuid(), album_id uuid not null references public.albums(id) on delete cascade, storage_path text not null, uploaded_by uuid not null references public.profiles(id), caption text, location text not null default '', created_at timestamptz not null default now());
alter table public.photos add column if not exists location text not null default '';

create index if not exists profiles_family_id_idx on public.profiles(family_id);
create index if not exists threads_family_id_created_at_idx on public.threads(family_id, created_at desc);
create index if not exists posts_thread_id_created_at_idx on public.posts(thread_id, created_at);
create index if not exists itineraries_family_id_idx on public.itineraries(family_id);
create index if not exists albums_family_id_idx on public.albums(family_id);

create or replace function public.my_family_id() returns uuid language sql stable security definer set search_path = public as $$ select family_id from public.profiles where id = auth.uid() $$;
revoke all on function public.my_family_id() from public;
grant execute on function public.my_family_id() to authenticated;

drop function if exists public.bootstrap_family(text, text, text);
create or replace function public.bootstrap_family(p_display_name text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare target_family public.families;
declare created_profile public.profiles;
begin
  if auth.uid() is null or length(trim(p_display_name)) < 1 then raise exception 'A signed-in user and display name are required'; end if;
  select * into target_family from public.families order by created_at limit 1;
  if target_family.id is null then
    insert into public.families (name, invite_code) values ('吾黨所鍾', substr(md5(gen_random_uuid()::text), 1, 12)) returning * into target_family;
  end if;
  insert into public.profiles (id, family_id, display_name, role) values (auth.uid(), target_family.id, trim(p_display_name), 'member')
    on conflict (id) do update set display_name = excluded.display_name
    returning * into created_profile;
  return created_profile;
end;
$$;
revoke all on function public.bootstrap_family(text) from public;
grant execute on function public.bootstrap_family(text) to authenticated;

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;

drop policy if exists "members read their family" on public.families;
drop policy if exists "members read family profiles" on public.profiles;
drop policy if exists "members manage own profile" on public.profiles;
drop policy if exists "members manage family threads" on public.threads;
drop policy if exists "members read family threads" on public.threads;
drop policy if exists "members create family threads" on public.threads;
drop policy if exists "authors update own threads" on public.threads;
drop policy if exists "authors delete own threads" on public.threads;
drop policy if exists "members manage family posts" on public.posts;
drop policy if exists "members read family posts" on public.posts;
drop policy if exists "members create family posts" on public.posts;
drop policy if exists "authors update own posts" on public.posts;
drop policy if exists "authors delete own posts" on public.posts;
drop policy if exists "members manage family itineraries" on public.itineraries;
drop policy if exists "members manage itinerary items" on public.itinerary_items;
drop policy if exists "members manage family albums" on public.albums;
drop policy if exists "members manage album photos" on public.photos;
drop policy if exists "family members read photos" on storage.objects;
drop policy if exists "family members upload photos" on storage.objects;
drop policy if exists "family members delete own photos" on storage.objects;

create policy "members read their family" on public.families for select to authenticated using (id = public.my_family_id());
create policy "members read family profiles" on public.profiles for select to authenticated using (family_id = public.my_family_id());
create policy "members manage own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and family_id = public.my_family_id());
create policy "members read family threads" on public.threads for select to authenticated using (family_id = public.my_family_id());
create policy "members create family threads" on public.threads for insert to authenticated with check (family_id = public.my_family_id() and created_by = auth.uid());
create policy "authors update own threads" on public.threads for update to authenticated using (created_by = auth.uid() and family_id = public.my_family_id()) with check (created_by = auth.uid() and family_id = public.my_family_id());
create policy "authors delete own threads" on public.threads for delete to authenticated using (created_by = auth.uid() and family_id = public.my_family_id());
create policy "members read family posts" on public.posts for select to authenticated using (exists (select 1 from public.threads t where t.id = thread_id and t.family_id = public.my_family_id()));
create policy "members create family posts" on public.posts for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.threads t where t.id = thread_id and t.family_id = public.my_family_id()));
create policy "authors update own posts" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());
create policy "members manage family itineraries" on public.itineraries for all to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id() and created_by = auth.uid());
create policy "members manage itinerary items" on public.itinerary_items for all to authenticated using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.family_id = public.my_family_id())) with check (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.family_id = public.my_family_id()));
create policy "members manage family albums" on public.albums for all to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id());
create policy "members manage album photos" on public.photos for all to authenticated using (exists (select 1 from public.albums a where a.id = album_id and a.family_id = public.my_family_id())) with check (uploaded_by = auth.uid() and exists (select 1 from public.albums a where a.id = album_id and a.family_id = public.my_family_id()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('family-photos', 'family-photos', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']) on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;
create policy "family members read photos" on storage.objects for select to authenticated using (bucket_id = 'family-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);
create policy "family members upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'family-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);
create policy "family members delete own photos" on storage.objects for delete to authenticated using (bucket_id = 'family-photos' and owner_id = auth.uid()::text);
