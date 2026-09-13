-- Add the album story field for existing deployments.
alter table public.albums
  add column if not exists description text not null default '';

notify pgrst, 'reload schema';

-- Supabase Free supports a 50 MB per-file limit; keep the bucket private and
-- restrict uploads to common image formats.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-photos', 'family-photos', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;
