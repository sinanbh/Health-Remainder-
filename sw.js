const CACHE_NAME = 'desk-health-v3';
const ASSETS = [
  '/Health-Remainder-/',
  '/Health-Remainder-/index.html',
  '/Health-Remainder-/css/style.css',
  '/Health-Remainder-/js/audio.js',
  '/Health-Remainder-/js/app.js',
  '/Health-Remainder-/manifest.json',
  '/Health-Remainder-/icons/icon-192.png',
  '/Health-Remainder-/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
