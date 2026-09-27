"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { createClient } from "@/utils/supabase/client";
import type { FestivalRow } from "./calendar-view";

/**
 * Observances are fetched for the ONE selected location, in the browser.
 *
 * Fetching all locations server-side looked fine until there were six of them:
 * ~240 rows each per year blew past PostgREST's 1000-row response cap, and the
 * overflow was dropped silently - the calendar simply went empty partway
 * through 2027 with no error anywhere. Scoping to the selection keeps the
 * result an order of magnitude under the cap however many places are added,
 * and an explicit limit means a future overflow fails loudly instead.
 */
export function useFestivals(locationId: string | null) {
  const [festivals, setFestivals] = useState<FestivalRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!locationId) {
      Promise.resolve().then(() => {
        if (!cancelled) setFestivals([]);
      });
      return () => {
        cancelled = true;
      };
    }

    const from = DateTime.now().minus({ months: 6 }).toFormat("yyyy-MM-dd");
    const to = DateTime.now().plus({ months: 24 }).toFormat("yyyy-MM-dd");

    createClient()
      .from("festivals")
      .select("id, date, name, festival_type, location_id")
      .eq("location_id", locationId)
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .limit(2000)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setFestivals([]);
          return;
        }
        setError(null);
        setFestivals((data ?? []) as FestivalRow[]);
      });

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  return { festivals, error };
}
