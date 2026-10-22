-- Series that are a list of dates rather than a pattern.
--
-- "Mon, Tue, Wed, then a Thursday two weeks later, then a Monday, then a
-- Saturday five weeks on" is not a rule - there is no interval or weekday set
-- that generates it. iCalendar calls this RDATE: explicit dates alongside (or
-- instead of) a rule.
--
-- Stored as dates, not timestamps: every occurrence shares the event's own
-- start time and timezone, so carrying a time on each one would let the two
-- disagree.

alter table events
  add column if not exists rdates date[];

comment on column events.rdates is
  'Explicit additional occurrence dates. The event''s own starts_at is always '
  'the first occurrence; these are the rest. Times come from starts_at.';

-- The public calendar reads this view, so it has to carry the new column or
-- dated series would appear as a single event to everyone but the team.
create or replace view public_events
with (security_invoker = false) as
  select id, title, description, event_type,
         starts_at, start_tz, ends_at, end_tz, all_day,
         location_id, location_text,
         status, cancellation_reason,
         stream_url, stream_platform,
         rrule, recurrence_until, rdates
  from events
  where visibility = 'public'
    and status in ('confirmed', 'tentative', 'cancelled');

grant select on public_events to anon, authenticated;
