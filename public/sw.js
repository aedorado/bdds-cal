/* Service worker for web push. Kept deliberately small - it runs detached from
   the app and there is no way to debug it comfortably. */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Schedule update", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Schedule update", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces an earlier notification for the same occurrence
      // instead of stacking three of them on the lock screen.
      tag: payload.tag,
      renotify: false,
      data: { url: payload.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/admin";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Focus an already-open tab rather than piling up new ones.
      for (const client of windows) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      if (windows.length > 0 && "navigate" in windows[0]) {
        return windows[0].navigate(target).then((c) => c && c.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
