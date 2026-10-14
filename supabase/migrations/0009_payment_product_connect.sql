-- Allow 'connect' in payment_orders.product and set default to 'connect' (OBJECTIVES.md DEC-002, DEC-012).
alter table public.payment_orders drop constraint if exists payment_orders_product_check;
alter table public.payment_orders
  add constraint payment_orders_product_check
  check (product in ('connect', 'extend', 'reveal'));
alter table public.payment_orders alter column product set default 'connect';
