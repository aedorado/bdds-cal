import { RRule, rrulestr } from "rrule";
import { DateTime } from "luxon";
import type { EventRow } from "./types";

export type Occurrence = {
  event: EventRow;
  /** Absolute start of this specific instance, as a UTC ISO string. */
  startsAt: string;
  endsAt: string;
};

/**
 * Expand an event into the concrete instances that begin inside [from, to].
 *
 * A one-off event yields at most itself. A recurring one is expanded through
 * its rule. Timezone handling is the fiddly part: the stored rule means "06:30
 * local time in start_tz", so expansion happens on floating local times and
 * each result is converted back to UTC afterwards. Doing it in UTC instead
 * would silently shift the class by an hour across a DST boundary.
 */
export function expandEvent(event: EventRow, from: Date, to: Date): Occurrence[] {
  const durationMs =
    new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();

  if (!event.rrule) {
    const startsAt = new Date(event.starts_at);
    if (startsAt < from || startsAt > to) return [];
    return [{ event, startsAt: event.starts_at, endsAt: event.ends_at }];
  }

  const zone = event.start_tz;
  const localStart = DateTime.fromISO(event.starts_at, { zone: "utc" }).setZone(zone);

  // rrule works in UTC-naive Dates; feed it the wall-clock time as if it were
  // UTC, then reverse the substitution on the way out.
  const asFloating = (dt: DateTime) =>
    new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, 0));

  const until = event.recurrence_until
    ? asFloating(DateTime.fromISO(event.recurrence_until, { zone: "utc" }).setZone(zone))
    : asFloating(DateTime.fromJSDate(to).setZone(zone));

  let rule: RRule;
  try {
    rule = rrulestr(`DTSTART:${asFloating(localStart).toISOString().replace(/[-:]|\.\d{3}/g, "")}\nRRULE:${event.rrule}`) as RRule;
  } catch {
    return [];
  }

  const windowStart = asFloating(DateTime.fromJSDate(from).setZone(zone));
  const windowEnd = asFloating(DateTime.fromJSDate(to).setZone(zone));
  const cap = until < windowEnd ? until : windowEnd;

  return rule.between(windowStart, cap, true).map((floating) => {
    const real = DateTime.fromObject(
      {
        year: floating.getUTCFullYear(),
        month: floating.getUTCMonth() + 1,
        day: floating.getUTCDate(),
        hour: floating.getUTCHours(),
        minute: floating.getUTCMinutes(),
      },
      { zone },
    );
    const startsAt = real.toUTC().toISO()!;
    return {
      event,
      startsAt,
      endsAt: real.toUTC().plus({ milliseconds: durationMs }).toISO()!,
    };
  });
}

export function expandAll(events: EventRow[], from: Date, to: Date): Occurrence[] {
  return events
    .flatMap((e) => expandEvent(e, from, to))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}
