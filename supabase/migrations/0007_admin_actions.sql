-- Admin console audit log (OBJECTIVES.md ADMIN-003).
--
-- One row each time an admin opens the dancer roster (which shows real names
-- and emails) or removes something. The row is written before the action is
-- carried out, and the action is refused if it cannot be written, so nothing
-- an admin does goes unrecorded. Rows are never updated or deleted by the app.

create table if not exists public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    text not null,                    -- Clerk id of the admin
  action      text not null check (action in ('view_roster', 'remove_user', 'block_user', 'remove_room')),
  target      text,                             -- Clerk id or room id acted on; null for a roster view
  created_at  timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);

-- No policies: only the admin console, using the service role key, reads or
-- writes this table. The browser never sees it.
alter table public.admin_actions enable row level security;
