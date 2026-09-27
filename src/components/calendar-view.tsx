"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import rrulePlugin from "@fullcalendar/rrule";
import luxonPlugin from "@fullcalendar/luxon3";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import type { DayItem, DaySelection } from "./day-panel";
import { DateTime } from "luxon";
import { EVENT_TYPE_COLOR, FESTIVAL_TYPE_COLOR, type EventRow, type FestivalType } from "@/lib/types";
import { viewerZone, formatRange } from "@/lib/datetime";

export type DisplayMode = "event" | "viewer";

export type FestivalRow = {
  id: string;
  date: string;
  name: string;
  festival_type: FestivalType;
  location_id: string | null;
};

/**
 * One grid can only have one time axis, but the events on it live in many
 * zones. So we offer both readings explicitly rather than silently picking one:
 *
 *  - "event"  : each event sits at its own wall-clock time. What someone
 *               standing in the temple room expects. Default.
 *  - "viewer" : everything converted to the reader's own zone. What someone
 *               joining a live stream from another country needs.
 */
function toInput(e: EventRow, mode: DisplayMode, viewer: string): EventInput {
  const naive = (utc: string, zone: string) =>
    DateTime.fromISO(utc, { zone: "utc" }).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm:ss");

  const start = mode === "event" ? naive(e.starts_at, e.start_tz) : e.starts_at;
  const end = mode === "event" ? naive(e.ends_at, e.end_tz) : e.ends_at;

  const cancelled = e.status === "cancelled";
  const colour = cancelled ? "#a8a29e" : EVENT_TYPE_COLOR[e.event_type];

  const base: EventInput = {
    id: e.id,
    title: e.title,
    backgroundColor: colour,
    borderColor: colour,
    classNames: [
      cancelled ? "evt-cancelled" : "",
      e.status === "tentative" ? "evt-tentative" : "",
    ].filter(Boolean),
    extendedProps: { row: e, viewer },
  };

  // All-day ends are exclusive in FullCalendar, so a retreat finishing on the
  // 7th must be handed over as the 8th or the last day silently disappears.
  if (e.all_day) {
    const endDate = DateTime.fromISO(e.ends_at, { zone: "utc" })
      .setZone(mode === "event" ? e.end_tz : viewer)
      .plus({ days: 1 })
      .toFormat("yyyy-MM-dd");
    return {
      ...base,
      allDay: true,
      start: DateTime.fromISO(e.starts_at, { zone: "utc" })
        .setZone(mode === "event" ? e.start_tz : viewer)
        .toFormat("yyyy-MM-dd"),
      end: endDate,
    };
  }

  if (e.rrule) {
    const until = e.recurrence_until
      ? DateTime.fromISO(e.recurrence_until, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'")
      : undefined;
    const mins = DateTime.fromISO(e.ends_at).diff(DateTime.fromISO(e.starts_at), "minutes").minutes;
    return {
      ...base,
      rrule: {
        dtstart: start,
        ...Object.fromEntries(
          e.rrule.split(";").map((p) => {
            const [k, v] = p.split("=");
            return [k.toLowerCase(), k === "BYDAY" ? v.split(",") : v.toLowerCase()];
          }),
        ),
        ...(until ? { until } : {}),
      },
      duration: { minutes: mins },
    };
  }

  return { ...base, start, end };
}

/**
 * On a phone a month cell is barely 50px wide, so a chip title clips to a
 * single letter. Rather than show that, collapse almost everything into the
 * "+N more" link - its popover has room for the full names.
 */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    Promise.resolve().then(apply);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return narrow;
}

export function CalendarView({
  events,
  festivals = [],
  onEventClick,
  onDayClick,
  initialView = "dayGridMonth",
  mode,
}: {
  events: EventRow[];
  festivals?: FestivalRow[];
  onEventClick: (e: EventRow) => void;
  onDayClick?: (selection: DaySelection) => void;
  initialView?: string;
  mode: DisplayMode;
}) {
  const [viewer] = useState(viewerZone);
  const narrow = useNarrow();
  const calRef = useRef<FullCalendar>(null);

  /**
   * Ask FullCalendar what it is actually showing on that day rather than
   * re-deriving it: the instances of a recurring class only exist after the
   * rule has been expanded, and FullCalendar has already done that.
   */
  function openDay(date: Date) {
    if (!onDayClick) return;
    const api = calRef.current?.getApi();
    if (!api) return;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const items: DayItem[] = api
      .getEvents()
      .filter((e) => {
        if (!e.start) return false;
        const end = e.end ?? new Date(e.start.getTime() + 1);
        return e.start < dayEnd && end > dayStart;
      })
      .map((e) => {
        const row = e.extendedProps.row as EventRow | undefined;
        return {
          key: `${e.id}-${e.start!.toISOString()}`,
          title: e.title,
          colour: e.backgroundColor || e.borderColor || "#a8a29e",
          row,
          timeLabel:
            row && !row.all_day
              ? formatRange(row.starts_at, row.start_tz, row.ends_at, row.end_tz, false)
              : null,
          cancelled: row?.status === "cancelled",
        };
      })
      // Scheduled entries first, then observances, each by start time.
      .sort((a, b) => Number(Boolean(a.row)) === Number(Boolean(b.row))
        ? a.title.localeCompare(b.title)
        : Number(Boolean(b.row)) - Number(Boolean(a.row)));

    onDayClick({ date: dayStart, items });
  }

  const items = useMemo<EventInput[]>(() => {
    const evts = events.map((e) => toInput(e, mode, viewer));
    // Rendered as list-items (a dot and a label) rather than background
    // events: background events all draw their title in the same corner of the
    // cell, so on a day with three observances they print on top of each other.
    const fests: EventInput[] = festivals.map((f) => ({
      id: `festival-${f.id}`,
      title: f.name,
      start: f.date,
      allDay: true,
      display: "list-item",
      color: FESTIVAL_TYPE_COLOR[f.festival_type] ?? "#a8a29e",
      classNames: ["evt-festival"],
      extendedProps: { festival: true, festivalLast: 1 },
    }));

    return [...fests, ...evts];
  }, [events, festivals, mode, viewer]);

  function handleClick(arg: EventClickArg) {
    const row = arg.event.extendedProps.row as EventRow | undefined;
    if (row) onEventClick(row);
  }

  return (
    <div className="calendar-wrap rounded-xl border border-stone-200 bg-white p-3">
      <FullCalendar
        ref={calRef}
        // Remount on a breakpoint change so the view below actually applies;
        // initialView is only read when the calendar is created.
        key={narrow ? "narrow" : "wide"}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, rrulePlugin, luxonPlugin, interactionPlugin]}
        // A month cell on a phone is about 60px wide, so a chip title clips to
        // a single letter no matter what. The agenda list reads properly at
        // that width - Month is still one tap away in the toolbar.
        initialView={narrow ? "listMonth" : initialView}
        timeZone={mode === "event" ? "local" : viewer}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: narrow
            ? "dayGridMonth,listMonth"
            : "dayGridMonth,timeGridWeek,timeGridDay,listMonth",
        }}
        buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day", list: "Agenda" }}
        noEventsText="Nothing scheduled this month"
        events={items}
        eventClick={handleClick}
        // Any cell opens the day panel, not just the overcrowded ones.
        dateClick={(arg: DateClickArg) => openDay(arg.date)}
        // Route "+N more" through the same panel so there is one day view,
        // not two that look different.
        moreLinkClick={(arg) => {
          openDay(arg.date);
          return "none";
        }}
        // A fixed height keeps every week the same depth - with "auto" a busy
        // week grew tall and the rest collapsed, which read as broken. It also
        // lets dayMaxEvents work out how many actually fit, instead of guessing.
        height={narrow ? 620 : 760}
        firstDay={1}
        nowIndicator
        dayMaxEvents={narrow ? 1 : true}
        moreLinkText={(n) => `+${n} more`}
        eventDidMount={(arg) => {
          // Titles are clipped in a day cell, so give every chip the full text
          // on hover. The "+N more" popover shows them in full already.
          const full = arg.event.extendedProps.festival
            ? arg.event.title
            : `${arg.event.title}${arg.timeText ? ` · ${arg.timeText}` : ""}`;
          arg.el.setAttribute("title", full);
        }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        displayEventEnd
        eventOrder="festivalLast,start,-duration,title"
        eventOrderStrict={false}
      />
    </div>
  );
}
