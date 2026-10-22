import { z } from "zod";
import { EVENT_TYPES, STATUSES, VISIBILITIES } from "./types";
import { FREQUENCIES, WEEKDAYS, type Frequency_, type WeekdayKey } from "./recurrence";

export const REPEATS = ["none", "daily", "weekdays", "weekly", "custom", "dates"] as const;
export type Repeat = (typeof REPEATS)[number];

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekdays: "Every weekday (Mon-Fri)",
  weekly: "Every week, same day",
  custom: "Custom…",
  dates: "On specific dates…",
};

/** The presets are just named shapes of the same custom rule. */
/** A pattern, as opposed to a hand-picked list of dates. */
export const isRuleBased = (r: Repeat) =>
  r !== "none" && r !== "dates";

export const REPEAT_PRESET: Record<
  Exclude<Repeat, "none" | "custom" | "dates">,
  { freq: Frequency_; interval: number; byday: WeekdayKey[] }
> = {
  daily: { freq: "daily", interval: 1, byday: [] },
  weekdays: { freq: "weekly", interval: 1, byday: ["MO", "TU", "WE", "TH", "FR"] },
  weekly: { freq: "weekly", interval: 1, byday: [] },
};

const optional = (s: z.ZodString) =>
  z.preprocess(
    (v) =>
      v === undefined || v === null || (typeof v === "string" && v.trim() === "")
        ? null
        : v,
    s.nullable(),
  );

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
    custom_freq: z.enum(FREQUENCIES).default("weekly"),
    custom_interval: z.coerce.number().int().min(1).max(365).default(1),
    custom_byday: z.array(z.enum(WEEKDAYS.map((w) => w.key) as [WeekdayKey, ...WeekdayKey[]])).default([]),
    end_mode: z.enum(["on", "after", "never"]).default("on"),
    repeat_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
    repeat_count: z.coerce.number().int().min(1).max(999).optional(),
    /** repeat = "dates": occurrences beyond the start date, as yyyy-MM-dd. */
    rdates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default([]),

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
  .refine((v) => !isRuleBased(v.repeat) || v.end_mode !== "on" || !!v.repeat_until, {
    message: "Choose the date it should stop repeating",
    path: ["repeat_until"],
  })
  .refine((v) => !isRuleBased(v.repeat) || v.end_mode !== "after" || !!v.repeat_count, {
    message: "Say how many times it should repeat",
    path: ["repeat_count"],
  })
  .refine(
    (v) => v.repeat !== "custom" || v.custom_freq !== "weekly" || v.custom_byday.length > 0,
    { message: "Pick at least one day of the week", path: ["custom_byday"] },
  )
  .refine((v) => v.repeat !== "dates" || v.rdates.length > 0, {
    message: "Add at least one more date, or choose \"Does not repeat\"",
    path: ["rdates"],
  });

export type EventFormValues = z.input<typeof eventFormSchema>;
export type EventFormParsed = z.output<typeof eventFormSchema>;
