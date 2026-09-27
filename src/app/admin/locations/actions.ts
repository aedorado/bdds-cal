"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function addLocation(_prev: { error?: string }, formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const name = get("name");
  const tz = get("tz");
  if (!name || !tz) return { error: "Name and timezone are both required." };

  const lat = get("lat");
  const lon = get("lon");

  const supabase = createClient(await cookies());
  const { error } = await supabase.from("locations").insert({
    name,
    city: get("city") || name,
    country: get("country") || null,
    tz,
    // Needed by the festival importer - tithis depend on the observer's position.
    lat: lat ? Number(lat) : null,
    lon: lon ? Number(lon) : null,
  });

  if (error) {
    return {
      error: /row-level security/i.test(error.message)
        ? "Your account cannot add locations."
        : error.message,
    };
  }

  revalidatePath("/admin/locations");
  return {};
}

export async function deleteLocation(formData: FormData) {
  const supabase = createClient(await cookies());
  await supabase.from("locations").delete().eq("id", String(formData.get("id")));
  revalidatePath("/admin/locations");
}
