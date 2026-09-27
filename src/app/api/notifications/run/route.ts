import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/utils/supabase/admin";
import { findDue, buildMessage, windowFilter, type Rule } from "@/lib/notifications";
import type { EventRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Subscription = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Called on a schedule by Supabase Cron (pg_cron + pg_net), not by a browser.
 *
 * Idempotency is the whole game here: pg_cron never retries a failed tick and
 * will start a new run while an old one is still going. So each reminder is
 * claimed by inserting into notifications_sent FIRST - the unique constraint
 * makes a duplicate claim fail - and the claim is released again if the send
 * itself errors, so the next tick retries it.
 *
 * The claim is per SUBSCRIPTION, not per person: someone with a phone and a
 * laptop should be buzzed on both, and the guard exists to stop one device
 * being buzzed twice.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    vapidPublic,
    vapidPrivate,
  );

  let db;
  try {
    db = createAdminClient();
  } catch (err) {
    // This runs unattended, so it must say plainly what is wrong rather than
    // throwing an empty 500 into cron.job_run_details.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "admin client unavailable" },
      { status: 500 },
    );
  }

  const now = new Date();
  const { from, to } = windowFilter(now);

  // Anything starting in the window, plus any live series that could produce an
  // occurrence inside it (a series' own starts_at may be far in the past).
  const [{ data: dated }, { data: series }, { data: rules }] = await Promise.all([
    db.from("events").select("*").gte("starts_at", from).lte("starts_at", to),
    db.from("events").select("*").not("rrule", "is", null).gte("recurrence_until", from),
    db.from("notification_rules").select("*"),
  ]);

  const events = Object.values(
    Object.fromEntries(
      [...(dated ?? []), ...(series ?? [])].map((e) => [e.id, e]),
    ),
  ) as EventRow[];

  const due = findDue(events, (rules ?? []) as Rule[], now);
  if (due.length === 0) {
    return NextResponse.json({ checked: events.length, due: 0, sent: 0 });
  }

  const [{ data: subs }, { data: prefs }] = await Promise.all([
    db.from("push_subscriptions").select("id, profile_id, endpoint, p256dh, auth").is("expired_at", null),
    db.from("notification_prefs").select("profile_id, enabled, event_types"),
  ]);

  const prefFor = new Map(
    ((prefs ?? []) as { profile_id: string; enabled: boolean; event_types: string[] | null }[])
      .map((p) => [p.profile_id, p]),
  );

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const reminder of due) {
    const type = reminder.occurrence.event.event_type;

    for (const sub of (subs ?? []) as Subscription[]) {
      // Absent prefs row means "on" - what someone who just enabled push expects.
      const pref = prefFor.get(sub.profile_id);
      if (pref && !pref.enabled) continue;
      if (pref?.event_types && !pref.event_types.includes(type)) continue;

      // Claim it for THIS DEVICE. A duplicate key means this device already
      // received this reminder - not that the person did, which is why the
      // claim carries subscription_id.
      const { data: claim, error: claimError } = await db
        .from("notifications_sent")
        .insert({
          event_id: reminder.occurrence.event.id,
          occurrence_at: reminder.occurrence.startsAt,
          offset_minutes: reminder.offsetMinutes,
          profile_id: sub.profile_id,
          subscription_id: sub.id,
        })
        .select("id")
        .single();

      if (claimError) {
        skipped++;
        continue;
      }

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(buildMessage(reminder)),
        );
        sent++;
        await db
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;

        // Release the claim so the next tick retries this reminder.
        await db.from("notifications_sent").delete().eq("id", claim.id);

        if (status === 404 || status === 410) {
          // The browser threw the subscription away. Retiring it is the fix,
          // not retrying it - so leave the claim released but kill the endpoint.
          await db
            .from("push_subscriptions")
            .update({ expired_at: new Date().toISOString() })
            .eq("id", sub.id);
          failures.push(`expired:${sub.id}`);
        } else {
          failures.push(`${status ?? "err"}:${sub.id}`);
        }
      }
    }
  }

  return NextResponse.json({
    checked: events.length,
    due: due.length,
    sent,
    skipped,
    failures: failures.slice(0, 20),
  });
}
