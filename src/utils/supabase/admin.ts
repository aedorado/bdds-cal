import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely, so it must never be imported
 * into a client component - the "server-only" import above turns that mistake
 * into a build error rather than a data leak.
 *
 * Used only by the notification runner, which acts on behalf of no one and has
 * to read every team member's push subscription.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Create one in Supabase under " +
        "Project Settings -> API Keys -> Secret keys. It starts sb_secret_ and " +
        "is only shown once.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
