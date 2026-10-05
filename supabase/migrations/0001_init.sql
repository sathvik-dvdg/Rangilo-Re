-- GarbaConnect schema.
--
-- Auth is Clerk. Supabase is configured with Clerk as a third-party auth
-- provider, so the browser client sends the Clerk session token and
-- auth.jwt()->>'sub' is the Clerk user id. All writes go through Next.js
-- route handlers using the service role key; the browser only reads
-- (and only what RLS lets it see) and listens on Realtime.

create extension if not exists pgcrypto;

create or replace function public.clerk_uid() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- users -----------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  clerk_id      text not null unique,
  display_name  text not null unique,
  gender        text not null check (gender in ('male', 'female', 'other')),
  real_name     text not null default '',
  email         text not null default '',
  is_online     boolean not null default false,
  last_seen     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;
-- No select policy for other users: real_name/email must never reach a
-- browser that hasn't paid. Public fields are served by /api/users.
create policy "users: read own row" on public.users
  for select using (clerk_id = public.clerk_uid());

-- rooms -----------------------------------------------------------------
create table if not exists public.rooms (
  id                text primary key,              -- sorted clerk ids joined with '_'
  participant_ids   text[] not null check (array_length(participant_ids, 1) = 2),
  timer_started_at  timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.rooms enable row level security;
create policy "rooms: participants read" on public.rooms
  for select using (public.clerk_uid() = any (participant_ids));

-- messages --------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null references public.rooms (id) on delete cascade,
  sender_id   text not null,
  text        text not null check (char_length(text) between 1 and 1000),
  created_at  timestamptz not null default now(),
  read_by     text[] not null default '{}'
);

create index if not exists messages_room_created_idx on public.messages (room_id, created_at);

alter table public.messages enable row level security;
create policy "messages: participants read" on public.messages
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = messages.room_id and public.clerk_uid() = any (r.participant_ids)
    )
  );

-- reveals ---------------------------------------------------------------
create table if not exists public.reveals (
  id          uuid primary key default gen_random_uuid(),
  payer_id    text not null,
  target_id   text not null,
  payment_id  text not null unique,
  paid_at     timestamptz not null default now(),
  unique (payer_id, target_id)
);

alter table public.reveals enable row level security;
create policy "reveals: payer reads" on public.reveals
  for select using (payer_id = public.clerk_uid());

-- chat_extensions -------------------------------------------------------
create table if not exists public.chat_extensions (
  id             uuid primary key default gen_random_uuid(),
  room_id        text not null references public.rooms (id) on delete cascade,
  payment_id     text not null unique,
  extra_seconds  integer not null default 120,
  paid_at        timestamptz not null default now()
);

alter table public.chat_extensions enable row level security;
create policy "extensions: participants read" on public.chat_extensions
  for select using (
    exists (
      select 1 from public.rooms r
      where r.id = chat_extensions.room_id and public.clerk_uid() = any (r.participant_ids)
    )
  );

-- Realtime --------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.chat_extensions;
