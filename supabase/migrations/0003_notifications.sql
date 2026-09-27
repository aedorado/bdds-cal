-- Web push notifications for the seva team.
--
-- Three moving parts:
--   push_subscriptions  - one row per browser/device someone has enabled
--   notification_rules  - how far ahead to warn, per event type
--   notifications_sent  - the ledger that stops duplicates
--
-- The ledger is not optional. pg_cron does not retry a failed run and will
-- happily start a second run while the first is still going, so "have I already
-- sent this?" has to be a unique constraint in the database, not a guess.

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  -- Set when the push service tells us the subscription is dead (404/410),
  -- so we stop retrying it without losing the record.
  expired_at  timestamptz
);

create index push_subscriptions_profile_idx on push_subscriptions (profile_id)
  where expired_at is null;

-- Offsets are minutes before the event starts. The default ladder is deliberately
-- long for things you must prepare for and short for things that recur daily -
-- seven reminders for a 6:30am class you attend every morning is how people end
-- up muting the app entirely.
create table notification_rules (
  event_type      event_kind primary key,
  offsets_minutes integer[] not null default '{}',
  enabled         boolean not null default true,
  updated_at      timestamptz not null default now()
);

insert into notification_rules (event_type, offsets_minutes) values
  -- 2w, 1w, 4d, 2d, 1d, 6h, 1h
  ('flight',   '{20160, 10080, 5760, 2880, 1440, 360, 60}'),
  ('retreat',  '{20160, 10080, 5760, 2880, 1440, 360, 60}'),
  ('travel',   '{2880, 1440, 360, 60}'),
  ('festival', '{10080, 2880, 1440, 360}'),
  ('meeting',  '{1440, 360, 60}'),
  ('darshan',  '{1440, 60}'),
  ('class',    '{60}'),
  ('personal', '{60}'),
  ('other',    '{1440, 60}');

create table notifications_sent (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events (id) on delete cascade,
  -- The specific occurrence, so a recurring class reminds once per instance.
  occurrence_at   timestamptz not null,
  offset_minutes  integer not null,
  profile_id      uuid not null references profiles (id) on delete cascade,
  sent_at         timestamptz not null default now(),
  unique (event_id, occurrence_at, offset_minutes, profile_id)
);

create index notifications_sent_recent_idx on notifications_sent (sent_at desc);

-- Per-person switch. Absent row = notifications on, which is what someone who
-- just enabled push on their phone expects.
create table notification_prefs (
  profile_id  uuid primary key references profiles (id) on delete cascade,
  enabled     boolean not null default true,
  -- Null means "every type this person can see".
  event_types event_kind[],
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS

alter table push_subscriptions enable row level security;
alter table notification_rules enable row level security;
alter table notifications_sent enable row level security;
alter table notification_prefs enable row level security;

revoke all on push_subscriptions from anon;
revoke all on notification_rules from anon;
revoke all on notifications_sent from anon;
revoke all on notification_prefs from anon;

create policy "own subscriptions" on push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "own prefs" on notification_prefs for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "team reads rules"   on notification_rules for select to authenticated using (true);
create policy "admins write rules" on notification_rules for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "own sent log" on notifications_sent for select to authenticated
  using (profile_id = auth.uid() or is_admin());

create trigger notification_rules_touch before update on notification_rules
  for each row execute function touch_updated_at();
