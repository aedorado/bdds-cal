import { cookies } from "next/headers";
import Link from "next/link";
import { DateTime } from "luxon";
import { createClient } from "@/utils/supabase/server";
import { getProfile, canEdit } from "@/utils/supabase/auth";
import { AdminCalendar } from "./calendar-client";
import { ConflictPanel } from "./conflict-panel";
import { detectIssues } from "@/lib/conflicts";
import type { EventRow, FlightDetails, Location } from "@/lib/types";
import type { FestivalRow } from "@/components/calendar-view";

export default async function AdminHome() {
  const profile = await getProfile();
  const supabase = createClient(await cookies());

  // A window either side of today: enough to see the tour taking shape without
  // dragging the whole history into the browser.
  const from = DateTime.now().minus({ months: 2 }).toISO();
  const to = DateTime.now().plus({ months: 10 }).toISO();

  const [{ data: events }, { data: locations }, { data: flights }, { data: festivals }] =
    await Promise.all([
      supabase.from("events").select("*")
        .gte("starts_at", from).lte("starts_at", to).order("starts_at"),
      supabase.from("locations").select("*").order("name"),
      supabase.from("flight_details").select("*"),
      // Only Ekadasi, only for the conflict check - the calendar itself loads
      // observances in the browser for whichever place is selected.
      supabase.from("festivals").select("id, date, name, festival_type, location_id")
        .eq("festival_type", "ekadasi")
        .gte("date", from.slice(0, 10)).lte("date", to.slice(0, 10))
        .limit(2000),
    ]);

  const rows = (events ?? []) as EventRow[];
  const locs = (locations ?? []) as Location[];
  const flightMap = Object.fromEntries(
    ((flights ?? []) as FlightDetails[]).map((f) => [f.event_id, f]),
  );
  const fests = (festivals ?? []) as FestivalRow[];
  const issues = detectIssues(rows, locs, fests);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Calendar</h1>
          <p className="text-sm text-stone-600">
            {rows.length} event{rows.length === 1 ? "" : "s"} in view · signed in as {profile?.email}
          </p>
        </div>
        {canEdit(profile) && (
          <Link href="/admin/events/new"
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
            Add event
          </Link>
        )}
      </div>

      {issues.length > 0 && <ConflictPanel issues={issues} />}

      <AdminCalendar events={rows} locations={locs} flights={flightMap} />
    </>
  );
}
