-- Separate top-level comments from replies to comments.
alter table if exists public.posts
  add column if not exists parent_post_id uuid references public.posts(id) on delete cascade;

create index if not exists posts_parent_post_id_idx on public.posts(parent_post_id);
