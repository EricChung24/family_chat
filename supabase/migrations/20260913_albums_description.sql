-- Add the album story field for existing deployments.
alter table public.albums
  add column if not exists description text not null default '';

notify pgrst, 'reload schema';
