"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function saveSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
      expired_at: null,
    },
    { onConflict: "endpoint" },
  );

  if (error) return { error: error.message };

  revalidatePath("/admin/notifications");
  return {};
}

export async function removeSubscription(endpoint: string) {
  const supabase = createClient(await cookies());
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  revalidatePath("/admin/notifications");
  return {};
}

/** Fire one push to this device so you can see it actually arrives. */
export async function sendTestNotification() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .is("expired_at", null);

  if (!subs || subs.length === 0) return { error: "No devices are set up yet." };

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: "Notifications are working",
          body: "This is what a reminder will look like.",
          url: "/admin",
          tag: "test",
        }),
      );
      ok++;
    } catch {
      /* reported via the count below */
    }
  }

  return ok > 0 ? { sent: ok } : { error: "Could not deliver to any device." };
}

export async function setPrefs(enabled: boolean) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  await supabase
    .from("notification_prefs")
    .upsert({ profile_id: user.id, enabled }, { onConflict: "profile_id" });

  revalidatePath("/admin/notifications");
  return {};
}

export async function saveRule(formData: FormData) {
  const eventType = String(formData.get("event_type"));
  const offsets = formData
    .getAll("offsets")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);

  const supabase = createClient(await cookies());
  await supabase
    .from("notification_rules")
    .update({ offsets_minutes: offsets, enabled: offsets.length > 0 })
    .eq("event_type", eventType);

  revalidatePath("/admin/notifications");
}
