import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getProfile } from "@/utils/supabase/auth";
import { PushSetup } from "./push-setup";
import { saveRule } from "./actions";
import { LADDER, type Rule } from "@/lib/notifications";
import { EVENT_TYPE_LABEL, type EventType } from "@/lib/types";

export default async function NotificationsPage() {
  const profile = await getProfile();
  const supabase = createClient(await cookies());

  const [{ data: rules }, { data: prefs }, { data: devices }] = await Promise.all([
    supabase.from("notification_rules").select("*").order("event_type"),
    supabase.from("notification_prefs").select("enabled").eq("profile_id", profile!.id).maybeSingle(),
    supabase.from("push_subscriptions").select("id, user_agent, created_at, expired_at").is("expired_at", null),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Notifications</h1>
        <p className="text-sm text-stone-600">
          Reminders are sent to the team only, never to the public calendar.
        </p>
      </div>

      <PushSetup initialEnabled={prefs?.enabled ?? true} />

      {(devices?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            Your devices ({devices!.length})
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-stone-600">
            {devices!.map((d) => (
              <li key={d.id}>
                {shortenAgent(d.user_agent)}
                <span className="text-stone-400">
                  {" "}· added {new Date(d.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-900">When to remind</h2>
        <p className="mb-4 mt-1 text-xs text-stone-500">
          Chosen per kind of event, because what suits a flight does not suit a
          class you attend every morning. A daily class with seven reminders
          would send over two hundred notifications a month.
          {profile?.role !== "admin" && " Only an admin can change these."}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-4 font-medium">Event kind</th>
                {LADDER.map((l) => (
                  <th key={l.minutes} className="px-2 py-2 text-center font-medium">{l.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {((rules ?? []) as Rule[]).map((rule) => (
                <tr key={rule.event_type}>
                  <td className="py-2 pr-4 text-stone-900">
                    {EVENT_TYPE_LABEL[rule.event_type as EventType]}
                  </td>
                  <td colSpan={LADDER.length + 1}>
                    <form action={saveRule} className="flex items-center gap-0">
                      <input type="hidden" name="event_type" value={rule.event_type} />
                      {LADDER.map((l) => (
                        <label key={l.minutes}
                          className="flex flex-1 justify-center px-2 py-2"
                          title={`${EVENT_TYPE_LABEL[rule.event_type as EventType]} — ${l.label} before`}>
                          <input type="checkbox" name="offsets" value={l.minutes}
                            defaultChecked={rule.offsets_minutes.includes(l.minutes)}
                            disabled={profile?.role !== "admin"}
                            className="h-4 w-4 rounded border-stone-300" />
                        </label>
                      ))}
                      {profile?.role === "admin" && (
                        <button className="ml-2 shrink-0 text-xs text-stone-500 hover:text-stone-900">
                          Save
                        </button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function shortenAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : "Device";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "browser";
  return `${os} — ${browser}`;
}
