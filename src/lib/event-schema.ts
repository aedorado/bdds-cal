import { z } from "zod";
import { EVENT_TYPES, STATUSES, VISIBILITIES } from "./types";

export const REPEATS = ["none", "daily", "weekdays", "weekly"] as const;
export type Repeat = (typeof REPEATS)[number];

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekdays: "Every weekday (Mon-Fri)",
  weekly: "Every week, same day",
};

export const RRULE_FOR: Record<Exclude<Repeat, "none">, string> = {
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
};

const optional = (s: z.ZodString) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), s.nullable());

export const eventFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1, "Give the event a title").max(200),
    description: optional(z.string().max(5000)),
    event_type: z.enum(EVENT_TYPES),

    all_day: z.coerce.boolean(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
    start_tz: z.string().min(1, "Pick a timezone"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")),
    end_tz: z.string().min(1, "Pick a timezone"),

    location_id: optional(z.string().uuid()),
    location_text: optional(z.string().max(200)),

    visibility: z.enum(VISIBILITIES),
    status: z.enum(STATUSES),
    cancellation_reason: optional(z.string().max(500)),

    stream_url: optional(z.string().url("That does not look like a URL")),
    stream_platform: optional(z.string().max(60)),
    internal_notes: optional(z.string().max(5000)),

    repeat: z.enum(REPEATS),
    repeat_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),

    // Flight-only. Ignored unless event_type === "flight".
    airline: optional(z.string().max(80)),
    flight_number: optional(z.string().max(20)),
    departure_airport: optional(z.string().max(80)),
    arrival_airport: optional(z.string().max(80)),
    departure_terminal: optional(z.string().max(20)),
    arrival_terminal: optional(z.string().max(20)),
    seat: optional(z.string().max(20)),
    booking_ref: optional(z.string().max(40)),
  })
  .refine((v) => v.status !== "cancelled" || !!v.cancellation_reason, {
    message: "Say why it was cancelled - devotees will see this",
    path: ["cancellation_reason"],
  })
  .refine((v) => v.repeat === "none" || !!v.repeat_until, {
    message: "A repeating event needs an end date",
    path: ["repeat_until"],
  });

export type EventFormValues = z.input<typeof eventFormSchema>;
export type EventFormParsed = z.output<typeof eventFormSchema>;
