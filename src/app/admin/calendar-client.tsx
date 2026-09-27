"use client";

import { useState } from "react";
import { CalendarView, type DisplayMode } from "@/components/calendar-view";
import { EventModal } from "@/components/event-modal";
import { DayPanel, type DaySelection } from "@/components/day-panel";
import type { EventRow, FlightDetails, Location } from "@/lib/types";
import { viewerZone } from "@/lib/datetime";
import { FestivalFilter, useFestivalSettings, filterFestivals } from "@/components/festival-filter";
import { useFestivals } from "@/components/use-festivals";
import { useMemo } from "react";

export function AdminCalendar({
  events, locations, flights,
}: {
  events: EventRow[];
  locations: Location[];
  flights: Record<string, FlightDetails>;
}) {
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [day, setDay] = useState<DaySelection | null>(null);
  const [mode, setMode] = useState<DisplayMode>("event");
  const { settings: festivalSettings, update: setFestivalSettings } = useFestivalSettings(locations);
  const { festivals } = useFestivals(festivalSettings.locationId);
  const shownFestivals = useMemo(
    () => filterFestivals(festivals, festivalSettings),
    [festivals, festivalSettings],
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-xs">
        <FestivalFilter locations={locations} settings={festivalSettings}
          onChange={setFestivalSettings} />
        <span className="text-stone-500">Show times in</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-stone-300">
          {(["event", "viewer"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 ${mode === m ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}>
              {m === "event" ? "Event's local time" : `My time (${viewerZone()})`}
            </button>
          ))}
        </div>
      </div>

      <CalendarView events={events} festivals={shownFestivals} mode={mode}
        onEventClick={setSelected} onDayClick={setDay} />

      {day && !selected && (
        <DayPanel selection={day} onClose={() => setDay(null)}
          onPickEvent={(row) => setSelected(row)} />
      )}

      {selected && (
        <EventModal admin event={selected} locations={locations}
          flight={flights[selected.id] ?? null}
          onClose={() => setSelected(null)} />
      )}
    </>
  );
}
