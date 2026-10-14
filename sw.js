const CACHE = "chinthe-v35";
const SHELL = [
  "./",
  "./index.html",
  "./chinthe-guardian-matrix.html",
  "./competition.html",
  "./knowledge.html",
  "./encyclopedia.js",
  "./journal.html",
  "./gameplan.html",
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

function putInCache(req, resp) {
  if (resp && resp.status === 200 && req.url.startsWith(self.location.origin)) {
    const clone = resp.clone();
    caches.open(CACHE).then(c => c.put(req, clone));
  }
  return resp;
}

// Pages, scripts, styles and data: network first, so a deploy shows up on the
// very next load (cache-first kept returning visitors one version behind).
// "no-cache" revalidates past GitHub Pages' 10-minute HTTP cache via ETag.
// Offline, the cached copy is served instead.
function isCode(req, url) {
  return req.mode === "navigate" || /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.endsWith("/");
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin && isCode(e.request, url)) {
    e.respondWith(
      // By URL: a navigate-mode Request can't be re-initialised with options
      fetch(url.href, { cache: "no-cache", credentials: "same-origin" })
        .then(resp => putInCache(e.request, resp))
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }
  // Images and fonts rarely change: cache first, refresh in the background.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(resp => putInCache(e.request, resp)).catch(() => cached);
      return cached || network;
    })
  );
});
