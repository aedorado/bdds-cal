import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type Role = "admin" | "editor" | "viewer";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
};

/**
 * The signed-in user's profile, or null if nobody is signed in.
 *
 * Wrapped in React's cache() so a layout and the page it wraps share one
 * lookup instead of each making their own. Beyond saving two round trips,
 * concurrent auth calls in one render are what make refresh-token rotation
 * race, and a single call cannot race itself.
 *
 * The client is read-only: refreshing belongs to the proxy, which runs first
 * and can actually persist the new token.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient(await cookies(), { readOnly: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
});

export const canEdit = (p: Profile | null) => p?.role === "admin" || p?.role === "editor";

/**
 * Places are shared reference data: an event's timezone, and the observer
 * position every Ekadasi date is computed from. Deleting one silently changes
 * what the calendar says, so it is held to one person rather than to whoever
 * happens to be an admin.
 *
 * Set OWNER_EMAIL to that address. With it unset the check falls back to
 * admins, so a missing variable cannot lock everyone out.
 */
export function isOwner(p: Profile | null): boolean {
  if (!p) return false;
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) return p.role === "admin";
  return p.email.trim().toLowerCase() === owner;
}
