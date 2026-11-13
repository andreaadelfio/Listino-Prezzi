const CACHE_NAME = "listino-prezzi-shell-v10";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/app.js",
  "./assets/config.js",
  "./assets/cart-icon.svg",
  "./assets/app/constants.js",
  "./assets/app/groups.js",
  "./assets/app/store.js",
  "./assets/app/utils.js",
  "./assets/app/receipt.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const shouldHandle =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.webmanifest") ||
    url.pathname.endsWith("/service-worker.js") ||
    url.pathname.startsWith(`${new URL(self.registration.scope).pathname}assets/`);

  if (!shouldHandle) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = new Request(url.origin + url.pathname, { method: "GET" });
    const cachedResponse = await cache.match(cacheKey);

    try {
      // "no-cache": il browser ricontrolla col server (304 se uguale) invece di usare una copia
      // vecchia dalla sua cache; i moduli di assets/app/ non hanno ?v= e devono essere tutti della
      // stessa versione. Le richieste di navigazione non si possono copiare con altre opzioni.
      const networkResponse = await fetch(request.mode === "navigate" ? request : new Request(request, { cache: "no-cache" }));
      if (networkResponse.ok) {
        await cache.put(cacheKey, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  })());
});
