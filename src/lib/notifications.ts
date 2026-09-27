import { DateTime } from "luxon";
import type { EventRow, EventType } from "./types";
import { EVENT_TYPE_LABEL } from "./types";
import { expandAll, type Occurrence } from "./occurrences";
import { formatRange } from "./datetime";

/** The rungs offered in the settings UI, longest lead time first. */
export const LADDER: { minutes: number; label: string }[] = [
  { minutes: 20160, label: "2 weeks" },
  { minutes: 10080, label: "1 week" },
  { minutes: 5760, label: "4 days" },
  { minutes: 2880, label: "2 days" },
  { minutes: 1440, label: "1 day" },
  { minutes: 360, label: "6 hours" },
  { minutes: 60, label: "1 hour" },
];

export type Rule = { event_type: EventType; offsets_minutes: number[]; enabled: boolean };

export type DueReminder = {
  occurrence: Occurrence;
  offsetMinutes: number;
  dueAt: string;
};

/**
 * How late a reminder may be and still go out. Without this, a deploy after a
 * day of downtime would fire every missed reminder at once - including ones for
 * events that have already happened.
 */
export const GRACE_MINUTES = 90;

/** The longest offset we support, which sets how far ahead we must look. */
export const MAX_OFFSET_MINUTES = 20160; // 14 days

export function findDue(
  events: EventRow[],
  rules: Rule[],
  now: Date,
): DueReminder[] {
  const byType = new Map(rules.filter((r) => r.enabled).map((r) => [r.event_type, r]));

  const notifiable = events.filter(
    (e) =>
      e.status !== "draft" &&
      e.status !== "cancelled" &&
      e.visibility !== "private" &&
      byType.has(e.event_type),
  );

  const from = new Date(now.getTime() - GRACE_MINUTES * 60_000);
  const to = new Date(now.getTime() + (MAX_OFFSET_MINUTES + 60) * 60_000);

  const due: DueReminder[] = [];

  for (const occ of expandAll(notifiable, from, to)) {
    const rule = byType.get(occ.event.event_type)!;
    const startMs = new Date(occ.startsAt).getTime();

    for (const offset of rule.offsets_minutes) {
      const dueMs = startMs - offset * 60_000;
      // Due now, but not so long ago that sending it would be noise.
      if (dueMs <= now.getTime() && dueMs > now.getTime() - GRACE_MINUTES * 60_000) {
        due.push({ occurrence: occ, offsetMinutes: offset, dueAt: new Date(dueMs).toISOString() });
      }
    }
  }

  return due;
}

/** "in 2 days", "in 6 hours", "in 1 hour" - the lead time, said plainly. */
export function leadTimeLabel(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return days === 1 ? "tomorrow" : days === 7 ? "in a week" : days === 14 ? "in two weeks" : `in ${days} days`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
  }
  return `in ${minutes} minutes`;
}

export function buildMessage(r: DueReminder) {
  const e = r.occurrence.event;
  const when = formatRange(
    r.occurrence.startsAt, e.start_tz,
    r.occurrence.endsAt, e.end_tz,
    e.all_day,
  );

  return {
    title: `${EVENT_TYPE_LABEL[e.event_type]} ${leadTimeLabel(r.offsetMinutes)}`,
    body: `${e.title}\n${when}${e.location_text ? `\n${e.location_text}` : ""}`,
    url: `/admin/events/${e.id}`,
    tag: `${e.id}-${r.occurrence.startsAt}`,
  };
}

/** Events whose series could still produce an occurrence inside the window. */
export function windowFilter(now: Date) {
  const from = DateTime.fromJSDate(now).minus({ minutes: GRACE_MINUTES }).toISO()!;
  const to = DateTime.fromJSDate(now).plus({ minutes: MAX_OFFSET_MINUTES + 60 }).toISO()!;
  return { from, to };
}
