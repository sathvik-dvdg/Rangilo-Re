-- Removes the Web Push subscriptions table (OBJECTIVES.md DEC-013).
--
-- Notifications were removed from the app on 2026-10-14, so nothing reads or
-- writes this table any more. Its rows are browser push endpoints and keys
-- tied to a user, so they are deleted rather than kept. Safe to run whether or
-- not 0006_push_subscriptions.sql was ever applied.

drop table if exists public.push_subscriptions;
