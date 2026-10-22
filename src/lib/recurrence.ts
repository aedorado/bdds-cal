import { RRule, rrulestr, Frequency, Weekday } from "rrule";
import { DateTime } from "luxon";

/**
 * Recurrence is stored as an RRULE string plus recurrence_until, the date of
 * the last possible occurrence.
 *
 * recurrence_until is derived, not merely copied: a series that ends "after 10
 * occurrences" has no UNTIL of its own, but the calendar query and the
 * notification runner both filter on recurrence_until to decide which series
 * are still live. Computing the real last occurrence keeps those queries
 * honest instead of making them special-case COUNT.
 *
 * Rules are built and expanded against FLOATING local time - the wall clock in
 * the event's own zone - so a weekly 06:30 class stays at 06:30 across a DST
 * boundary rather than sliding by an hour.
 */

export const FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type Frequency_ = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<Frequency_, [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
};

/** RRULE weekday order: Monday first, matching the calendar. */
export const WEEKDAYS = [
  { key: "MO", label: "M", full: "Monday" },
  { key: "TU", label: "T", full: "Tuesday" },
  { key: "WE", label: "W", full: "Wednesday" },
  { key: "TH", label: "T", full: "Thursday" },
  { key: "FR", label: "F", full: "Friday" },
  { key: "SA", label: "S", full: "Saturday" },
  { key: "SU", label: "S", full: "Sunday" },
] as const;

export type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

export type EndMode = "on" | "after" | "never";

export type RecurrenceInput = {
  freq: Frequency_;
  interval: number;
  /** Weekly only. Empty means "the same weekday the event starts on". */
  byday: WeekdayKey[];
  endMode: EndMode;
  /** endMode "on": last date, as yyyy-MM-dd in the event's own zone. */
  untilDate?: string;
  /** endMode "after": number of occurrences. */
  count?: number;
};

const FREQ_MAP: Record<Frequency_, Frequency> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
};

const WEEKDAY_MAP: Record<WeekdayKey, Weekday> = {
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH,
  FR: RRule.FR, SA: RRule.SA, SU: RRule.SU,
};

/** How far ahead an open-ended series is treated as running. */
const NEVER_HORIZON_YEARS = 5;

/** A local wall-clock time expressed as a UTC Date, for rrule's benefit. */
function floating(dt: DateTime): Date {
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, 0));
}

function fromFloating(d: Date, zone: string): DateTime {
  return DateTime.fromObject(
    {
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
      hour: d.getUTCHours(), minute: d.getUTCMinutes(),
    },
    { zone },
  );
}

export function buildRecurrence(
  input: RecurrenceInput,
  startUtcIso: string,
  zone: string,
): { rrule: string; recurrenceUntil: string } {
  const localStart = DateTime.fromISO(startUtcIso, { zone: "utc" }).setZone(zone);

  const options: Partial<ConstructorParameters<typeof RRule>[0]> = {
    freq: FREQ_MAP[input.freq],
    interval: Math.max(1, input.interval || 1),
    dtstart: floating(localStart),
  };

  if (input.freq === "weekly" && input.byday.length > 0) {
    options.byweekday = input.byday.map((d) => WEEKDAY_MAP[d]);
  }

  // The rule itself carries the end condition, so reading it back is exact.
  // An open-ended series carries NEITHER until nor count - inventing a far
  // future UNTIL would come back as a date the user never chose.
  if (input.endMode === "after") {
    options.count = Math.max(1, input.count || 1);
  } else if (input.endMode === "on" && input.untilDate) {
    options.until = floating(DateTime.fromISO(`${input.untilDate}T23:59`, { zone }));
  }

  const rule = new RRule(options as ConstructorParameters<typeof RRule>[0]);

  // recurrence_until is a horizon for queries, not part of the rule: "could
  // this series still produce an occurrence?". For a bounded rule it is the
  // real last occurrence; for an open-ended one it is a rolling horizon.
  let recurrenceUntil: string;
  if (input.endMode === "never") {
    recurrenceUntil = localStart.plus({ years: NEVER_HORIZON_YEARS }).endOf("day").toUTC().toISO()!;
  } else {
    const all = rule.all((_, i) => i < 1000);
    const last = all.length > 0 ? all[all.length - 1] : floating(localStart);
    recurrenceUntil = fromFloating(last, zone).endOf("day").toUTC().toISO()!;
  }

  // Stored without DTSTART: the event's own starts_at is the series anchor,
  // and duplicating it invites the two drifting apart.
  const rruleText = rule.toString().split("\n").find((l) => l.startsWith("RRULE:"))
    ?? `RRULE:${rule.toString()}`;

  return { rrule: rruleText.replace(/^RRULE:/, ""), recurrenceUntil };
}

/** Read a stored rule back into the shape the form edits. */
export function parseRecurrence(
  rruleText: string | null,
  startUtcIso: string,
  zone: string,
): RecurrenceInput | null {
  if (!rruleText) return null;

  let rule: RRule;
  try {
    const localStart = DateTime.fromISO(startUtcIso, { zone: "utc" }).setZone(zone);
    rule = rrulestr(
      `DTSTART:${floating(localStart).toISOString().replace(/[-:]|\.\d{3}/g, "")}\nRRULE:${rruleText}`,
    ) as RRule;
  } catch {
    return null;
  }

  const o = rule.origOptions;
  const freq: Frequency_ =
    o.freq === RRule.MONTHLY ? "monthly" : o.freq === RRule.WEEKLY ? "weekly" : "daily";

  const byday = (Array.isArray(o.byweekday) ? o.byweekday : o.byweekday ? [o.byweekday] : [])
    .map((w) => {
      const n = typeof w === "number" ? w : (w as Weekday).weekday;
      return WEEKDAYS[n]?.key;
    })
    .filter(Boolean) as WeekdayKey[];

  // Read the end condition from the rule, never from recurrence_until - that
  // is a derived horizon, and deriving the mode back out of it turned "until
  // 20 Oct" into "until 19 Oct" (the last occurrence) and turned "never" into
  // a concrete date nobody picked.
  let endMode: EndMode = "never";
  let untilDate: string | undefined;
  let count: number | undefined;

  if (o.count) {
    endMode = "after";
    count = o.count;
  } else if (o.until) {
    endMode = "on";
    untilDate = fromFloating(o.until, zone).toFormat("yyyy-MM-dd");
  }

  return { freq, interval: o.interval ?? 1, byday, endMode, untilDate, count };
}

/** "Every 2 weeks on Mon, Wed, until 30 Nov 2026" */
export function describeRecurrence(r: RecurrenceInput, zone: string): string {
  const [one, many] = FREQUENCY_LABEL[r.freq];
  const every = r.interval > 1 ? `Every ${r.interval} ${many}` : `Every ${one}`;

  const days =
    r.freq === "weekly" && r.byday.length > 0
      ? ` on ${r.byday.map((d) => WEEKDAYS.find((w) => w.key === d)!.full.slice(0, 3)).join(", ")}`
      : "";

  const end =
    r.endMode === "after"
      ? `, ${r.count} time${r.count === 1 ? "" : "s"}`
      : r.endMode === "on" && r.untilDate
        ? `, until ${DateTime.fromISO(r.untilDate, { zone }).toFormat("d LLL yyyy")}`
        : "";

  return every + days + end;
}
