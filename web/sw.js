// AirMesh Service Worker
const CACHE_NAME = 'airmesh-v1';
const STATIC_ASSETS = ['/', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Let API requests pass straight through to server (never cache dynamic APIs or file transfers!)
  if (e.request.url.includes('/api/') || e.request.url.includes('/ws')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
