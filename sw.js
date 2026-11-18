// Progressio - service worker
// Funziona offline: serve i file dalla cache e li aggiorna in background,
// quindi una nuova versione caricata su GitHub compare alla seconda apertura.
const CACHE = 'dp-v5';
const CORE = ['./', './index.html', './manifest.webmanifest', './config.js', './vendor/msal-browser.min.js',
  './js/main.js', './js/store.js', './js/engine.js', './js/views.js', './js/workout.js', './js/timer.js', './js/charts.js', './js/sync.js', './js/io.js', './js/util.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response('Offline', { status: 503, statusText: 'Offline' });
  }));
});
