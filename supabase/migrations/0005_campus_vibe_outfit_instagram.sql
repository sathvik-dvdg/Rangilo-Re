-- Migration 0005: Add vibe_tag, outfit_color, and instagram_handle to users for Garba Night profiles
alter table public.users add column if not exists vibe_tag text;
alter table public.users add column if not exists outfit_color text;
alter table public.users add column if not exists instagram_handle text;

create index if not exists users_vibe_tag_idx on public.users (vibe_tag);
