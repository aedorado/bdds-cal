import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getProfile, canEdit } from "@/utils/supabase/auth";
import { LocationForm } from "./location-form";
import { deleteLocation } from "./actions";
import type { Location } from "@/lib/types";

export default async function LocationsPage() {
  const profile = await getProfile();
  const supabase = createClient(await cookies());
  const { data } = await supabase.from("locations").select("*").order("name");
  const locations = (data ?? []) as Location[];

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-stone-900">Places</h1>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Country</th>
              <th className="px-4 py-2 font-medium">Timezone</th>
              <th className="px-4 py-2 font-medium">Lat / Lon</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {locations.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2 font-medium text-stone-900">{l.name}</td>
                <td className="px-4 py-2 text-stone-600">{l.country ?? "—"}</td>
                <td className="px-4 py-2 text-stone-600">{l.tz}</td>
                <td className="px-4 py-2 text-stone-500">
                  {l.lat != null && l.lon != null ? `${l.lat}, ${l.lon}` : "— not set —"}
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit(profile) && (
                    <form action={deleteLocation}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-xs text-red-600 hover:text-red-800">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit(profile) && <LocationForm />}
    </div>
  );
}
