const CACHE_NAME = "rkm-app-v7";
const FILES_TO_CACHE = [
  "./index.html",
  "./patient-list.html",
  "./patient.html",
  "./clinical-note.html",
  "./ward.html",
  "./ward-list.html",
  "./diagnostic.html",
  "./enhancement.html",
  "./manifest.json",
  "./public/assets/css/modern-theme.css",
  "./public/assets/js/icons.js",
  "./public/assets/icons/icon-180.png",
  "./public/assets/icons/icon-192.png",
  "./public/assets/icons/icon-512.png",
  "./public/assets/icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const file of FILES_TO_CACHE) {
      try { await cache.add(file); } catch (err) { console.warn("[RKM SW] skip cache", file, err); }
    }
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for app files (so updates show immediately), cache fallback when offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isApp = url.pathname.endsWith("/") || FILES_TO_CACHE.some((f) => url.pathname.endsWith(f.replace("./", "/")));
  if (!isApp) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match("./index.html")))
  );
});
