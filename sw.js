const CACHE_NAME = 'desk-health-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/audio.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache files individually so a missing icon doesn't crash the service worker
      await Promise.allSettled(
        ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset);
            if (!res.ok) {
              console.warn(`[SW] Failed to fetch: ${asset} (status: ${res.status})`);
              return;
            }
            await cache.put(asset, res);
          } catch (err) {
            console.warn(`[SW] Network error caching: ${asset}`, err);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NOTIFY') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: event.data.id || 'health-reminder',
      renotify: true
    });
  }
});
