"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { eventFormSchema, RRULE_FOR } from "@/lib/event-schema";
import { toUtcIso } from "@/lib/datetime";

export type SaveState = { error?: string; fieldErrors?: Record<string, string> };

const str = (fd: FormData, k: string) => (fd.get(k) as string | null) ?? "";

export async function saveEvent(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = eventFormSchema.safeParse({
    ...raw,
    all_day: formData.get("all_day") === "on",
    id: str(formData, "id") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const v = parsed.data;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  // A flight is the only type whose two ends sit in different zones. For
  // everything else the end zone follows the start, so the form need not ask.
  const endTz = v.event_type === "flight" ? v.end_tz : v.start_tz;

  let starts_at: string;
  let ends_at: string;
  try {
    starts_at = toUtcIso(v.start_date, v.start_time, v.start_tz, v.all_day);
    ends_at = v.all_day
      ? toUtcIso(v.end_date, "23:59", endTz, false)
      : toUtcIso(v.end_date, v.end_time, endTz, false);
  } catch {
    return { error: "That date or time could not be understood." };
  }

  if (new Date(ends_at) < new Date(starts_at)) {
    return { error: "The event ends before it starts.", fieldErrors: { end_date: "Must be after the start" } };
  }

  const row = {
    title: v.title,
    description: v.description,
    event_type: v.event_type,
    starts_at,
    start_tz: v.start_tz,
    ends_at,
    end_tz: endTz,
    all_day: v.all_day,
    location_id: v.location_id,
    location_text: v.location_text,
    visibility: v.visibility,
    status: v.status,
    cancellation_reason: v.status === "cancelled" ? v.cancellation_reason : null,
    stream_url: v.stream_url,
    stream_platform: v.stream_platform,
    internal_notes: v.internal_notes,
    rrule: v.repeat === "none" ? null : RRULE_FOR[v.repeat],
    recurrence_until:
      v.repeat === "none" ? null : toUtcIso(v.repeat_until, "23:59", v.start_tz, false),
    updated_by: user.id,
  };

  let eventId = v.id;

  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) return { error: humanise(error.message) };
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...row, created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: humanise(error.message) };
    eventId = data.id as string;
  }

  if (v.event_type === "flight") {
    const { error } = await supabase.from("flight_details").upsert({
      event_id: eventId,
      airline: v.airline,
      flight_number: v.flight_number,
      departure_airport: v.departure_airport,
      arrival_airport: v.arrival_airport,
      departure_terminal: v.departure_terminal,
      arrival_terminal: v.arrival_terminal,
      seat: v.seat,
      booking_ref: v.booking_ref,
    });
    if (error) return { error: humanise(error.message) };
  } else {
    await supabase.from("flight_details").delete().eq("event_id", eventId);
  }

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

export async function deleteEvent(formData: FormData) {
  const id = str(formData, "id");
  if (!id) return;

  const supabase = createClient(await cookies());
  await supabase.from("events").delete().eq("id", id);

  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

// Postgres errors are precise but unreadable. The two that users actually hit
// are the RLS refusal and the cancellation-reason check constraint.
function humanise(message: string): string {
  if (/row-level security/i.test(message))
    return "Your account does not have permission to change events.";
  if (/events_cancelled_has_reason/i.test(message))
    return "A cancelled event needs a reason.";
  if (/events_end_after_start/i.test(message))
    return "The event ends before it starts.";
  return message;
}
