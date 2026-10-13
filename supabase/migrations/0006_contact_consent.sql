-- Contact exchange with consent, and unlimited chat (OBJECTIVES.md DEC-002 as
-- revised 2026-10-14; ID-001, ID-002, PAY-010, PAY-012).
--
-- A captured payment does two things, both from the server (lib/payments.ts):
--   1. it sets rooms.unlimited, so the chat no longer expires, at once and
--      whatever happens next;
--   2. it creates a 'pending' request in contact_consents, which discloses
--      nothing.
-- Only the other person in the room can answer that request:
--   accept  -> one transaction: the request becomes 'accepted' and a
--              contact_reveals row is written for the pair.
--   decline -> the request becomes 'declined'. Nothing is shared.
-- A request nobody answers within 24 hours becomes 'expired', which is handled
-- exactly like a decline. None of these touches rooms.unlimited or the order:
-- the buyer keeps the unlimited chat and no refund is due.
--
-- real_name and email are NOT opened up by any policy here. The users table
-- keeps its single "read own row" policy; the server returns the two fields
-- to the other person only when a contact_reveals row exists for the pair.
--
-- The only refund case is a payment that was captured but did not unlock the
-- chat. Refunds are manual:
--   select * from payment_orders where status = 'fulfilment_failed';
-- Set the order to 'refunded' once the money has gone back.
--
-- Do not enable Paid Mode in production: the OBJECTIVES.md §8 gates are not met.

-- rooms ------------------------------------------------------------------
alter table public.rooms add column if not exists unlimited boolean not null default false;

-- payment_orders ---------------------------------------------------------
-- 'refunded': set by hand once a 'fulfilment_failed' order has been refunded.
alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders
  add constraint payment_orders_status_check
  check (status in ('created', 'paid', 'failed', 'fulfilment_failed', 'refunded'));

-- contact_consents -------------------------------------------------------
create table if not exists public.contact_consents (
  id                uuid primary key default gen_random_uuid(),
  room_id           text not null references public.rooms (id),
  requester_id      text not null,                 -- Clerk id of the person who paid
  partner_id        text not null,                 -- Clerk id of the person being asked
  status            text not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined', 'expired')),
  payment_order_id  uuid not null unique references public.payment_orders (id),
  requested_at      timestamptz not null default now(),
  responded_at      timestamptz,                   -- when the partner answered; null while pending or if it expired
  check (requester_id <> partner_id)
);

-- One request per person per room, ever: after a decline the same person
-- cannot ask again.
create unique index if not exists contact_consents_room_requester_key on public.contact_consents (room_id, requester_id);
-- At most one request open or accepted per room, so a second payment for the
-- same room (from either person) cannot create another.
create unique index if not exists contact_consents_room_open_key on public.contact_consents (room_id)
  where status in ('pending', 'accepted');
create index if not exists contact_consents_partner_pending_idx on public.contact_consents (partner_id)
  where status = 'pending';

-- Read-only for the two people involved, which is also what lets Realtime
-- deliver status changes to them. No insert/update/delete policy: every write
-- goes through a route handler using the service role key.
alter table public.contact_consents enable row level security;
drop policy if exists "contact consents: requester and partner read" on public.contact_consents;
create policy "contact consents: requester and partner read" on public.contact_consents
  for select using (public.clerk_uid() in (requester_id, partner_id));

-- contact_reveals --------------------------------------------------------
-- A row here is the only thing that allows real_name and email to be shown,
-- and only to the two people named in it.
create table if not exists public.contact_reveals (
  id           uuid primary key default gen_random_uuid(),
  room_id      text not null unique references public.rooms (id),   -- one reveal per room
  user_a_id    text not null,
  user_b_id    text not null,
  consent_id   uuid not null unique references public.contact_consents (id),  -- the accepted request behind it
  revealed_at  timestamptz not null default now(),
  check (user_a_id <> user_b_id)
);

create index if not exists contact_reveals_user_a_idx on public.contact_reveals (user_a_id);
create index if not exists contact_reveals_user_b_idx on public.contact_reveals (user_b_id);

alter table public.contact_reveals enable row level security;
drop policy if exists "contact reveals: the pair reads" on public.contact_reveals;
create policy "contact reveals: the pair reads" on public.contact_reveals
  for select using (public.clerk_uid() in (user_a_id, user_b_id));

-- Answering a request ----------------------------------------------------
-- Called only by route handlers, after they have checked who is signed in.
-- Each returns false, having changed nothing, when the request is not this
-- partner's or is no longer pending.

create or replace function public.accept_contact_consent(p_consent_id uuid, p_partner_id text)
returns boolean
language plpgsql
as $$
declare
  c public.contact_consents;
begin
  update public.contact_consents
     set status = 'accepted', responded_at = now()
   where id = p_consent_id
     and partner_id = p_partner_id
     and status = 'pending'
     and requested_at > now() - interval '24 hours'
  returning * into c;
  if not found then
    return false;
  end if;

  -- rooms.unlimited is not touched here: the payment already set it.
  insert into public.contact_reveals (room_id, user_a_id, user_b_id, consent_id)
  values (c.room_id, least(c.requester_id, c.partner_id), greatest(c.requester_id, c.partner_id), c.id);
  return true;
end
$$;

-- Declining shares nothing and changes nothing else: the room stays
-- unlimited and the order stays paid.
create or replace function public.decline_contact_consent(p_consent_id uuid, p_partner_id text)
returns boolean
language plpgsql
as $$
begin
  update public.contact_consents
     set status = 'declined', responded_at = now()
   where id = p_consent_id
     and partner_id = p_partner_id
     and status = 'pending';
  return found;
end
$$;

-- Closes every request that has had no answer for 24 hours (in one room, or
-- in all of them). Returns how many it closed. Like a decline, it leaves the
-- room and the order alone.
create or replace function public.expire_contact_consents(p_room_id text default null)
returns integer
language sql
as $$
  with closed as (
    update public.contact_consents
       set status = 'expired'
     where status = 'pending'
       and requested_at <= now() - interval '24 hours'
       and (p_room_id is null or room_id = p_room_id)
    returning id
  )
  select count(*)::integer from closed;
$$;

-- The browser must never be able to call these through the API.
revoke all on function public.accept_contact_consent(uuid, text) from public, anon, authenticated;
revoke all on function public.decline_contact_consent(uuid, text) from public, anon, authenticated;
revoke all on function public.expire_contact_consents(text) from public, anon, authenticated;
grant execute on function public.accept_contact_consent(uuid, text) to service_role;
grant execute on function public.decline_contact_consent(uuid, text) to service_role;
grant execute on function public.expire_contact_consents(text) to service_role;

-- Realtime ---------------------------------------------------------------
-- Status changes reach both people at once. public.rooms is already in the
-- publication, so the `unlimited` flag set at payment time is delivered with
-- the room row.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'contact_consents') then
    alter publication supabase_realtime add table public.contact_consents;
  end if;
end
$$;
