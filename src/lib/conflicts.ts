import { DateTime } from "luxon";
import type { EventRow, Location } from "./types";
import type { FestivalRow } from "@/components/calendar-view";

export type Issue = {
  id: string;
  severity: "warn" | "info";
  title: string;
  detail: string;
};

/** Hours that must separate a landing from the next commitment. */
export const MIN_HOURS_AFTER_LANDING = 3;

const ms = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).toMillis();
const day = (iso: string, zone: string) =>
  DateTime.fromISO(iso, { zone: "utc" }).setZone(zone).toFormat("yyyy-MM-dd");

/**
 * Advisory only — these are surfaced, never enforced. Sometimes the schedule
 * really is that tight and the team already knows.
 *
 * Recurring events are skipped: judging their occurrences means expanding the
 * rule first, and a wrong warning is worse than a missing one.
 */
export function detectIssues(
  events: EventRow[],
  locations: Location[],
  festivals: FestivalRow[],
): Issue[] {
  const issues: Issue[] = [];
  const locName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? null;

  const live = events
    .filter((e) => e.status !== "cancelled" && e.status !== "draft" && !e.rrule)
    .sort((a, b) => ms(a.starts_at) - ms(b.starts_at));

  // 1. Two things booked at once.
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (ms(b.starts_at) >= ms(a.ends_at)) break; // sorted, so nothing later overlaps either
      if (a.all_day || b.all_day) continue;        // a retreat containing its own classes is fine
      issues.push({
        id: `overlap-${a.id}-${b.id}`,
        severity: "warn",
        title: "Two events overlap",
        detail: `"${a.title}" and "${b.title}" are booked at the same time on ${day(a.starts_at, a.start_tz)}.`,
      });
    }
  }

  // 2. Something scheduled too soon after a flight lands.
  for (const flight of live.filter((e) => e.event_type === "flight")) {
    for (const next of live) {
      if (next.id === flight.id || next.all_day) continue;
      const gapHours = (ms(next.starts_at) - ms(flight.ends_at)) / 3_600_000;
      if (gapHours >= 0 && gapHours < MIN_HOURS_AFTER_LANDING) {
        issues.push({
          id: `turnaround-${flight.id}-${next.id}`,
          severity: "warn",
          title: "Tight turnaround after landing",
          detail: `"${next.title}" starts ${gapHours < 1
            ? `${Math.round(gapHours * 60)} minutes`
            : `${gapHours.toFixed(1)} hours`} after "${flight.title}" lands.`,
        });
      }
    }
  }

  // 3. A change of city with nothing in between that gets him there.
  for (let i = 1; i < live.length; i++) {
    const prev = live[i - 1];
    const curr = live[i];
    if (!prev.location_id || !curr.location_id) continue;
    if (prev.location_id === curr.location_id) continue;
    if (curr.event_type === "flight" || curr.event_type === "travel") continue;
    if (prev.event_type === "flight" || prev.event_type === "travel") continue;

    issues.push({
      id: `travel-gap-${prev.id}-${curr.id}`,
      severity: "warn",
      title: "City changes with no travel booked",
      detail: `"${prev.title}" is in ${locName(prev.location_id)} and "${curr.title}" is in ${locName(curr.location_id)}, with no flight or travel event between them.`,
    });
  }

  // 4. A public programme landing on a fasting day.
  //
  // Matched per location: Ekadasi is computed for an observer's position and
  // genuinely falls on different civil dates in Vrindavan and Lagos, so a
  // single global set of dates would flag the wrong days for half the tour.
  const ekadasiByLocation = new Map<string, Set<string>>();
  for (const f of festivals) {
    if (f.festival_type !== "ekadasi" || !f.location_id) continue;
    const set = ekadasiByLocation.get(f.location_id) ?? new Set<string>();
    set.add(f.date);
    ekadasiByLocation.set(f.location_id, set);
  }

  for (const e of live) {
    if (e.visibility !== "public") continue;
    if (!["class", "festival", "darshan"].includes(e.event_type)) continue;
    if (!e.location_id) continue;
    const d = day(e.starts_at, e.start_tz);
    if (ekadasiByLocation.get(e.location_id)?.has(d)) {
      issues.push({
        id: `ekadasi-${e.id}`,
        severity: "info",
        title: "Programme falls on Ekadasi",
        detail: `"${e.title}" is scheduled on ${d}, an Ekadasi in ${locName(e.location_id)}. Worth checking the timing against the fast.`,
      });
    }
  }

  return issues;
}
