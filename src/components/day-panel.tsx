"use client";

import { useEffect } from "react";
import { DateTime } from "luxon";
import type { EventRow } from "@/lib/types";
import { EVENT_TYPE_LABEL } from "@/lib/types";

export type DayItem = {
  key: string;
  title: string;
  colour: string;
  /** Present for real schedule entries; absent for observances. */
  row?: EventRow;
  timeLabel: string | null;
  cancelled: boolean;
};

export type DaySelection = { date: Date; items: DayItem[] };

/**
 * The day's full contents. Day cells are too narrow to ever show a whole
 * title, so this is the real reading surface - reachable from any cell, not
 * only the crowded ones.
 */
export function DayPanel({
  selection, onPickEvent, onClose,
}: {
  selection: DaySelection;
  onPickEvent: (row: EventRow) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const heading = DateTime.fromJSDate(selection.date).toFormat("cccc d LLLL yyyy");
  const scheduled = selection.items.filter((i) => i.row);
  const observances = selection.items.filter((i) => !i.row);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/30 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <div className="flex items-center gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-stone-900">{heading}</h2>
          <button onClick={onClose} aria-label="Close"
            className="ml-auto -mr-2 rounded p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700">
            ✕
          </button>
        </div>

        <div className="max-h-[calc(80vh-3.5rem)] overflow-y-auto px-5 py-4">
          {selection.items.length === 0 && (
            <p className="py-6 text-center text-sm text-stone-500">
              Nothing scheduled on this day.
            </p>
          )}

          {scheduled.length > 0 && (
            <ul className="space-y-2">
              {scheduled.map((item) => (
                <li key={item.key}>
                  <button
                    onClick={() => onPickEvent(item.row!)}
                    className="flex w-full items-start gap-3 rounded-lg border border-stone-200 px-3 py-2.5 text-left hover:border-stone-300 hover:bg-stone-50"
                  >
                    <span className="mt-1 h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: item.colour }} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-medium text-stone-900 ${item.cancelled ? "line-through" : ""}`}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {item.timeLabel ?? "All day"}
                        {" · "}
                        {EVENT_TYPE_LABEL[item.row!.event_type]}
                      </span>
                    </span>
                    <span className="mt-1 text-stone-300">›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {observances.length > 0 && (
            <div className={scheduled.length > 0 ? "mt-5 border-t border-stone-100 pt-4" : ""}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                Vaishnava calendar
              </p>
              <ul className="space-y-1.5">
                {observances.map((item) => (
                  <li key={item.key} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.colour }} />
                    <span className="italic text-stone-700">{item.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
