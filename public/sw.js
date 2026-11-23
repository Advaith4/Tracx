self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {
    title: "Tracx Check-in",
    body: "Your scheduled health check-in is due.",
    url: "/log",
  };

  try {
    const parsed = event.data.json();
    payload = {
      title: parsed.title || payload.title,
      body: parsed.body || payload.body,
      url: parsed.url || payload.url,
    };
  } catch {
    // Fallback to privacy-safe default copy.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/log";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
