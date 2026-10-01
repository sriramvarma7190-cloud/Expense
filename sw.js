// Ledger offline shell. Bump CACHE_V with each release so the old cache is dropped.
const CACHE_V = '16.1';
const CACHE = 'ledger-' + CACHE_V;
// a background refresh must not repopulate the cache we just flushed
let flushAt = 0;
const mayCache = () => Date.now() - flushAt > 5000;

const SHELL = ['./', './index.html', './manifest.json',
               './icon-180.png', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL))
    .then(() => self.skipWaiting())
    .catch(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  // anything off this origin — Firebase, rate lookups, bank logos — goes straight out
  if (url.origin !== location.origin) return;
  // the version check and the Update button must always see the real file
  if (url.searchParams.has('probe') || url.searchParams.has('v')) return;

  if (req.mode === 'navigate') {
    // serve instantly from cache, refresh it in the background for next launch
    e.respondWith(caches.match('./index.html').then(hit => {
      const net = fetch('./index.html').then(r => {
        if (r && r.ok && mayCache()) caches.open(CACHE).then(c => c.put('./index.html', r.clone()));
        return r;
      }).catch(() => null);
      return hit || net.then(r => r || new Response('Offline', {status: 503}));
    }));
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && r.ok && r.type === 'basic' && mayCache()) caches.open(CACHE).then(c => c.put(req, r.clone()));
    return r;
  }).catch(() => hit)));
});

// the app asks for this before a forced update, so the next launch is clean
self.addEventListener('message', e => {
  if (e.data === 'flush') {
    flushAt = Date.now();
    caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))));
  }
});
