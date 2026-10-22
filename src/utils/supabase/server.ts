import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

type Options = {
  /**
   * True for Server Components, which cannot write cookies.
   *
   * This matters far more than it sounds. Supabase rotates the refresh token
   * on every refresh: the old one is consumed server-side the moment a new
   * pair is issued. A Server Component that refreshes therefore burns the
   * token and then CANNOT save the replacement - so the browser keeps sending
   * the consumed one, the next refresh fails with "Already Used", and the
   * session is destroyed. That is the "randomly logged out after a few
   * minutes" symptom.
   *
   * Refreshing happens in exactly one place, the proxy, which runs before
   * every render and can persist what it gets. Everywhere else reads.
   */
  readOnly?: boolean;
};

export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  { readOnly = false }: Options = {},
) => {
  return createServerClient(supabaseUrl!, supabaseKey!, {
    auth: readOnly
      ? { autoRefreshToken: false, persistSession: false }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // A read-only client must never try: silently dropping a rotated token
        // is exactly the failure this split exists to prevent.
        if (readOnly) return;

        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options),
        );
      },
    },
  });
};
