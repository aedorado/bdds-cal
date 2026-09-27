-- Row Level Security + the public read surface.
--
-- The load-bearing decision: `anon` gets NO grant on `events` at all. The public
-- site reads a view that physically lacks internal_notes. RLS filters ROWS, not
-- COLUMNS - so a policy like "anon may read public events" would still hand the
-- browser internal_notes for every public event. The view closes that hole.

alter table profiles         enable row level security;
alter table editor_allowlist enable row level security;
alter table locations        enable row level security;
alter table events           enable row level security;
alter table flight_details   enable row level security;
alter table event_exceptions enable row level security;
alter table festivals        enable row level security;

-- Supabase grants anon/authenticated on new public tables by default. Undo that
-- for everything the public must never touch directly.
revoke all on events           from anon;
revoke all on flight_details   from anon;
revoke all on event_exceptions from anon;
revoke all on profiles         from anon;
revoke all on editor_allowlist from anon;

-- ---------------------------------------------------------------- profiles

create policy "read own profile"     on profiles for select to authenticated using (id = auth.uid());
create policy "admins read profiles" on profiles for select to authenticated using (is_admin());
create policy "update own name"      on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = current_role_of_user());
create policy "admins manage roles"  on profiles for update to authenticated using (is_admin());

create policy "admins manage allowlist" on editor_allowlist for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------- locations
-- Cities and their timezones are not sensitive, and the public calendar needs
-- them to label events.

create policy "anyone reads locations"   on locations for select to anon, authenticated using (true);
create policy "editors write locations"  on locations for all to authenticated
  using (is_editor()) with check (is_editor());

-- ---------------------------------------------------------------- events

-- Signed-in team members see everything except other people's private entries.
create policy "team reads events" on events for select to authenticated
  using (is_editor() or visibility in ('public', 'internal'));

create policy "editors insert events" on events for insert to authenticated with check (is_editor());
create policy "editors update events" on events for update to authenticated using (is_editor()) with check (is_editor());
create policy "editors delete events" on events for delete to authenticated using (is_editor());

create policy "editors manage flights"    on flight_details   for all to authenticated using (is_editor()) with check (is_editor());
create policy "editors manage exceptions" on event_exceptions for all to authenticated using (is_editor()) with check (is_editor());

-- ---------------------------------------------------------------- festivals

create policy "anyone reads festivals"  on festivals for select to anon, authenticated using (true);
create policy "editors write festivals" on festivals for all to authenticated
  using (is_editor()) with check (is_editor());

-- ---------------------------------------------------------------- public views
--
-- Deliberately SECURITY DEFINER (the Postgres default for views): it runs as the
-- owner, so it can read `events` even though anon cannot. That is the whole
-- point - the WHERE clause and the column list ARE the access control. Do not
-- "fix" these to security_invoker; that would require granting anon on events.

create view public_events
with (security_invoker = false) as
  select id, title, description, event_type,
         starts_at, start_tz, ends_at, end_tz, all_day,
         location_id, location_text,
         status, cancellation_reason,
         stream_url, stream_platform,
         rrule, recurrence_until
  from events
  where visibility = 'public'
    and status in ('confirmed', 'tentative', 'cancelled');

create view public_event_exceptions
with (security_invoker = false) as
  select x.id, x.parent_event_id, x.occurrence_date, x.action,
         x.override_starts_at, x.override_ends_at, x.override_title
  from event_exceptions x
  join events e on e.id = x.parent_event_id
  where e.visibility = 'public'
    and e.status in ('confirmed', 'tentative', 'cancelled');

grant select on public_events           to anon, authenticated;
grant select on public_event_exceptions to anon, authenticated;

comment on view public_events is
  'The only path the public site has to event data. internal_notes, created_by and '
  'flight_details are absent by construction, not by policy.';
