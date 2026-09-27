"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveEvent, deleteEvent, type SaveState } from "./actions";
import { COMMON_ZONES } from "@/lib/datetime";
import {
  EVENT_TYPES, EVENT_TYPE_LABEL, STATUSES, VISIBILITIES,
  type EventType, type Location,
} from "@/lib/types";
import { REPEATS, REPEAT_LABEL, type Repeat } from "@/lib/event-schema";

const VISIBILITY_HELP: Record<string, string> = {
  public: "Shown on the public calendar to everyone.",
  internal: "Only signed-in team members. Use for flights and logistics.",
  private: "Personal entries — rest, health, family.",
};

const label = "block text-sm font-medium text-stone-700";
const input =
  "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 " +
  "focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";
const card = "rounded-xl border border-stone-200 bg-white p-5";

export type FormDefaults = Record<string, string | boolean | null | undefined>;

export function EventForm({
  locations,
  defaults,
  isNew,
}: {
  locations: Location[];
  defaults: FormDefaults;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveEvent, {});

  const [type, setType] = useState<EventType>((defaults.event_type as EventType) ?? "class");
  const [allDay, setAllDay] = useState<boolean>(Boolean(defaults.all_day));
  const [status, setStatus] = useState<string>((defaults.status as string) ?? "confirmed");
  const [repeat, setRepeat] = useState<Repeat>((defaults.repeat as Repeat) ?? "none");
  const [startTz, setStartTz] = useState<string>((defaults.start_tz as string) ?? "Asia/Kolkata");

  const isFlight = type === "flight";
  const err = (f: string) => state.fieldErrors?.[f];

  // Picking a location fills the timezone, because that is nearly always what
  // you meant. It stays editable for the odd case where it is not.
  function onLocationChange(id: string) {
    const loc = locations.find((l) => l.id === id);
    if (loc) setStartTz(loc.tz);
  }

  const zones = Array.from(new Set([startTz, ...COMMON_ZONES]));

  return (
    <form action={formAction} className="space-y-5 pb-16">
      {defaults.id && <input type="hidden" name="id" value={String(defaults.id)} />}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      {/* ---------------------------------------------------------- what */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-stone-900">What</h2>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={label} htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={String(defaults.title ?? "")}
              placeholder="Srimad Bhagavatam class" className={input} />
            {err("title") && <p className="mt-1 text-xs text-red-600">{err("title")}</p>}
          </div>

          <div>
            <label className={label} htmlFor="event_type">Type</label>
            <select id="event_type" name="event_type" value={type} className={input}
              onChange={(e) => setType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={label} htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3}
            defaultValue={String(defaults.description ?? "")}
            placeholder="Shown publicly if the event is public."
            className={input} />
        </div>
      </section>

      {/* ---------------------------------------------------------- when */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-stone-900">When</h2>

        <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="all_day" checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300" />
          All day / multi-day (retreats, tours)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="start_date">Starts</label>
            <div className="flex gap-2">
              <input id="start_date" name="start_date" type="date"
                defaultValue={String(defaults.start_date ?? "")} className={input} />
              <input name="start_time" type="time" disabled={allDay}
                defaultValue={String(defaults.start_time ?? "")}
                className={`${input} disabled:bg-stone-100 disabled:text-stone-400`} />
            </div>
            {err("start_date") && <p className="mt-1 text-xs text-red-600">{err("start_date")}</p>}
          </div>

          <div>
            <label className={label} htmlFor="end_date">Ends</label>
            <div className="flex gap-2">
              <input id="end_date" name="end_date" type="date"
                defaultValue={String(defaults.end_date ?? "")} className={input} />
              <input name="end_time" type="time" disabled={allDay}
                defaultValue={String(defaults.end_time ?? "")}
                className={`${input} disabled:bg-stone-100 disabled:text-stone-400`} />
            </div>
            {err("end_date") && <p className="mt-1 text-xs text-red-600">{err("end_date")}</p>}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="start_tz">
              {isFlight ? "Departure timezone" : "Timezone"}
            </label>
            <select id="start_tz" name="start_tz" value={startTz} className={input}
              onChange={(e) => setStartTz(e.target.value)}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          {/* Only a flight lands in a different zone from the one it left. */}
          <div className={isFlight ? "" : "hidden"}>
            <label className={label} htmlFor="end_tz">Arrival timezone</label>
            <select id="end_tz" name="end_tz"
              defaultValue={String(defaults.end_tz ?? "Africa/Lagos")} className={input}>
              {Array.from(new Set([String(defaults.end_tz ?? ""), ...COMMON_ZONES]))
                .filter(Boolean)
                .map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          {!isFlight && <input type="hidden" name="end_tz" value={startTz} />}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="repeat">Repeats</label>
            <select id="repeat" name="repeat" value={repeat} className={input}
              onChange={(e) => setRepeat(e.target.value as Repeat)}>
              {REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
            </select>
          </div>
          {repeat !== "none" && (
            <div>
              <label className={label} htmlFor="repeat_until">Repeat until</label>
              <input id="repeat_until" name="repeat_until" type="date"
                defaultValue={String(defaults.repeat_until ?? "")} className={input} />
              {err("repeat_until") && (
                <p className="mt-1 text-xs text-red-600">{err("repeat_until")}</p>
              )}
            </div>
          )}
          {repeat === "none" && <input type="hidden" name="repeat_until" value="" />}
        </div>
      </section>

      {/* --------------------------------------------------------- where */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Where</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="location_id">Location</label>
            <select id="location_id" name="location_id"
              defaultValue={String(defaults.location_id ?? "")} className={input}
              onChange={(e) => onLocationChange(e.target.value)}>
              <option value="">— none —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.country ? `, ${l.country}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="location_text">Venue / detail</label>
            <input id="location_text" name="location_text"
              defaultValue={String(defaults.location_text ?? "")}
              placeholder="Rupa Sanatana Gaudiya Matha" className={input} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- flight */}
      {isFlight && (
        <section className={card}>
          <h2 className="text-sm font-semibold text-stone-900">Flight details</h2>
          <p className="mb-4 mt-1 text-xs text-stone-500">
            Never shown publicly, whatever the visibility below is set to.
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["airline", "Airline", "Air India"],
              ["flight_number", "Flight no.", "AI 130"],
              ["departure_airport", "From", "DEL"],
              ["arrival_airport", "To", "LOS"],
              ["departure_terminal", "Dep. terminal", "T3"],
              ["arrival_terminal", "Arr. terminal", "I"],
              ["seat", "Seat", "12A"],
              ["booking_ref", "Booking ref", ""],
            ].map(([name, text, ph]) => (
              <div key={name}>
                <label className={label} htmlFor={name}>{text}</label>
                <input id={name} name={name} placeholder={ph}
                  defaultValue={String(defaults[name] ?? "")} className={input} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- sharing */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-stone-900">Sharing &amp; status</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="visibility">Visibility</label>
            <select id="visibility" name="visibility"
              defaultValue={String(defaults.visibility ?? "internal")} className={input}>
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              {VISIBILITY_HELP[String(defaults.visibility ?? "internal")]}
            </p>
          </div>

          <div>
            <label className={label} htmlFor="status">Status</label>
            <select id="status" name="status" value={status} className={input}
              onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {status === "cancelled" && (
          <div className="mt-4">
            <label className={label} htmlFor="cancellation_reason">Reason for cancelling</label>
            <input id="cancellation_reason" name="cancellation_reason"
              defaultValue={String(defaults.cancellation_reason ?? "")}
              placeholder="Shown publicly so nobody travels to a cancelled programme"
              className={input} />
            {err("cancellation_reason") && (
              <p className="mt-1 text-xs text-red-600">{err("cancellation_reason")}</p>
            )}
          </div>
        )}
        {status !== "cancelled" && <input type="hidden" name="cancellation_reason" value="" />}

        <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className={label} htmlFor="stream_url">Live stream / join link</label>
            <input id="stream_url" name="stream_url" type="url"
              defaultValue={String(defaults.stream_url ?? "")}
              placeholder="https://example.com/live" className={input} />
            {err("stream_url") && <p className="mt-1 text-xs text-red-600">{err("stream_url")}</p>}
          </div>
          <div>
            <label className={label} htmlFor="stream_platform">Platform</label>
            <input id="stream_platform" name="stream_platform"
              defaultValue={String(defaults.stream_platform ?? "")}
              placeholder="YouTube / Zoom" className={input} />
          </div>
        </div>

        <div className="mt-4">
          <label className={label} htmlFor="internal_notes">Internal notes</label>
          <textarea id="internal_notes" name="internal_notes" rows={3}
            defaultValue={String(defaults.internal_notes ?? "")}
            placeholder="Team only. Never leaves the admin area."
            className={input} />
        </div>
      </section>

      {/* -------------------------------------------------------- actions */}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending}
          className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60">
          {pending ? "Saving…" : isNew ? "Create event" : "Save changes"}
        </button>
        <Link href="/admin" className="text-sm text-stone-600 hover:text-stone-900">Cancel</Link>

        {!isNew && (
          <button formAction={deleteEvent} formNoValidate
            className="ml-auto text-sm text-red-600 hover:text-red-800">
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
