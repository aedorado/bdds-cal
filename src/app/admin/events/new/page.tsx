import { cookies } from "next/headers";
import { DateTime } from "luxon";
import { createClient } from "@/utils/supabase/server";
import { getProfile, canEdit } from "@/utils/supabase/auth";
import { EventForm } from "../event-form";
import type { Location } from "@/lib/types";

export default async function NewEventPage() {
  const profile = await getProfile();
  if (!canEdit(profile)) {
    return <p className="text-sm text-stone-600">You do not have permission to add events.</p>;
  }

  const supabase = createClient(await cookies());
  const { data: locations } = await supabase
    .from("locations").select("*").order("name");

  const today = DateTime.now().setZone("Asia/Kolkata").toFormat("yyyy-MM-dd");

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold text-stone-900">Add event</h1>
      <EventForm
        isNew
        locations={(locations ?? []) as Location[]}
        defaults={{
          event_type: "class",
          start_date: today, start_time: "18:30", start_tz: "Asia/Kolkata",
          end_date: today, end_time: "19:30", end_tz: "Asia/Kolkata",
          visibility: "public", status: "confirmed", repeat: "none",
        }}
      />
    </>
  );
}
