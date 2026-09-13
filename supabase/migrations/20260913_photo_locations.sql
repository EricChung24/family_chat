alter table public.photos add column if not exists location text not null default '';
notify pgrst, 'reload schema';
