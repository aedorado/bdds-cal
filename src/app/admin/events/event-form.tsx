"use client";

import { useActionState, useState } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { saveEvent, deleteEvent, type SaveState } from "./actions";
import { COMMON_ZONES } from "@/lib/datetime";
import {
  EVENT_TYPES, EVENT_TYPE_LABEL, STATUSES, VISIBILITIES,
  type EventType, type Location,
} from "@/lib/types";
import { REPEATS, REPEAT_LABEL, isRuleBased, type Repeat } from "@/lib/event-schema";
import {
  FREQUENCIES, FREQUENCY_LABEL, WEEKDAYS,
  describeRecurrence, type EndMode, type Frequency_, type WeekdayKey,
} from "@/lib/recurrence";

const VISIBILITY_HELP: Record<string, string> = {
  public: "Shown on the public calendar to everyone.",
  internal: "Only signed-in team members. Use for flights and logistics.",
  private: "Personal entries — rest, health, family.",
};

const label = "block text-sm font-medium text-stone-700";
// Width is deliberately NOT in the base. Tailwind resolves competing utilities
// by their order in the generated stylesheet, not by order in the class
// string, so a base carrying w-full made every `w-20` override a coin toss -
// which is why the "Ends" inputs sat full-width on their own lines.
const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 " +
  "focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500";
const input = `mt-1 w-full ${field}`;
const card = "rounded-xl border border-stone-200 bg-white p-5";

export type FormDefaults = Record<string, string | string[] | boolean | null | undefined>;

export function EventForm({
  locations,
  defaults: initialDefaults,
  isNew,
}: {
  locations: Location[];
  defaults: FormDefaults;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveEvent, {});

  // React clears an uncontrolled form once the action finishes, so a rejected
  // submission would otherwise wipe everything typed. The action hands the
  // values back and they become the defaults for the re-render.
  const defaults: FormDefaults = { ...initialDefaults, ...(state.values ?? {}) };

  const [type, setType] = useState<EventType>((defaults.event_type as EventType) ?? "class");
  const [allDay, setAllDay] = useState<boolean>(Boolean(defaults.all_day));
  const [status, setStatus] = useState<string>((defaults.status as string) ?? "confirmed");
  const [repeat, setRepeat] = useState<Repeat>((defaults.repeat as Repeat) ?? "none");
  const [startTz, setStartTz] = useState<string>((defaults.start_tz as string) ?? "Asia/Kolkata");
  const [freq, setFreq] = useState<Frequency_>((defaults.custom_freq as Frequency_) ?? "weekly");
  const [interval, setInterval] = useState<string>(String(defaults.custom_interval ?? 1));
  const [byday, setByday] = useState<WeekdayKey[]>(
    (defaults.custom_byday as WeekdayKey[] | undefined) ?? [],
  );
  const [endMode, setEndMode] = useState<EndMode>((defaults.end_mode as EndMode) ?? "on");
  const [rdates, setRdates] = useState<string[]>(
    (defaults.rdates as string[] | undefined) ?? [],
  );
  const [nextDate, setNextDate] = useState("");

  function addDate() {
    const d = nextDate.trim();
    // The start date is already the first occurrence; listing it again would
    // show a duplicate chip for a date that only happens once.
    if (!d || d === defaults.start_date || rdates.includes(d)) return;
    setRdates([...rdates, d].sort());
    setNextDate("");
  }

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
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <p className="text-xs text-stone-500">
        Only <span className="font-medium text-stone-700">Title</span> and the{" "}
        <span className="font-medium text-stone-700">dates</span> are required
        (marked <span className="text-red-500">*</span>). Everything else can be
        left blank and filled in later.
      </p>

      {/* ---------------------------------------------------------- what */}
      <section className={card}>
        <h2 className="mb-4 text-sm font-semibold text-stone-900">What</h2>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={label} htmlFor="title">
              Title <span className="text-red-500" aria-hidden>*</span>
            </label>
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
            <label className={label} htmlFor="start_date">
              Starts <span className="text-red-500" aria-hidden>*</span>
            </label>
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
            <label className={label} htmlFor="end_date">
              Ends <span className="text-red-500" aria-hidden>*</span>
            </label>
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

        <div className="mt-4">
          <label className={label} htmlFor="repeat">Repeats</label>
          <select id="repeat" name="repeat" value={repeat} className={`${input} sm:max-w-xs`}
            onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
          </select>
        </div>

        {isRuleBased(repeat) && (
          <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
            {repeat === "custom" && (
              <div className="mb-4">
                <span className={label}>Repeat every</span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <input name="custom_interval" type="number" min={1} max={365}
                    value={interval} onChange={(e) => setInterval(e.target.value)}
                    className={`${field} w-16 text-center`} />
                  <select name="custom_freq" value={freq} className={`${field} w-32`}
                    onChange={(e) => setFreq(e.target.value as Frequency_)}>
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {FREQUENCY_LABEL[f][Number(interval) === 1 ? 0 : 1]}
                      </option>
                    ))}
                  </select>
                </div>

                {freq === "weekly" && (
                  <fieldset className="mt-3">
                    <legend className={label}>On these days</legend>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {WEEKDAYS.map((d) => {
                        const on = byday.includes(d.key);
                        return (
                          <label key={d.key} title={d.full}
                            className={`flex aspect-square cursor-pointer items-center justify-center rounded-full border text-sm ${
                              on
                                ? "border-stone-900 bg-stone-900 font-medium text-white"
                                : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                            }`}>
                            <input type="checkbox" name="custom_byday" value={d.key} checked={on}
                              className="sr-only"
                              onChange={(e) =>
                                setByday(
                                  e.target.checked
                                    ? [...byday, d.key]
                                    : byday.filter((k) => k !== d.key),
                                )
                              } />
                            {d.label}
                          </label>
                        );
                      })}
                    </div>
                    {err("custom_byday") && (
                      <p className="mt-1 text-xs text-red-600">{err("custom_byday")}</p>
                    )}
                  </fieldset>
                )}
              </div>
            )}

            <fieldset>
              <legend className={label}>Ends</legend>
              <div className="mt-1 space-y-2">
                {(["on", "after", "never"] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm text-stone-700">
                    <input type="radio" name="end_mode" value={mode} checked={endMode === mode}
                      onChange={() => setEndMode(mode)}
                      className="h-4 w-4 border-stone-300" />
                    {mode === "on" && (
                      <>
                        On
                        <input name="repeat_until" type="date" disabled={endMode !== "on"}
                          defaultValue={String(defaults.repeat_until ?? "")}
                          className={`${field} w-40 disabled:bg-stone-100`} />
                      </>
                    )}
                    {mode === "after" && (
                      <>
                        After
                        <input name="repeat_count" type="number" min={1} max={999}
                          disabled={endMode !== "after"}
                          defaultValue={String(defaults.repeat_count ?? "")}
                          className={`${field} w-16 text-center disabled:bg-stone-100`} />
                        times
                      </>
                    )}
                    {mode === "never" && "Never — keeps going"}
                  </label>
                ))}
              </div>
              {err("repeat_until") && <p className="mt-1 text-xs text-red-600">{err("repeat_until")}</p>}
              {err("repeat_count") && <p className="mt-1 text-xs text-red-600">{err("repeat_count")}</p>}
            </fieldset>

            <p className="mt-3 border-t border-stone-200 pt-3 text-xs text-stone-600">
              {describeRecurrence(
                {
                  freq: repeat === "custom" ? freq : repeat === "daily" ? "daily" : "weekly",
                  interval: repeat === "custom" ? Number(interval) || 1 : 1,
                  byday:
                    repeat === "custom" ? byday
                    : repeat === "weekdays" ? ["MO", "TU", "WE", "TH", "FR"]
                    : [],
                  endMode,
                  untilDate: String(defaults.repeat_until ?? "") || undefined,
                  count: Number(defaults.repeat_count) || undefined,
                },
                startTz,
              )}
            </p>
          </div>
        )}
        {repeat === "dates" && (
          <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <span className={label}>Also happens on</span>
            <p className="mt-1 text-xs text-stone-500">
              The start date above is the first occurrence. Add the others here
              — they all share the same time and place.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="date" value={nextDate} className={`${field} w-40`}
                onChange={(e) => setNextDate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Enter in a date field would otherwise submit the whole form.
                    e.preventDefault();
                    addDate();
                  }
                }} />
              <button type="button" onClick={addDate} disabled={!nextDate}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50">
                Add date
              </button>
            </div>

            {rdates.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {rdates.map((d) => (
                  <li key={d}>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white py-1 pl-3 pr-1.5 text-sm text-stone-700">
                      {DateTime.fromISO(d).toFormat("EEE d LLL yyyy")}
                      <input type="hidden" name="rdates" value={d} />
                      <button type="button" aria-label={`Remove ${d}`}
                        onClick={() => setRdates(rdates.filter((x) => x !== d))}
                        className="rounded-full px-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700">
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 border-t border-stone-200 pt-3 text-xs text-stone-600">
              {rdates.length + 1} occurrence{rdates.length === 0 ? "" : "s"} in total,
              including the start date.
            </p>
            {err("rdates") && <p className="mt-1 text-xs text-red-600">{err("rdates")}</p>}
          </div>
        )}
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
