-- Abandoned checkout cleanup (Supabase). Deletes draft/failed/expired checkout
-- sessions whose 24h TTL has passed. COMPLETED sessions (which produced a real
-- Order) are kept. Run once in the Supabase SQL editor.
--
-- The app also lazily marks/ignores expired sessions on read, so this job is a
-- backstop that keeps the table small.

create extension if not exists pg_cron;

-- Hourly purge of stale, never-completed sessions.
select cron.schedule(
  'purge-expired-checkout-sessions',
  '0 * * * *',
  $$
    delete from "CheckoutSession"
    where "status" <> 'COMPLETED'
      and "expiresAt" < now();
  $$
);

-- To inspect / remove the job later:
--   select * from cron.job;
--   select cron.unschedule('purge-expired-checkout-sessions');
