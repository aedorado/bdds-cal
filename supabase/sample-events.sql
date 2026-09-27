-- Optional demo data. Safe to delete later with:
--   delete from events where title like '[demo]%';
--
-- Deliberately includes an awkward schedule so the warnings panel has something
-- to catch: the Lagos lecture starts ~2h20m after the flight lands.

with loc as (
  select
    (select id from locations where name = 'Vrindavan') as vrindavan,
    (select id from locations where name = 'New Delhi') as delhi,
    (select id from locations where name = 'Lagos')     as lagos
)
insert into events (
  title, description, event_type, starts_at, start_tz, ends_at, end_tz,
  all_day, location_id, location_text, visibility, status,
  cancellation_reason, stream_url, stream_platform, internal_notes,
  rrule, recurrence_until
)
select * from (
  select
    '[demo] Srimad Bhagavatam class',
    'Daily morning class following mangala arati.',
    'class'::event_kind,
    timestamptz '2026-09-28 06:30 Asia/Kolkata', 'Asia/Kolkata',
    timestamptz '2026-09-28 07:30 Asia/Kolkata', 'Asia/Kolkata',
    false, (select vrindavan from loc), 'Rupa Sanatana Gaudiya Matha',
    'public'::event_visibility, 'confirmed'::event_status,
    null, 'https://example.com/live', 'YouTube', null,
    'FREQ=DAILY', timestamptz '2026-10-31 23:59 Asia/Kolkata'

  union all select
    '[demo] Flight DEL to LOS',
    null, 'flight'::event_kind,
    timestamptz '2026-10-02 23:05 Asia/Kolkata', 'Asia/Kolkata',
    timestamptz '2026-10-03 05:40 Africa/Lagos', 'Africa/Lagos',
    false, (select delhi from loc), 'Indira Gandhi Intl, T3',
    'internal'::event_visibility, 'confirmed'::event_status,
    null, null, null, 'Wheelchair assistance requested at both ends.',
    null, null

  union all select
    '[demo] Public lecture, Lagos',
    'Evening programme with kirtan and prasadam.',
    'class'::event_kind,
    timestamptz '2026-10-03 08:00 Africa/Lagos', 'Africa/Lagos',
    timestamptz '2026-10-03 10:00 Africa/Lagos', 'Africa/Lagos',
    false, (select lagos from loc), 'Sri Sri Radha Golokananda Mandir',
    'public'::event_visibility, 'confirmed'::event_status,
    null, null, null, null, null, null

  union all select
    '[demo] Braja Bliss Retreat',
    'Five days of parikrama, classes and kirtan in Vraja.',
    'retreat'::event_kind,
    timestamptz '2026-11-05 00:00 Asia/Kolkata', 'Asia/Kolkata',
    timestamptz '2026-11-09 23:59 Asia/Kolkata', 'Asia/Kolkata',
    true, (select vrindavan from loc), 'Vraja Mandala',
    'public'::event_visibility, 'confirmed'::event_status,
    null, null, null, 'Registrations close 20 Oct.', null, null

  union all select
    '[demo] Darshan (cancelled example)',
    null, 'darshan'::event_kind,
    timestamptz '2026-10-10 17:00 Asia/Kolkata', 'Asia/Kolkata',
    timestamptz '2026-10-10 18:00 Asia/Kolkata', 'Asia/Kolkata',
    false, (select vrindavan from loc), null,
    'public'::event_visibility, 'cancelled'::event_status,
    'Gurudeva is travelling that day. Rescheduled to 12 October.',
    null, null, null, null, null

  union all select
    '[demo] Rest',
    null, 'personal'::event_kind,
    timestamptz '2026-10-05 13:00 Africa/Lagos', 'Africa/Lagos',
    timestamptz '2026-10-05 16:00 Africa/Lagos', 'Africa/Lagos',
    false, (select lagos from loc), null,
    'private'::event_visibility, 'confirmed'::event_status,
    null, null, null, null, null, null
) as rows;

-- Flight detail for the demo flight.
insert into flight_details (event_id, airline, flight_number, departure_airport,
                            arrival_airport, departure_terminal, seat, booking_ref)
select id, 'Air India', 'AI 130', 'DEL', 'LOS', 'T3', '12A', 'DEMO12'
from events where title = '[demo] Flight DEL to LOS'
on conflict (event_id) do nothing;
