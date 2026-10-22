"use client";

import { useEffect, useState } from "react";
import {
  FESTIVAL_TYPES, FESTIVAL_TYPE_LABEL, FESTIVAL_TYPE_COLOR,
  FESTIVAL_TYPES_DEFAULT, type FestivalType, type Location,
} from "@/lib/types";

export type FestivalSettings = {
  /** Off by default: the schedule is the point, observances are context. */
  show: boolean;
  locationId: string | null;
  types: FestivalType[];
};

const STORE_KEY = "bdds.festivals";

const DEFAULTS: FestivalSettings = {
  show: false,
  locationId: null,
  types: FESTIVAL_TYPES_DEFAULT,
};

export function useFestivalSettings(locations: Location[]) {
  const [settings, setSettings] = useState<FestivalSettings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;

    // localStorage only exists in the browser, so the restore happens after the
    // first paint - resolved off a microtask so it is not a synchronous
    // setState inside the effect body.
    Promise.resolve().then(() => {
      if (cancelled) return;

      let restored: Partial<FestivalSettings> | null = null;
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) restored = JSON.parse(raw) as Partial<FestivalSettings>;
      } catch {
        // Private browsing or blocked storage - fall through to the defaults.
      }

      setSettings({
        // Older saved settings had no `show` flag: back then a chosen location
        // meant "visible", so honour that rather than silently hiding what
        // someone had already turned on.
        show: restored?.show ?? Boolean(restored?.locationId),
        locationId: restored?.locationId ?? locations[0]?.id ?? null,
        types: restored?.types ?? FESTIVAL_TYPES_DEFAULT,
      });
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

const TRIGGER =
  "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50";

/** Which observances to show, and whether to show them at all. */
export function FestivalFilter({
  settings, onChange,
}: {
  settings: FestivalSettings;
  onChange: (s: FestivalSettings) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={TRIGGER}>
        Vaishnava calendar:{" "}
        <span className={settings.show ? "font-medium text-stone-900" : ""}>
          {settings.show ? "on" : "off"}
        </span>
        <span className="ml-1 text-stone-400">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
              <input type="checkbox" checked={settings.show}
                onChange={(e) => onChange({ ...settings, show: e.target.checked })}
                className="h-4 w-4 rounded border-stone-300" />
              Show observances
            </label>
            <p className="mt-1.5 text-[11px] leading-snug text-stone-500">
              Ekadasi, appearance and disappearance days, shown behind the
              schedule.
            </p>

            {settings.show && (
              <fieldset className="mt-3 border-t border-stone-100 pt-3">
                <legend className="sr-only">Which observances</legend>
                {FESTIVAL_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 py-1 text-sm text-stone-700">
                    <input type="checkbox" checked={settings.types.includes(t)}
                      onChange={(e) =>
                        onChange({
                          ...settings,
                          types: e.target.checked
                            ? [...settings.types, t]
                            : settings.types.filter((x) => x !== t),
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-stone-300" />
                    <span className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: FESTIVAL_TYPE_COLOR[t] }} />
                    {FESTIVAL_TYPE_LABEL[t]}
                    {t === "note" && <span className="text-[11px] text-stone-400">(noisy)</span>}
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

/**
 * Which place the observances are reckoned for - a separate choice from which
 * city's events you are looking at. Ekadasi genuinely falls on different civil
 * dates in Vrindavan and Lagos, so this cannot follow the event filter.
 */
export function FestivalLocationPicker({
  locations, settings, onChange,
}: {
  locations: Location[];
  settings: FestivalSettings;
  onChange: (s: FestivalSettings) => void;
}) {
  if (!settings.show) return null;

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Observances calculated for</span>
      <select
        value={settings.locationId ?? ""}
        onChange={(e) => onChange({ ...settings, locationId: e.target.value || null })}
        className={TRIGGER}
        title="Ekadasi and tithis are calculated for an observer's position"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>Reckoned for {l.name}</option>
        ))}
      </select>
    </label>
  );
}

export function filterFestivals<T extends { location_id: string | null; festival_type: FestivalType }>(
  festivals: T[],
  settings: FestivalSettings,
): T[] {
  if (!settings.show || !settings.locationId) return [];
  return festivals.filter(
    (f) => f.location_id === settings.locationId && settings.types.includes(f.festival_type),
  );
}
