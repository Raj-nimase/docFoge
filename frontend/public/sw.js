const CACHE_NAME = 'acadoc-pro-cache-v1';

// Assets to cache during service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests and http/https schemes
  if (request.method !== 'GET' || (!request.url.startsWith(self.location.origin) && !request.url.startsWith('https://'))) {
    return;
  }

  // Skip backend API calls or exports
  if (url.pathname.startsWith('/api') || url.pathname.includes('/health')) {
    return;
  }

  // Navigation requests: Network-First strategy (fallback to index.html from cache)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          console.log('[Service Worker] Serving index.html from cache for navigation');
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // Assets and other requests: Stale-While-Revalidate caching strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Cache the response if it's successful (status 200)
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[Service Worker] Fetch failed for:', request.url, err);
        return null;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
