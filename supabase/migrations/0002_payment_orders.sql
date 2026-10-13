-- Payment ledger (OBJECTIVES.md PAY-003).
--
-- One row per Razorpay order created by /api/payment/create-order. The
-- checkout verify route and the Razorpay webhook move it from 'created' to
-- 'paid' or 'failed'. A row is never deleted, and 'paid' is final.
--
-- Do not enable Paid Mode in production: the OBJECTIVES.md §8 gates are not
-- met. This table only makes Paid Mode workable with Razorpay test keys.

create table if not exists public.payment_orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,                    -- Clerk id of the buyer
  room_id     text not null,                    -- room the extension is for
  order_id    text not null unique,             -- Razorpay order id
  payment_id  text unique,                      -- Razorpay payment id, set by verify or the webhook
  status      text not null default 'created' check (status in ('created', 'paid', 'failed')),
  amount      integer not null check (amount > 0),  -- paise
  currency    text not null default 'INR',
  created_at  timestamptz not null default now()
);

create index if not exists payment_orders_user_idx on public.payment_orders (user_id, created_at);

-- No policies: only route handlers using the service role key read or write
-- this table. The browser never sees it.
alter table public.payment_orders enable row level security;
