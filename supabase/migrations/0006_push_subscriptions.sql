-- Web Push subscriptions (OBJECTIVES.md NOTIF-002).
--
-- One row per browser in which a dancer has turned notifications on. The
-- endpoint is the URL the browser's push service gave it; p256dh and auth are
-- the browser's public keys, used to encrypt what is sent. Rows are written by
-- /api/push/subscribe and removed when the dancer turns notifications off, when
-- the push service reports the subscription gone, or when the user row is deleted.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.users (clerk_id) on delete cascade,  -- Clerk id of the recipient
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id, updated_at desc);

-- No policies: only route handlers using the service role key read or write
-- this table. The browser never sees it.
alter table public.push_subscriptions enable row level security;
