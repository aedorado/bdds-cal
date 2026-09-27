export const EVENT_TYPES = [
  "class", "flight", "travel", "retreat", "festival",
  "darshan", "meeting", "personal", "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const VISIBILITIES = ["public", "internal", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const STATUSES = ["draft", "tentative", "confirmed", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  class: "Class / Lecture",
  flight: "Flight",
  travel: "Travel (road / rail)",
  retreat: "Retreat / Festival tour",
  festival: "Festival programme",
  darshan: "Darshan / Meeting devotees",
  meeting: "Meeting",
  personal: "Personal / Rest",
  other: "Other",
};

// Used for the calendar chips. Kept as explicit hex so FullCalendar can consume
// them directly without a Tailwind class round-trip.
export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  class: "#7c3aed",
  flight: "#0284c7",
  travel: "#0891b2",
  retreat: "#c2410c",
  festival: "#b45309",
  darshan: "#15803d",
  meeting: "#57534e",
  personal: "#9f1239",
  other: "#64748b",
};

export const FESTIVAL_TYPES = [
  "ekadasi", "appearance", "disappearance", "festival", "fasting", "note",
] as const;
export type FestivalType = (typeof FESTIVAL_TYPES)[number];

export const FESTIVAL_TYPE_LABEL: Record<FestivalType, string> = {
  ekadasi: "Ekadasi",
  appearance: "Appearance days",
  disappearance: "Disappearance days",
  festival: "Festivals",
  fasting: "Fasting / parana",
  note: "Tithi notes",
};

/** Shown unless the reader asks for more. `note` is astronomical bookkeeping
 *  and putting it on by default covers the whole month. */
export const FESTIVAL_TYPES_DEFAULT: FestivalType[] = [
  "ekadasi", "festival", "appearance", "disappearance",
];

export const FESTIVAL_TYPE_COLOR: Record<FestivalType, string> = {
  ekadasi: "#b45309",
  appearance: "#4d7c0f",
  disappearance: "#57534e",
  festival: "#a16207",
  fasting: "#92400e",
  note: "#a8a29e",
};

export type Location = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  tz: string;
  lat: number | null;
  lon: number | null;
};

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  start_tz: string;
  ends_at: string;
  end_tz: string;
  all_day: boolean;
  location_id: string | null;
  location_text: string | null;
  status: Status;
  cancellation_reason: string | null;
  stream_url: string | null;
  stream_platform: string | null;
  rrule: string | null;
  recurrence_until: string | null;
  // Present only when read from `events` as an editor; never from public_events.
  visibility?: Visibility;
  internal_notes?: string | null;
};

export type FlightDetails = {
  event_id: string;
  airline: string | null;
  flight_number: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_terminal: string | null;
  arrival_terminal: string | null;
  seat: string | null;
  booking_ref: string | null;
  notes: string | null;
};
