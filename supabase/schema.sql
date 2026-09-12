create extension if not exists pgcrypto;

create table if not exists public.families (id uuid primary key default gen_random_uuid(), name text not null, invite_code text not null unique, created_at timestamptz not null default now());
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, family_id uuid not null references public.families(id) on delete restrict, display_name text not null, avatar_url text, role text not null default 'member' check (role in ('member','admin')), created_at timestamptz not null default now());
create table if not exists public.threads (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), pinned boolean not null default false);
create table if not exists public.posts (id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.threads(id) on delete cascade, author_id uuid not null references public.profiles(id), content text not null, image_url text, created_at timestamptz not null default now());
create table if not exists public.itineraries (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null, start_date date not null, end_date date not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create table if not exists public.itinerary_items (id uuid primary key default gen_random_uuid(), itinerary_id uuid not null references public.itineraries(id) on delete cascade, day_index integer not null check (day_index > 0), start_time time, title text not null, note text, location text, order_index integer not null default 0);
create table if not exists public.albums (id uuid primary key default gen_random_uuid(), family_id uuid not null references public.families(id) on delete cascade, title text not null, created_at timestamptz not null default now());
create table if not exists public.photos (id uuid primary key default gen_random_uuid(), album_id uuid not null references public.albums(id) on delete cascade, storage_path text not null, uploaded_by uuid not null references public.profiles(id), caption text, created_at timestamptz not null default now());

create index if not exists profiles_family_id_idx on public.profiles(family_id);
create index if not exists threads_family_id_created_at_idx on public.threads(family_id, created_at desc);
create index if not exists posts_thread_id_created_at_idx on public.posts(thread_id, created_at);
create index if not exists itineraries_family_id_idx on public.itineraries(family_id);
create index if not exists albums_family_id_idx on public.albums(family_id);

create or replace function public.my_family_id() returns uuid language sql stable security definer set search_path = public as $$ select family_id from public.profiles where id = auth.uid() $$;
revoke all on function public.my_family_id() from public;
grant execute on function public.my_family_id() to authenticated;

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.albums enable row level security;
alter table public.photos enable row level security;

create policy "members read their family" on public.families for select to authenticated using (id = public.my_family_id());
create policy "members read family profiles" on public.profiles for select to authenticated using (family_id = public.my_family_id());
create policy "members manage own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and family_id = public.my_family_id());
create policy "members manage family threads" on public.threads for all to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id() and created_by = auth.uid());
create policy "members manage family posts" on public.posts for all to authenticated using (exists (select 1 from public.threads t where t.id = thread_id and t.family_id = public.my_family_id())) with check (author_id = auth.uid() and exists (select 1 from public.threads t where t.id = thread_id and t.family_id = public.my_family_id()));
create policy "members manage family itineraries" on public.itineraries for all to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id() and created_by = auth.uid());
create policy "members manage itinerary items" on public.itinerary_items for all to authenticated using (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.family_id = public.my_family_id())) with check (exists (select 1 from public.itineraries i where i.id = itinerary_id and i.family_id = public.my_family_id()));
create policy "members manage family albums" on public.albums for all to authenticated using (family_id = public.my_family_id()) with check (family_id = public.my_family_id());
create policy "members manage album photos" on public.photos for all to authenticated using (exists (select 1 from public.albums a where a.id = album_id and a.family_id = public.my_family_id())) with check (uploaded_by = auth.uid() and exists (select 1 from public.albums a where a.id = album_id and a.family_id = public.my_family_id()));

insert into storage.buckets (id, name, public) values ('family-photos', 'family-photos', false) on conflict (id) do nothing;
create policy "family members read photos" on storage.objects for select to authenticated using (bucket_id = 'family-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);
create policy "family members upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'family-photos' and (storage.foldername(name))[1] = public.my_family_id()::text);
create policy "family members delete own photos" on storage.objects for delete to authenticated using (bucket_id = 'family-photos' and owner_id = auth.uid()::text);
