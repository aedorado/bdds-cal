import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Pinged by a GitHub Actions workflow so the Supabase project does not get
 * paused for inactivity - which would stop notifications silently.
 *
 * Deliberately does a real (tiny) query: merely reaching this route would keep
 * Vercel warm but would not count as database activity.
 */
export async function GET() {
  const supabase = createClient(await cookies());
  const { error } = await supabase.from("locations").select("id").limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
