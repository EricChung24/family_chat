alter table public.profiles add column if not exists title_badge text not null default '';
alter table public.profiles add column if not exists title_color text not null default '#285c4d';
alter table public.profiles add column if not exists title_size text not null default 'medium';
notify pgrst, 'reload schema';
