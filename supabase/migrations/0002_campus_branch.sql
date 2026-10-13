-- Migration 0002: Add branch and college_year to users for Campus Energy Battle Leaderboard

alter table public.users add column if not exists branch text not null default 'CSE';
alter table public.users add column if not exists college_year text not null default '1st Year';

create index if not exists users_branch_idx on public.users (branch);
