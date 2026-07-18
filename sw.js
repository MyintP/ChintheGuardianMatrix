const CACHE = "chinthe-v12";
const SHELL = [
  "./",
  "./index.html",
  "./chinthe-guardian-matrix.html",
  "./competition.html",
  "./knowledge.html",
  "./journal.html",
  "./principles.html",
  "./chinthe.css",
  "./chinthe.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./chinthe-lion.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    // cache:"reload" bypasses the HTTP cache so a new SW version never precaches stale files
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
