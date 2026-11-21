/* Breach Escape service worker: caches the app so it works offline.
   Bump VERSION whenever you deploy changes so players get the new files. */
const VERSION = 'v42';
const CACHE = 'breach-escape-' + VERSION;
const FILES = [
  './', 'index.html', 'theme-init.js', 'theme.css', 'levels.js', 'app.js', 'case.js', 'levels/midnight-blizzard.json', 'levels/colonial-pipeline.json', 'levels/uber-2022.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'icons/icon.svg', 'icons/favicon.svg', 'icons/favicon-32.png', 'brand/kept-mark.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('breach-escape-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GET only. Network first, so updates show up; cache as the offline fallback.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
