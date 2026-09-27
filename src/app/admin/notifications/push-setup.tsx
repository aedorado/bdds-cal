"use client";

import { useEffect, useState } from "react";
import { saveSubscription, removeSubscription, sendTestNotification, setPrefs } from "./actions";

type State = "checking" | "unsupported" | "ios-not-installed" | "denied" | "off" | "on";

/** VAPID keys are base64url; PushManager wants raw bytes. */
function urlB64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** A subscription made with an older VAPID key will never receive anything. */
function matchesVapid(key: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(key);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return b64 === process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? "yes" : "NO — re-subscribe";
  } catch {
    return "could not compare";
  }
}

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports as Mac, distinguished only by touch support.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

export function PushSetup({ initialEnabled }: { initialEnabled: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [diag, setDiag] = useState<string[]>([]);
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Feature detection can only run in the browser, and every branch of it
    // resolves to exactly one state - so decide first, then set once.
    async function detect(): Promise<State> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On iOS these APIs do not exist at all until the site is installed.
        return isIos() && !isStandalone() ? "ios-not-installed" : "unsupported";
      }
      if (Notification.permission === "denied") return "denied";
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        return sub ? "on" : "off";
      } catch {
        return "unsupported";
      }
    }

    detect().then((next) => {
      if (!cancelled) setState(next);
    });

    // Brave disables Google's push service by default, so a subscription is
    // created successfully and then never receives anything. Worth saying out
    // loud rather than leaving someone to discover it.
    const brave = (navigator as Navigator & { brave?: { isBrave: () => Promise<boolean> } }).brave;
    brave?.isBrave().then((yes) => {
      if (!cancelled) setIsBrave(yes);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });

      const json = sub.toJSON();
      const result = await saveSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
        userAgent: navigator.userAgent,
      });

      if (result.error) {
        setMessage(result.error);
        return;
      }
      setState("on");
      setMessage("This device will now receive reminders.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not turn on notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await removeSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setMessage(null);
    setBusy(false);
  }

  /**
   * Shows a notification straight from the service worker, with no push
   * service involved. If this appears but a real push does not, the problem is
   * delivery. If this does not appear either, the browser or the OS is
   * suppressing notifications and no amount of server-side fixing will help.
   */
  async function testLocal() {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Local test — stays until you dismiss it", {
        body: "Shown by the service worker directly, bypassing push entirely.",
        icon: "/icon-192.png",
        tag: "local-test",
        // A banner disappears after a few seconds, which is easy to miss and
        // indistinguishable from "nothing happened". This one sticks around.
        requireInteraction: true,
      });

      const shown = await reg.getNotifications({ tag: "local-test" });
      const browser = isBrave ? "Brave" : "your browser";

      setMessage(
        shown.length === 0
          ? "The browser refused to show it — check this site's notification permission."
          : `${browser} created the notification and is holding it open. If you still see nothing ` +
            "on screen, it is macOS suppressing the display: check for an active Focus mode " +
            "(Control Centre, top-right), and look in Notification Centre by clicking the clock — " +
            "if it is sitting there, the notification worked and only the banner was hidden.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not show a local notification.");
    } finally {
      setBusy(false);
    }
  }

  async function runDiagnostics() {
    const lines: string[] = [];
    lines.push(`Permission: ${Notification.permission}`);
    lines.push(`Focus: ${document.hasFocus() ? "page focused (some browsers suppress banners)" : "page not focused"}`);

    const reg = await navigator.serviceWorker.getRegistration();
    lines.push(`Service worker: ${reg ? "registered" : "NOT registered"}`);
    if (reg) {
      lines.push(`  active: ${reg.active ? "yes" : "no"} · waiting: ${reg.waiting ? "yes" : "no"} · scope: ${reg.scope}`);
      const sub = await reg.pushManager.getSubscription();
      lines.push(`  subscription: ${sub ? "present" : "MISSING"}`);
      if (sub) {
        lines.push(`  endpoint host: ${new URL(sub.endpoint).host}`);
        const key = sub.options?.applicationServerKey;
        lines.push(`  key matches server: ${key ? matchesVapid(key) : "unknown"}`);
      }
      const open = await reg.getNotifications();
      lines.push(`Currently displayed notifications: ${open.length}`);
    }
    setDiag(lines);
  }

  async function test() {
    setBusy(true);
    const r = await sendTestNotification();
    setMessage(r.error ?? "Sent — it should appear in a second or two.");
    setBusy(false);
  }

  const card = "rounded-xl border border-stone-200 bg-white p-5";
  const button =
    "rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60";

  if (state === "checking") {
    return <div className={card}><p className="text-sm text-stone-500">Checking this device…</p></div>;
  }

  if (state === "ios-not-installed") {
    return (
      <div className={card}>
        <h2 className="text-sm font-semibold text-stone-900">One extra step on iPhone</h2>
        <p className="mt-2 text-sm text-stone-600">
          Apple only allows notifications once a site has been added to the Home
          Screen. In Safari, tap the <strong>Share</strong> button, choose{" "}
          <strong>Add to Home Screen</strong>, then open the Schedule icon from
          your Home Screen and come back to this page.
        </p>
        <p className="mt-3 text-xs text-stone-500">
          It must be Safari — Chrome and Firefox on iOS use Apple&apos;s engine and
          have the same restriction.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className={card}>
        <h2 className="text-sm font-semibold text-stone-900">Not available on this device</h2>
        <p className="mt-2 text-sm text-stone-600">
          This browser does not support notifications. Try Chrome or Firefox on
          Android or desktop, or Safari on an iPhone after adding this to your
          Home Screen.
        </p>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={card}>
        <h2 className="text-sm font-semibold text-stone-900">Notifications are blocked</h2>
        <p className="mt-2 text-sm text-stone-600">
          You (or this browser) blocked notifications for this site. Re-enable them
          in the browser&apos;s site settings — the padlock icon next to the address
          — then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <h2 className="text-sm font-semibold text-stone-900">This device</h2>

      {state === "off" ? (
        <>
          <p className="mb-4 mt-2 text-sm text-stone-600">
            Turn on reminders for flights, retreats and programmes. Each device
            is separate, so do this once on each phone or computer you use.
          </p>
          <button onClick={enable} disabled={busy} className={button}>
            {busy ? "Setting up…" : "Turn on notifications"}
          </button>
        </>
      ) : (
        <>
          <p className="mb-4 mt-2 text-sm text-stone-600">
            Reminders are on for this device.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={test} disabled={busy} className={button}>
              Send a test push
            </button>
            <button onClick={testLocal} disabled={busy}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">
              Test without push
            </button>
            <button onClick={runDiagnostics} disabled={busy}
              className="text-sm text-stone-500 hover:text-stone-900">
              Diagnostics
            </button>
            <button onClick={disable} disabled={busy}
              className="text-sm text-stone-500 hover:text-stone-900">
              Turn off on this device
            </button>
          </div>

          <label className="mt-5 flex items-center gap-2 border-t border-stone-100 pt-4 text-sm text-stone-700">
            <input type="checkbox" checked={enabled} className="h-4 w-4 rounded border-stone-300"
              onChange={async (e) => {
                setEnabled(e.target.checked);
                await setPrefs(e.target.checked);
              }} />
            Send me reminders (applies to all my devices)
          </label>
        </>
      )}

      {isBrave && (
        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <strong>Brave needs one extra setting.</strong> Open{" "}
          <code className="rounded bg-amber-100 px-1">brave://settings/privacy</code>, turn on{" "}
          <em>Use Google services for push messaging</em>, then restart Brave. Web push
          rides on Google&apos;s delivery service, which Brave switches off by default —
          without it a subscription is created but nothing is ever delivered. After
          restarting, turn notifications off and on again here to re-subscribe.
        </div>
      )}

      {message && <p className="mt-4 text-sm text-stone-600">{message}</p>}

      {diag.length > 0 && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-stone-900 p-3 text-xs leading-relaxed text-stone-100">
{diag.join("\n")}
        </pre>
      )}
    </div>
  );
}
