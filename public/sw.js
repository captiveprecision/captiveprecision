const SW_VERSION = "cp-pwa-v4";
const STATIC_CACHE = `${SW_VERSION}-static`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const IMAGE_CACHE = `${SW_VERSION}-images`;
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon.png",
  "/apple-icon.png",
  "/brand/logo-mark.png",
  "/brand/logo-primary.png",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/maskable-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin;
}

function canCacheResponse(response) {
  if (!response || !response.ok) {
    return false;
  }

  return response.type === "basic" || response.type === "default";
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (canCacheResponse(response)) {
        const cloned = response.clone();
        caches.open(PAGE_CACHE).then((cache) => cache.put(request, cloned));
      }

      return response;
    })
    .catch(async () => {
      const cached = await caches.match(request);

      if (cached) {
        return cached;
      }

      return caches.match(OFFLINE_URL);
    });
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }

    return fetch(request).then((response) => {
      if (canCacheResponse(response)) {
        const cloned = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, cloned));
      }

      return response;
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((cached) => {
    const networkResponse = fetch(request).then((response) => {
      if (canCacheResponse(response)) {
        const cloned = response.clone();
        caches.open(IMAGE_CACHE).then((cache) => cache.put(request, cloned));
      }

      return response;
    });

    return cached || networkResponse;
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (!isSameOrigin(request.url)) {
    return;
  }

  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.png" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/pwa/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    request.destination === "image" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp")
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

