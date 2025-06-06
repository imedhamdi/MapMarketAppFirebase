const CACHE_NAME = 'mapmarket-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/firebase-messaging-sw.js',
  '/js/main.js',
  '/js/firebase.js',
  '/js/auth.js',
  '/js/ad-manager.js',
  '/js/chat.js',
  '/js/map.js',
  '/js/services.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/utils.js',
  '/favicon.ico',
  '/avatar-default.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
