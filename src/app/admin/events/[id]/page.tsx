import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getProfile, canEdit } from "@/utils/supabase/auth";
import { EventForm } from "../event-form";
import { toFormFields } from "@/lib/datetime";
import { RRULE_FOR, type Repeat } from "@/lib/event-schema";
import type { EventRow, FlightDetails, Location } from "@/lib/types";

const repeatFromRrule = (rrule: string | null): Repeat => {
  if (!rrule) return "none";
  const hit = (Object.keys(RRULE_FOR) as Exclude<Repeat, "none">[])
    .find((k) => RRULE_FOR[k] === rrule);
  return hit ?? "weekly";
};

export default async function EditEventPage({ params }: PageProps<"/admin/events/[id]">) {
  const { id } = await params;
  const profile = await getProfile();
  if (!canEdit(profile)) {
    return <p className="text-sm text-stone-600">You do not have permission to edit events.</p>;
  }

  const supabase = createClient(await cookies());
  const [{ data: event }, { data: locations }, { data: flight }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase.from("locations").select("*").order("name"),
    supabase.from("flight_details").select("*").eq("event_id", id).maybeSingle(),
  ]);

  // A reminder outlives its event: push notifications are already on people's
  // phones when an event is deleted or rescheduled, and tapping one must not
  // dump them on a bare 404 with no idea what happened.
  if (!event) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold text-stone-900">This event is no longer here</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-600">
          It was deleted after the reminder was sent. If you were expecting a
          programme, check the calendar - it may have been rescheduled rather
          than cancelled.
        </p>
        <Link href="/admin"
          className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
          Back to the calendar
        </Link>
      </div>
    );
  }

  const e = event as EventRow;
  const f = (flight ?? {}) as Partial<FlightDetails>;
  const start = toFormFields(e.starts_at, e.start_tz);
  const end = toFormFields(e.ends_at, e.end_tz);

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold text-stone-900">Edit event</h1>
      <EventForm
        isNew={false}
        locations={(locations ?? []) as Location[]}
        defaults={{
          id: e.id,
          title: e.title,
          description: e.description,
          event_type: e.event_type,
          all_day: e.all_day,
          start_date: start.date, start_time: start.time, start_tz: e.start_tz,
          end_date: end.date, end_time: end.time, end_tz: e.end_tz,
          location_id: e.location_id, location_text: e.location_text,
          visibility: e.visibility, status: e.status,
          cancellation_reason: e.cancellation_reason,
          stream_url: e.stream_url, stream_platform: e.stream_platform,
          internal_notes: e.internal_notes,
          repeat: repeatFromRrule(e.rrule),
          repeat_until: e.recurrence_until
            ? toFormFields(e.recurrence_until, e.start_tz).date
            : "",
          airline: f.airline, flight_number: f.flight_number,
          departure_airport: f.departure_airport, arrival_airport: f.arrival_airport,
          departure_terminal: f.departure_terminal, arrival_terminal: f.arrival_terminal,
          seat: f.seat, booking_ref: f.booking_ref,
        }}
      />
    </>
  );
}
