"use client";

import { useMemo, useState } from "react";
import { CalendarView, type DisplayMode } from "@/components/calendar-view";
import { EventModal } from "@/components/event-modal";
import { DayPanel, type DaySelection } from "@/components/day-panel";
import { formatRange, viewerZone, fmtDateTime } from "@/lib/datetime";
import { FestivalFilter, useFestivalSettings, filterFestivals } from "@/components/festival-filter";
import { useFestivals } from "@/components/use-festivals";
import {
  EVENT_TYPES, EVENT_TYPE_LABEL, EVENT_TYPE_COLOR,
  type EventRow, type EventType, type Location,
} from "@/lib/types";

type Tab = "calendar" | "list";

export function PublicCalendar({
  events, locations, nowIso,
}: {
  events: EventRow[];
  locations: Location[];
  /** Server render time. Taken from the server so the list is stable across
      re-renders and identical between server and client markup. */
  nowIso: string;
}) {
  const [tab, setTab] = useState<Tab>("calendar");
  const [mode, setMode] = useState<DisplayMode>("event");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [day, setDay] = useState<DaySelection | null>(null);
  const { settings: festivalSettings, update: setFestivalSettings } = useFestivalSettings(locations);
  const { festivals } = useFestivals(festivalSettings.locationId);
  const shownFestivals = useMemo(
    () => filterFestivals(festivals, festivalSettings),
    [festivals, festivalSettings],
  );

  const filtered = useMemo(
    () => events.filter((e) =>
      (!city || e.location_id === city) && (!type || e.event_type === type)),
    [events, city, type],
  );

  const now = new Date(nowIso).getTime();

  const upcoming = useMemo(
    () =>
      filtered
        .filter((e) => new Date(e.ends_at).getTime() >= now)
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [filtered, now],
  );

  // Only offer cities that actually have something on.
  const usedLocations = useMemo(
    () => locations.filter((l) => events.some((e) => e.location_id === l.id)),
    [locations, events],
  );
  const usedTypes = useMemo(
    () => EVENT_TYPES.filter((t) => events.some((e) => e.event_type === t)),
    [events],
  );

  const select = "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-stone-300">
          {(["calendar", "list"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm ${tab === t ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
              {t === "calendar" ? "Calendar" : "Upcoming"}
            </button>
          ))}
        </div>

        <select value={city} onChange={(e) => setCity(e.target.value)} className={select}
          aria-label="Filter by city">
          <option value="">All places</option>
          {usedLocations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <select value={type} onChange={(e) => setType(e.target.value)} className={select}
          aria-label="Filter by type">
          <option value="">All kinds</option>
          {usedTypes.map((t) => (
            <option key={t} value={t}>{EVENT_TYPE_LABEL[t as EventType]}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <FestivalFilter locations={locations} settings={festivalSettings}
            onChange={setFestivalSettings} />
          <button
            onClick={() => setMode(mode === "event" ? "viewer" : "event")}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50">
            {mode === "event" ? "Showing local time at each event" : `Showing your time (${viewerZone()})`}
          </button>
        </div>
      </div>

      {tab === "calendar" ? (
        <CalendarView events={filtered} festivals={shownFestivals} mode={mode}
          onEventClick={setSelected} onDayClick={setDay} />
      ) : (
        <UpcomingList events={upcoming} locations={locations} mode={mode}
          onSelect={setSelected} />
      )}

      {day && !selected && (
        <DayPanel selection={day} onClose={() => setDay(null)}
          onPickEvent={(row) => setSelected(row)} />
      )}

      {selected && (
        <EventModal event={selected} locations={locations}
          onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function UpcomingList({
  events, locations, mode, onSelect,
}: {
  events: EventRow[];
  locations: Location[];
  mode: DisplayMode;
  onSelect: (e: EventRow) => void;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        Nothing scheduled here yet.
      </p>
    );
  }

  const viewer = viewerZone();

  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const loc = locations.find((l) => l.id === e.location_id);
        const where = [loc?.name, e.location_text].filter(Boolean).join(" — ");
        return (
          <li key={e.id}>
            <button onClick={() => onSelect(e)}
              className="flex w-full gap-4 rounded-xl border border-stone-200 bg-white p-4 text-left hover:border-stone-300 hover:shadow-sm">
              <span className="mt-1 h-10 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: e.status === "cancelled" ? "#a8a29e" : EVENT_TYPE_COLOR[e.event_type] }} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-medium text-stone-900 ${e.status === "cancelled" ? "line-through" : ""}`}>
                    {e.title}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-stone-400">
                    {EVENT_TYPE_LABEL[e.event_type]}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-stone-600">
                  {mode === "viewer"
                    ? `${fmtDateTime(e.starts_at, viewer)} (${viewer})`
                    : formatRange(e.starts_at, e.start_tz, e.ends_at, e.end_tz, e.all_day)}
                </span>
                {where && <span className="block text-sm text-stone-500">{where}</span>}
                {e.status === "cancelled" && (
                  <span className="mt-1 block text-sm text-red-700">
                    Cancelled — {e.cancellation_reason}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
