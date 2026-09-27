"use client";

import { useEffect, useState } from "react";
import {
  FESTIVAL_TYPES, FESTIVAL_TYPE_LABEL, FESTIVAL_TYPE_COLOR,
  FESTIVAL_TYPES_DEFAULT, type FestivalType, type Location,
} from "@/lib/types";

export type FestivalSettings = {
  locationId: string | null;   // null = hide observances entirely
  types: FestivalType[];
};

const STORE_KEY = "bdds.festivals";

/**
 * Ekadasi and tithis are computed for an observer's position, so they genuinely
 * differ between Vrindavan and Lagos. Showing every location at once put four
 * copies of every observance on the same square - hence one place at a time.
 */
export function useFestivalSettings(locations: Location[]) {
  const [settings, setSettings] = useState<FestivalSettings>({
    locationId: null,
    types: FESTIVAL_TYPES_DEFAULT,
  });

  useEffect(() => {
    let cancelled = false;

    // localStorage only exists in the browser, so the restore happens after the
    // first paint - resolved off a microtask so it is not a synchronous
    // setState inside the effect body.
    Promise.resolve().then(() => {
      if (cancelled) return;
      let restored: FestivalSettings | null = null;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) restored = JSON.parse(raw) as FestivalSettings;
      } catch {
        // Private browsing or blocked storage - fall through to the default.
      }
      setSettings(
        restored ?? {
          locationId: locations[0]?.id ?? null,
          types: FESTIVAL_TYPES_DEFAULT,
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [locations]);

  function update(next: FestivalSettings) {
    setSettings(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* not worth surfacing */
    }
  }

  return { settings, update };
}

export function FestivalFilter({
  locations, settings, onChange,
}: {
  locations: Location[];
  settings: FestivalSettings;
  onChange: (s: FestivalSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = locations.find((l) => l.id === settings.locationId);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50">
        {current ? `Vaishnava calendar: ${current.name}` : "Vaishnava calendar: off"}
        <span className="ml-1 text-stone-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
            <label className="block text-xs font-medium text-stone-700">
              Calculated for
            </label>
            <select
              value={settings.locationId ?? ""}
              onChange={(e) =>
                onChange({ ...settings, locationId: e.target.value || null })
              }
              className="mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
              <option value="">Don&apos;t show observances</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
              Ekadasi falls on different dates in different places — this picks
              whose reckoning to show.
            </p>

            {settings.locationId && (
              <fieldset className="mt-4 border-t border-stone-100 pt-3">
                <legend className="sr-only">Which observances</legend>
                {FESTIVAL_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 py-1 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={settings.types.includes(t)}
                      onChange={(e) =>
                        onChange({
                          ...settings,
                          types: e.target.checked
                            ? [...settings.types, t]
                            : settings.types.filter((x) => x !== t),
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-stone-300"
                    />
                    <span className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: FESTIVAL_TYPE_COLOR[t] }} />
                    {FESTIVAL_TYPE_LABEL[t]}
                    {t === "note" && (
                      <span className="text-[11px] text-stone-400">(noisy)</span>
                    )}
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Apply the chosen place and types. */
export function filterFestivals<T extends { location_id: string | null; festival_type: FestivalType }>(
  festivals: T[],
  settings: FestivalSettings,
): T[] {
  if (!settings.locationId) return [];
  return festivals.filter(
    (f) => f.location_id === settings.locationId && settings.types.includes(f.festival_type),
  );
}
