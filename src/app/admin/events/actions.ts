"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { eventFormSchema, REPEAT_PRESET, isRuleBased } from "@/lib/event-schema";
import { buildRecurrence, type RecurrenceInput } from "@/lib/recurrence";
import { toUtcIso } from "@/lib/datetime";

export type SaveState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * What was submitted, handed back so the form can restore it.
   *
   * React resets an uncontrolled form once its action completes, so without
   * this a rejected submission wipes everything the person typed - which is
   * far worse than the validation error itself.
   */
  values?: Record<string, string | string[]>;
};

const submitted = (formData: FormData): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key === "custom_byday" || key === "rdates") {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (typeof existing === "string") {
        result[key] = [existing, value];
      } else {
        result[key] = [value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

const str = (fd: FormData, k: string) => (fd.get(k) as string | null) ?? "";

export async function saveEvent(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = eventFormSchema.safeParse({
    ...raw,
    all_day: formData.get("all_day") === "on",
    id: str(formData, "id") || undefined,
    // Object.fromEntries keeps only the last value of a repeated field, which
    // would reduce a week of chosen days to a single one.
    custom_byday: formData.getAll("custom_byday"),
    rdates: formData.getAll("rdates"),
    repeat_count: str(formData, "repeat_count") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return {
      error: "Please fix the highlighted fields — nothing has been lost.",
      fieldErrors,
      values: submitted(formData),
    };
  }

  const v = parsed.data;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again.", values: submitted(formData) };

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
    return { error: "That date or time could not be understood.", values: submitted(formData) };
  }

  if (new Date(ends_at) < new Date(starts_at)) {
    return {
      error: "The event ends before it starts.",
      fieldErrors: { end_date: "Must be after the start" },
      values: submitted(formData),
    };
  }

  // Presets and "custom" are the same rule shape; only where the numbers come
  // from differs.
  let recurrence: { rrule: string; recurrenceUntil: string } | null = null;
  let rdates: string[] | null = null;

  if (v.repeat === "dates") {
    // No rule at all - just the listed days. recurrence_until still has to be
    // set, because the calendar query and the notification runner use it to
    // decide whether a series is still live.
    rdates = [...new Set(v.rdates)].sort();
    const last = rdates[rdates.length - 1];
    recurrence = {
      rrule: "",
      recurrenceUntil: toUtcIso(last, "23:59", v.start_tz, false),
    };
  } else if (isRuleBased(v.repeat)) {
    const shape =
      v.repeat === "custom"
        ? { freq: v.custom_freq, interval: v.custom_interval, byday: v.custom_byday }
        : REPEAT_PRESET[v.repeat];

    const input: RecurrenceInput = {
      ...shape,
      endMode: v.end_mode,
      untilDate: v.end_mode === "on" ? v.repeat_until : undefined,
      count: v.end_mode === "after" ? v.repeat_count : undefined,
    };
    recurrence = buildRecurrence(input, starts_at, v.start_tz);
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
    rrule: recurrence?.rrule || null,
    recurrence_until: recurrence?.recurrenceUntil ?? null,
    rdates,
    updated_by: user.id,
  };

  let eventId = v.id;

  if (eventId) {
    const { error } = await supabase.from("events").update(row).eq("id", eventId);
    if (error) return { error: humanise(error.message), values: submitted(formData) };
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...row, created_by: user.id })
      .select("id")
      .single();
    if (error) return { error: humanise(error.message), values: submitted(formData) };
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
    if (error) return { error: humanise(error.message), values: submitted(formData) };
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
