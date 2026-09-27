import Link from "next/link";
import { cookies } from "next/headers";
import { DateTime } from "luxon";
import { createClient } from "@/utils/supabase/server";
import { PublicCalendar } from "./public-client";
import type { EventRow, Location } from "@/lib/types";

export const revalidate = 60;

export default async function Home() {
  const supabase = createClient(await cookies());

  const from = DateTime.now().minus({ months: 1 }).toISO();
  const to = DateTime.now().plus({ months: 12 }).toISO();

  // public_events is a view that physically lacks internal_notes and is
  // filtered to visibility = 'public'. The anon key cannot reach `events`.
  const [{ data: events }, { data: locations }] = await Promise.all([
    supabase.from("public_events").select("*")
      .gte("starts_at", from).lte("starts_at", to).order("starts_at"),
    supabase.from("locations").select("*").order("name"),
  ]);

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-5">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">
              Śrī Śrīmad Bhakti Dhira Dāmodara Swāmī Mahārāja
            </h1>
            <p className="text-sm text-stone-600">Programme &amp; travel schedule</p>
          </div>
          <Link href="/admin"
            className="ml-auto text-sm text-stone-500 hover:text-stone-900">
            Team sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-4">
        <PublicCalendar
          events={(events ?? []) as EventRow[]}
          locations={(locations ?? []) as Location[]}
          nowIso={DateTime.now().toISO()!}
        />
        <p className="mt-6 text-center text-xs text-stone-400">
          Times are shown in the local time of each programme unless you switch above.
          Please confirm before travelling.
        </p>
      </main>
    </div>
  );
}
