const CACHE = "trainalert-shell-v1";
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["/"]))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))));
});
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "Seats available", {
    body: data.body || "A seat matching your watch is open.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: data.targetId || "trainalert",
    renotify: true,
    requireInteraction: true,
    data: { targetId: data.targetId },
    actions: [
      { action: "book", title: "Book now" },
      { action: "end", title: "End alert" },
    ],
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.targetId;
  const suffix = event.action ? `action=${event.action}&target=${encodeURIComponent(target)}` : `notification=${encodeURIComponent(target)}`;
  event.waitUntil(clients.openWindow(`/#${suffix}`));
});
