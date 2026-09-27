-- Reminders must reach every device a person registered, not just one.
--
-- The original unique constraint keyed on (event, occurrence, offset,
-- profile_id), which made "have I sent this?" a per-PERSON question. With a
-- phone and a laptop registered, the first subscription claimed the reminder
-- and the rest were rejected as duplicates - so it arrived on one arbitrary
-- device, quite possibly the one that was closed.
--
-- Keying on the subscription instead makes it a per-DEVICE question, which is
-- what the duplicate guard was always meant to prevent: the same device being
-- buzzed twice for the same reminder.

alter table notifications_sent
  add column if not exists subscription_id uuid
    references push_subscriptions (id) on delete cascade;

-- Postgres truncates auto-generated constraint names to 63 characters, so the
-- old one is found by its definition rather than by a guessed name.
do $$
declare
  old_name text;
begin
  select conname into old_name
    from pg_constraint
   where conrelid = 'public.notifications_sent'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) like '%profile_id%';
  if old_name is not null then
    execute format('alter table notifications_sent drop constraint %I', old_name);
  end if;
end $$;

-- Older rows predate the column and cannot be attributed to a device; they are
-- only a few minutes of history, so drop them rather than invent a mapping.
delete from notifications_sent where subscription_id is null;

alter table notifications_sent
  alter column subscription_id set not null;

alter table notifications_sent
  add constraint notifications_sent_per_device
  unique (event_id, occurrence_at, offset_minutes, subscription_id);
