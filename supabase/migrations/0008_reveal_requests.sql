-- Consent-based name and photo sharing (OBJECTIVES.md ID-001..003, PAY-017).
--
-- One row per ordered pair of dancers, written by the server only:
--   pending   A asked to see B's real name and profile photo (free)
--   allowed   B agreed; A may now pay
--   declined  B said no, or withdrew before A paid. Final: A cannot ask again.
--   revealed  a verified payment by A arrived while the row was still 'allowed'
-- Only B can move a row to 'allowed', and only a verified payment can move it to
-- 'revealed', so neither the requester nor a payment alone can disclose anything.
--
-- The old `reveals` table is no longer read or written by the app. It is left
-- untouched pending DEC-003.

create table if not exists public.reveal_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  text not null references public.users (clerk_id) on delete cascade,  -- who wants to see
  target_id     text not null references public.users (clerk_id) on delete cascade,  -- whose name and photo
  status        text not null default 'pending' check (status in ('pending', 'allowed', 'declined', 'revealed')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,                    -- when the target allowed or declined
  payment_id    text unique,                    -- Razorpay payment that paid for the reveal
  revealed_at   timestamptz,
  unique (requester_id, target_id),
  check (requester_id <> target_id)
);

create index if not exists reveal_requests_target_idx on public.reveal_requests (target_id);

-- The two people involved may read the row (ids and status only), which is what
-- lets Realtime tell each of them when it changes. No write policies.
alter table public.reveal_requests enable row level security;
drop policy if exists "reveal_requests: the two dancers read" on public.reveal_requests;
create policy "reveal_requests: the two dancers read" on public.reveal_requests
  for select using (requester_id = public.clerk_uid() or target_id = public.clerk_uid());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reveal_requests') then
    alter publication supabase_realtime add table public.reveal_requests;
  end if;
end
$$;

-- What each order buys. Existing rows and extension orders are 'extend'.
alter table public.payment_orders add column if not exists product text not null default 'extend';
alter table public.payment_orders drop constraint if exists payment_orders_product_check;
alter table public.payment_orders add constraint payment_orders_product_check check (product in ('extend', 'reveal'));
