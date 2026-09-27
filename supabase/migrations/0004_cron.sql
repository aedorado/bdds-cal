-- Schedule the notification runner.
--
-- BEFORE RUNNING: replace PASTE_CRON_SECRET_HERE with the CRON_SECRET from
-- .env.local. It is deliberately not committed here, because this repository
-- is public. supabase/0004_cron.local.sql (gitignored) is the same file with
-- the secret already filled in - paste that one.
--
-- Vercel Cron cannot do this job: on the Hobby plan it fires at most once a
-- day, which makes a "1 hour before" reminder impossible. pg_cron is free,
-- included with the project, and accurate to the minute.

create extension if not exists pg_cron  with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- Keep the secret out of cron.job, which any database admin can read.
-- (Supabase Vault is encrypted at rest.)
select vault.create_secret('https://bdds-cal.vercel.app', 'app_url',     'Base URL of the deployed calendar');
select vault.create_secret('PASTE_CRON_SECRET_HERE',      'cron_secret', 'Shared secret for the notification runner');

select cron.schedule(
  'send-event-reminders',
  '*/5 * * * *',            -- every 5 minutes; a "1 hour before" lands 55-60 min ahead
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
               || '/api/notifications/run',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Housekeeping: the ledger only needs to be long enough to stop duplicates.
select cron.schedule(
  'prune-notification-log',
  '17 3 * * *',
  $$ delete from notifications_sent where sent_at < now() - interval '60 days' $$
);

-- Useful afterwards:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select * from net._http_response order by created desc limit 20;   -- what the endpoint replied
--
-- To change the schedule later, call cron.schedule again with the same job name.
-- To stop it:  select cron.unschedule('send-event-reminders');
