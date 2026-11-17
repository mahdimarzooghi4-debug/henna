/* HANA PWA: network-only; no caching of account, personal or payment data. */
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", event => {
  if (event.request.method === "GET" && event.request.mode === "navigate" &&
      new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request));
  }
});
