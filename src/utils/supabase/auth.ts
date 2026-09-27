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

/** The signed-in user's profile, or null if nobody is signed in. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient(await cookies());

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
}

export const canEdit = (p: Profile | null) => p?.role === "admin" || p?.role === "editor";
