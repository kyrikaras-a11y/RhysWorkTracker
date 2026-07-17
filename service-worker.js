const CACHE_NAME = 'trades-app-shell-v23';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/jobs.js',
  './js/timesheets.js',
  './js/expenses.js',
  './js/contractors.js',
  './js/assets.js',
  './js/gst.js',
  './js/dashboard.js',
  './js/eofy.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// App shell: cache-first. API calls to Apps Script: always network (never cache live data).
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('script.google.com')) {
    return; // let API calls go straight to network
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
