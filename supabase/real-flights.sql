-- Real itinerary, Sept-Oct 2026. Contains booking references, so this file is
-- gitignored - do not commit it. booking_ref lives only in flight_details,
-- which anon has no grant on and which never appears in public_events.
--
-- Note on AW 216: the itinerary prints "2H 10M", but Accra 12:50 -> Lagos 15:00
-- is 1h10m (Ghana is GMT+0, Nigeria UTC+1). The printed local times are used
-- here; worth confirming with the airline.

insert into locations (name, city, country, tz, lat, lon) values
  ('Accra',   'Accra',   'Ghana', 'Africa/Accra',    5.6037, -0.1870),
  ('Nairobi', 'Nairobi', 'Kenya', 'Africa/Nairobi', -1.2864, 36.8172)
on conflict do nothing;

with loc as (
  select
    (select id from locations where name = 'Lagos')   as lagos,
    (select id from locations where name = 'Accra')   as accra,
    (select id from locations where name = 'Nairobi') as nairobi
)
insert into events (title, event_type, starts_at, start_tz, ends_at, end_tz,
                    all_day, location_id, location_text, visibility, status)
select * from (
  select 'KQ 533  Lagos to Nairobi', 'flight'::event_kind,
         timestamptz '2026-09-30 12:25 Africa/Lagos',   'Africa/Lagos',
         timestamptz '2026-09-30 19:45 Africa/Nairobi', 'Africa/Nairobi',
         false, (select lagos from loc), 'Murtala Muhammed, T2I',
         'internal'::event_visibility, 'confirmed'::event_status
  union all select 'KQ 532  Nairobi to Lagos', 'flight',
         timestamptz '2026-10-12 08:15 Africa/Nairobi', 'Africa/Nairobi',
         timestamptz '2026-10-12 11:30 Africa/Lagos',   'Africa/Lagos',
         false, (select nairobi from loc), 'Jomo Kenyatta Intl, T1A',
         'internal', 'confirmed'
  union all select 'AW 215  Lagos to Accra', 'flight',
         timestamptz '2026-10-14 13:40 Africa/Lagos', 'Africa/Lagos',
         timestamptz '2026-10-14 13:40 Africa/Accra', 'Africa/Accra',
         false, (select lagos from loc), 'Murtala Muhammed, T2',
         'internal', 'confirmed'
  union all select 'AW 216  Accra to Lagos', 'flight',
         timestamptz '2026-10-25 12:50 Africa/Accra', 'Africa/Accra',
         timestamptz '2026-10-25 15:00 Africa/Lagos', 'Africa/Lagos',
         false, (select accra from loc), 'Kotoka Intl',
         'internal', 'confirmed'
) as rows;

insert into flight_details (event_id, airline, flight_number, departure_airport,
                            arrival_airport, departure_terminal, arrival_terminal,
                            booking_ref, notes)
select e.id, d.airline, d.flight_number, d.dep, d.arr, d.dep_t, d.arr_t, d.ref, d.notes
from (values
  ('KQ 533  Lagos to Nairobi', 'Kenya Airways',        'KQ 533', 'LOS', 'NBO', '2I', '1A', 'NMENRI', 'Business / Z. Airline ref EJ5PL6.'),
  ('KQ 532  Nairobi to Lagos', 'Kenya Airways',        'KQ 532', 'NBO', 'LOS', '1A', '2I', 'NMENRI', 'Business / Z. Airline ref EJ5PL6.'),
  ('AW 215  Lagos to Accra',   'Africa World Airlines','AW 215', 'LOS', 'ACC', '2',  '3',  '885TAC', 'Airline ref JMCNEN.'),
  ('AW 216  Accra to Lagos',   'Africa World Airlines','AW 216', 'ACC', 'LOS', null, null, '885TAC', 'Airline ref JMCNEN. Itinerary prints 2H10M but local times give 1h10m.')
) as d(title, airline, flight_number, dep, arr, dep_t, arr_t, ref, notes)
join events e on e.title = d.title
on conflict (event_id) do nothing;
