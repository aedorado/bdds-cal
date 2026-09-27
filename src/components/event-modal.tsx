"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatRange, durationLabel, fmtDateTime, viewerZone } from "@/lib/datetime";
import { EVENT_TYPE_LABEL, EVENT_TYPE_COLOR, type EventRow, type FlightDetails, type Location } from "@/lib/types";

export function EventModal({
  event, locations, flight, admin = false, onClose,
}: {
  event: EventRow;
  locations: Location[];
  flight?: FlightDetails | null;
  admin?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loc = locations.find((l) => l.id === event.location_id);
  const where = [loc?.name, event.location_text].filter(Boolean).join(" — ");
  const colour = EVENT_TYPE_COLOR[event.event_type];
  const viewer = viewerZone();

  // Only worth showing "in your time" when it actually differs from the
  // event's own zone; otherwise it is noise.
  const showViewerTime = !event.all_day && viewer !== event.start_tz;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: colour }} />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                {EVENT_TYPE_LABEL[event.event_type]}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-stone-900">{event.title}</h2>
            </div>
            <button onClick={onClose} aria-label="Close"
              className="-mr-2 -mt-1 rounded p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
              ✕
            </button>
          </div>

          {event.status === "cancelled" && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              <strong>Cancelled.</strong>{" "}
              {event.cancellation_reason}
            </p>
          )}
          {event.status === "tentative" && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Not yet confirmed — please check before travelling.
            </p>
          )}

          <dl className="mt-5 space-y-3 text-sm">
            <Row term="When">
              {formatRange(event.starts_at, event.start_tz, event.ends_at, event.end_tz, event.all_day)}
              {!event.all_day && (
                <span className="text-stone-500"> · {durationLabel(event.starts_at, event.ends_at)}</span>
              )}
              {showViewerTime && (
                <div className="mt-1 text-xs text-stone-500">
                  In your time ({viewer}): {fmtDateTime(event.starts_at, viewer)}
                </div>
              )}
            </Row>

            {where && <Row term="Where">{where}</Row>}

            {event.description && (
              <Row term="About">
                <span className="whitespace-pre-wrap">{event.description}</span>
              </Row>
            )}

            {event.stream_url && (
              <Row term="Join">
                <a href={event.stream_url} target="_blank" rel="noopener noreferrer"
                  className="text-sky-700 underline underline-offset-2 hover:text-sky-900">
                  {event.stream_platform || "Live stream"} →
                </a>
              </Row>
            )}

            {event.rrule && <Row term="Repeats">This is part of a recurring series.</Row>}
          </dl>

          {admin && (flight || event.internal_notes) && (
            <div className="mt-6 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Team only
              </p>

              {flight && (
                <dl className="space-y-2 text-sm">
                  <Row term="Flight">
                    {[flight.airline, flight.flight_number].filter(Boolean).join(" ")}
                    {flight.departure_airport && flight.arrival_airport && (
                      <> · {flight.departure_airport} → {flight.arrival_airport}</>
                    )}
                  </Row>
                  {(flight.departure_terminal || flight.arrival_terminal) && (
                    <Row term="Terminals">
                      {flight.departure_terminal ?? "—"} → {flight.arrival_terminal ?? "—"}
                    </Row>
                  )}
                  {flight.seat && <Row term="Seat">{flight.seat}</Row>}
                  {flight.booking_ref && <Row term="Booking">{flight.booking_ref}</Row>}
                </dl>
              )}

              {event.internal_notes && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">
                  {event.internal_notes}
                </p>
              )}
            </div>
          )}

          {admin && (
            <div className="mt-6 flex items-center gap-3">
              <Link href={`/admin/events/${event.id}`}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
                Edit
              </Link>
              <span className="text-xs text-stone-500">
                Visibility: {event.visibility} · Status: {event.status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3">
      <dt className="text-stone-500">{term}</dt>
      <dd className="text-stone-900">{children}</dd>
    </div>
  );
}
