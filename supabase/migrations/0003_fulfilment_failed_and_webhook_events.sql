-- Recoverable fulfilment (OBJECTIVES.md PAY-010) and webhook event ids (PAY-008).
--
-- 1. payment_orders gains the 'fulfilment_failed' state: money was captured
--    but the entitlement could not be granted (for example the room no longer
--    exists). The row is kept for review or refund; a later delivery may still
--    settle it, and 'paid' stays final.
-- 2. webhook_events records every Razorpay event the webhook has finished
--    handling in Paid Mode, keyed by the x-razorpay-event-id header, so a
--    redelivered event is skipped.
--
-- Do not enable Paid Mode in production: the OBJECTIVES.md §8 gates are not met.

alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders
  add constraint payment_orders_status_check check (status in ('created', 'paid', 'failed', 'fulfilment_failed'));

create table if not exists public.webhook_events (
  event_id     text primary key,                 -- x-razorpay-event-id, unique per event
  event        text not null,                    -- e.g. payment.captured
  order_id     text,                             -- Razorpay order id, when the event carries one
  payment_id   text,                             -- Razorpay payment id, when the event carries one
  outcome      text not null,                    -- what the webhook did with it
  received_at  timestamptz not null default now()
);

create index if not exists webhook_events_order_idx on public.webhook_events (order_id);

-- No policies: only the webhook route, using the service role key, reads or
-- writes this table. The browser never sees it.
alter table public.webhook_events enable row level security;
