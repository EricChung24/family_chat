-- WARNING: permanently deletes all family content and profiles.
-- Run this file first, then run supabase/schema.sql in the SQL Editor.

drop table if exists public.photos cascade;
drop table if exists public.albums cascade;
drop table if exists public.itinerary_items cascade;
drop table if exists public.itineraries cascade;
drop table if exists public.posts cascade;
drop table if exists public.threads cascade;
drop table if exists public.profiles cascade;
drop table if exists public.families cascade;

drop function if exists public.bootstrap_family(text, text, text) cascade;
drop function if exists public.bootstrap_family(text) cascade;
drop function if exists public.my_family_id() cascade;

-- Storage is protected by Supabase and must not be deleted with SQL.
-- Remove files manually from Storage > family-photos if required.
