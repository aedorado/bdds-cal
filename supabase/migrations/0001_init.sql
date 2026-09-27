-- BDDS Calendar - initial schema
-- Core idea: every event carries its own IANA timezone at BOTH ends, so a flight
-- (depart Delhi, land Lagos) is not a special case - it is just an event whose
-- start_tz and end_tz differ.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type user_role       as enum ('admin', 'editor', 'viewer');
create type event_kind      as enum ('class', 'flight', 'travel', 'retreat',
                                     'festival', 'darshan', 'meeting', 'personal', 'other');
create type event_visibility as enum ('public', 'internal', 'private');
create type event_status    as enum ('draft', 'tentative', 'confirmed', 'cancelled');
create type festival_kind   as enum ('ekadasi', 'appearance', 'disappearance', 'festival', 'fasting');
create type exception_action as enum ('cancelled', 'moved');

-- ---------------------------------------------------------------- people

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  role       user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

-- Seed this table with an email BEFORE that person first signs in and they are
-- granted the role on sign-up. Otherwise everyone lands as 'viewer' and an
-- admin promotes them.
create table editor_allowlist (
  email      text primary key,
  role       user_role not null default 'editor',
  invited_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((select a.role from public.editor_allowlist a where lower(a.email) = lower(new.email)), 'viewer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- security definer so that policies ON profiles can call it without recursing
-- back through profiles' own RLS.
create function current_role_of_user()
returns user_role
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create function is_editor()
returns boolean
language sql
stable
as $$ select coalesce(current_role_of_user() in ('admin', 'editor'), false) $$;

create function is_admin()
returns boolean
language sql
stable
as $$ select coalesce(current_role_of_user() = 'admin', false) $$;

-- ---------------------------------------------------------------- places

create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  country     text,
  tz          text not null,              -- IANA, e.g. 'Asia/Kolkata'
  lat         double precision,           -- needed to compute festival dates
  lon         double precision,
  geoname_id  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- events

create table events (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  description         text,
  event_type          event_kind not null default 'class',

  starts_at           timestamptz not null,
  start_tz            text not null,
  ends_at             timestamptz not null,
  end_tz              text not null,
  all_day             boolean not null default false,

  location_id         uuid references locations (id) on delete set null,
  location_text       text,

  visibility          event_visibility not null default 'internal',
  status              event_status not null default 'confirmed',
  cancellation_reason text,

  stream_url          text,
  stream_platform     text,

  internal_notes      text,               -- never reaches the public view

  rrule               text,               -- null for one-off events
  recurrence_until    timestamptz,

  created_by          uuid references auth.users (id) on delete set null,
  updated_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint events_end_after_start check (ends_at >= starts_at),
  constraint events_cancelled_has_reason
    check (status <> 'cancelled' or cancellation_reason is not null)
);

create index events_starts_at_idx  on events (starts_at);
create index events_lookup_idx     on events (visibility, status, starts_at);
create index events_location_idx   on events (location_id);

-- Internal by construction: anon is never granted anything on this table.
create table flight_details (
  event_id           uuid primary key references events (id) on delete cascade,
  airline            text,
  flight_number      text,
  departure_airport  text,
  arrival_airport    text,
  departure_terminal text,
  arrival_terminal   text,
  seat               text,
  booking_ref        text,
  notes              text
);

-- One occurrence of a recurring series moved or dropped, without touching the series.
create table event_exceptions (
  id                 uuid primary key default gen_random_uuid(),
  parent_event_id    uuid not null references events (id) on delete cascade,
  occurrence_date    date not null,
  action             exception_action not null,
  override_starts_at timestamptz,
  override_ends_at   timestamptz,
  override_title     text,
  note               text,
  created_at         timestamptz not null default now(),
  unique (parent_event_id, occurrence_date)
);

-- ---------------------------------------------------------------- festivals

-- Computed reference data (gaurabda), not things anyone schedules - hence its
-- own table rather than rows in events.
create table festivals (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  name          text not null,
  festival_type festival_kind not null default 'festival',
  location_id   uuid references locations (id) on delete cascade,
  fasting_note  text,
  details       text,
  source        text not null default 'gaurabda',
  created_at    timestamptz not null default now(),
  unique (location_id, date, name)
);

create index festivals_date_idx on festivals (date);

-- ---------------------------------------------------------------- updated_at

create function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch    before update on events    for each row execute function touch_updated_at();
create trigger locations_touch before update on locations for each row execute function touch_updated_at();
