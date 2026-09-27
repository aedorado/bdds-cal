"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/** Pre-approve someone so their role is right the moment they first sign in. */
export async function inviteEditor(_prev: { error?: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "editor");
  if (!email.includes("@")) return { error: "That does not look like an email address." };

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("editor_allowlist")
    .upsert({ email, role }, { onConflict: "email" });

  if (error) {
    return {
      error: /row-level security/i.test(error.message)
        ? "Only an admin can approve people."
        : error.message,
    };
  }

  revalidatePath("/admin/people");
  return {};
}

/** Change the role of someone who has already signed in at least once. */
export async function setRole(formData: FormData) {
  const supabase = createClient(await cookies());
  await supabase
    .from("profiles")
    .update({ role: String(formData.get("role")) })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/people");
}
