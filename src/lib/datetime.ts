import { DateTime } from "luxon";

/**
 * The whole app follows one rule: the database stores an absolute instant
 * (timestamptz, i.e. UTC) plus the IANA zone the event actually happens in.
 * Rendering always names which zone you are looking at, because "3 PM" with no
 * zone is what causes someone to miss a programme.
 */

/** Wall-clock form fields ("2026-10-02", "18:30") in a zone -> UTC ISO string. */
export function toUtcIso(date: string, time: string, zone: string, allDay: boolean): string {
  const iso = allDay ? `${date}T00:00:00` : `${date}T${time || "00:00"}:00`;
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) throw new Error(`Invalid date/time: ${iso} in ${zone}`);
  return dt.toUTC().toISO()!;
}

/** UTC ISO string -> wall-clock form fields in a zone. */
export function toFormFields(utcIso: string, zone: string) {
  const dt = DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone);
  return { date: dt.toFormat("yyyy-MM-dd"), time: dt.toFormat("HH:mm") };
}

export const fmtTime = (utcIso: string, zone: string) =>
  DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toFormat("HH:mm");

export const fmtDate = (utcIso: string, zone: string) =>
  DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toFormat("EEE d LLL yyyy");

export const fmtDateTime = (utcIso: string, zone: string) =>
  DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toFormat("EEE d LLL, HH:mm");

/** "IST", "WAT" - the short zone name, for labelling a time unambiguously. */
export const zoneAbbr = (utcIso: string, zone: string) =>
  DateTime.fromISO(utcIso, { zone: "utc" }).setZone(zone).toFormat("ZZZZ");

export const viewerZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/**
 * A human range. Handles the three shapes that matter:
 *   - same day, one zone      -> "Fri 2 Oct, 18:30 - 20:00 IST"
 *   - crosses midnight/days   -> "Fri 2 Oct 18:30 - Sun 4 Oct 20:00 IST"
 *   - zones differ (a flight) -> "Fri 2 Oct 23:05 IST - Sat 3 Oct 05:40 WAT"
 */
export function formatRange(
  startUtc: string,
  startZone: string,
  endUtc: string,
  endZone: string,
  allDay: boolean,
): string {
  const s = DateTime.fromISO(startUtc, { zone: "utc" }).setZone(startZone);
  const e = DateTime.fromISO(endUtc, { zone: "utc" }).setZone(endZone);

  if (allDay) {
    return s.hasSame(e, "day")
      ? s.toFormat("EEE d LLL yyyy")
      : `${s.toFormat("EEE d LLL")} - ${e.toFormat("EEE d LLL yyyy")}`;
  }

  if (startZone !== endZone) {
    return `${s.toFormat("EEE d LLL, HH:mm")} ${s.toFormat("ZZZZ")} - ${e.toFormat("EEE d LLL, HH:mm")} ${e.toFormat("ZZZZ")}`;
  }

  return s.hasSame(e, "day")
    ? `${s.toFormat("EEE d LLL yyyy, HH:mm")} - ${e.toFormat("HH:mm")} ${e.toFormat("ZZZZ")}`
    : `${s.toFormat("EEE d LLL, HH:mm")} - ${e.toFormat("EEE d LLL, HH:mm")} ${e.toFormat("ZZZZ")}`;
}

/** Flight duration etc. "6h 35m". */
export function durationLabel(startUtc: string, endUtc: string): string {
  const mins = DateTime.fromISO(endUtc, { zone: "utc" })
    .diff(DateTime.fromISO(startUtc, { zone: "utc" }), "minutes").minutes;
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** IANA zones offered in the picker. Kept short and relevant on purpose. */
export const COMMON_ZONES = [
  "Asia/Kolkata", "Africa/Lagos", "Europe/London", "Europe/Moscow",
  "America/New_York", "America/Los_Angeles", "America/Sao_Paulo",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "Pacific/Auckland", "UTC",
];
