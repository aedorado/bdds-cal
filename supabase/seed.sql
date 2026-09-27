-- Starting locations. lat/lon are required by the festival importer, which
-- computes tithis for the observer's position - Ekadasi genuinely falls on
-- different civil dates in Vrindavan and Lagos.

insert into locations (name, city, country, tz, lat, lon, geoname_id) values
  ('Vrindavan',  'Vrindavan', 'India',   'Asia/Kolkata', 27.5806, 77.7006, 1253405),
  ('New Delhi',  'New Delhi', 'India',   'Asia/Kolkata', 28.6139, 77.2090, 1261481),
  ('Mayapur',    'Mayapur',   'India',   'Asia/Kolkata', 23.4248, 88.3897, 1264130),
  ('Lagos',      'Lagos',     'Nigeria', 'Africa/Lagos',  6.5244,  3.3792, 2332459)
on conflict do nothing;

-- Bootstrap the first admin. Replace with the Google account you will sign in
-- with; the row must exist BEFORE that first sign-in.
insert into editor_allowlist (email, role) values
  ('anuragiiitald@google.com', 'admin')
on conflict (email) do update set role = excluded.role;
