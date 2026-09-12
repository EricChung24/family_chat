-- Forum author ownership migration
-- Safe for existing data: renames author_id to user_id and preserves rows.

begin;

alter table if exists public.posts enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'author_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'user_id'
  ) then
    alter table public.posts rename column author_id to user_id;
  end if;
end $$;

alter table public.posts
  alter column user_id set not null;

drop policy if exists "members manage family posts" on public.posts;
drop policy if exists "members read family posts" on public.posts;
drop policy if exists "members create family posts" on public.posts;
drop policy if exists "authors update own posts" on public.posts;
drop policy if exists "authors delete own posts" on public.posts;

create policy "members read family posts"
on public.posts for select to authenticated
using (exists (
  select 1 from public.threads t
  where t.id = thread_id and t.family_id = public.my_family_id()
));

create policy "members create family posts"
on public.posts for insert to authenticated
with check (
  auth.uid() = user_id and exists (
    select 1 from public.threads t
    where t.id = thread_id and t.family_id = public.my_family_id()
  )
);

create policy "authors update own posts"
on public.posts for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "authors delete own posts"
on public.posts for delete to authenticated
using (auth.uid() = user_id);

commit;

-- Verification (run separately if desired):
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'posts';
-- select policyname from pg_policies
-- where schemaname = 'public' and tablename = 'posts';
