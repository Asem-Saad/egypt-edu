/* Offline support: cache the app files, serve from network when online, from cache when offline. */
const VERSION = 'arab-trip-v4';
const FILES = ['./', 'index.html', 'css/style.css', 'icon.svg', 'manifest.webmanifest', 'fonts/fonts.css', 'fonts/baloo-arabic.woff2', 'fonts/baloo-latin.woff2', 'js/data/map.js', 'js/vendor/supabase.js', 'js/account.js', 'js/cloud.js', 'js/core.js', 'js/games.js', 'js/custom.js',
  'js/lessons/l1.js', 'js/lessons/l2.js', 'js/lessons/l3.js', 'js/lessons/l4.js', 'js/auth-pages.js', 'js/staff-pages.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/__') || !e.request.url.startsWith(self.location.origin)) return;   // never cache the online database   // launcher heartbeat is never cached
  // network first (always fresh when online), cache as fallback (works offline)
  e.respondWith(fetch(e.request).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(h => h || caches.match('index.html'))));
});
