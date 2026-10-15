-- Blocking (OBJECTIVES.md SAFE-001).
--
-- Keyed on users.clerk_id, like every other table that points at a dancer: the
-- browser only ever knows Clerk ids, and a block must survive the blocked person
-- re-onboarding under a new nickname (ONB-001 risk). Written by the server only.
-- A block hides each person from the other's dancer list and closes their room
-- to both, whoever blocked whom.

create table if not exists public.blocks (
  blocker_id  text not null references public.users (clerk_id) on delete cascade,
  blocked_id  text not null references public.users (clerk_id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Lookups run in both directions: "who did I block" and "who blocked me".
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Service role only: no read or write policies, so no browser can see who blocked whom.
alter table public.blocks enable row level security;
