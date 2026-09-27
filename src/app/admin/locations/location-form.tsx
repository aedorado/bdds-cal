"use client";

import { useActionState } from "react";
import { addLocation } from "./actions";
import { COMMON_ZONES } from "@/lib/datetime";

const input =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none";

export function LocationForm() {
  const [state, action, pending] = useActionState(addLocation, {} as { error?: string });

  return (
    <form action={action} className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-stone-900">Add a place</h2>
      <p className="mb-4 text-xs text-stone-500">
        Latitude and longitude are optional here, but the festival importer needs
        them to work out Ekadasi for this place.
      </p>

      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-6">
        <input name="name" placeholder="Name" className={`${input} sm:col-span-2`} />
        <input name="country" placeholder="Country" className={`${input} sm:col-span-2`} />
        <select name="tz" defaultValue="Asia/Kolkata" className={`${input} sm:col-span-2`}>
          {COMMON_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <input name="lat" placeholder="Latitude" className={input} />
        <input name="lon" placeholder="Longitude" className={input} />
        <button disabled={pending}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 sm:col-span-2">
          {pending ? "Adding…" : "Add place"}
        </button>
      </div>
    </form>
  );
}
