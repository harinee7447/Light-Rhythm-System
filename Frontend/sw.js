/* =====================================================
   LIGHT RHYTHM MANAGEMENT SYSTEM
   Progressive Web App - Service Worker (sw.js)
   Cache Version: light-rhythm-v1.1
   ===================================================== */

const CACHE_NAME = 'light-rhythm-v1.1';
const API_CACHE_NAME = 'light-rhythm-api-v1.1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/mini.html',
  '/static/style.css',
  '/static/script.js',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PWA Service Worker] Precaching app shell assets');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[PWA Service Worker] Non-fatal precache asset notice:', err);
      });
    })
  );
});

// Activate: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            console.log('[PWA Service Worker] Removing obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    return;
  }

  // 1. Google Fonts: Cache First (1 year expiration)
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkRes = await fetch(request);
          if (networkRes && networkRes.status === 200) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          return cached || new Response('', { status: 408, statusText: 'Font offline' });
        }
      })
    );
    return;
  }

  // 2. API Endpoints: Network First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(API_CACHE_NAME).then((apiCache) => {
              apiCache.put(request, clone);
            });
          }
          return networkRes;
        })
        .catch(async () => {
          // Network failed: attempt to serve last successful cached API response
          const cached = await caches.match(request);
          if (cached) {
            console.log('[PWA Service Worker] Serving cached API response for:', url.pathname);
            return cached;
          }

          // Structured offline response for dashboard or current brightness
          if (url.pathname === '/api/brightness/current') {
            return new Response(
              JSON.stringify({
                current_mode: 'Day',
                brightness_pct: 75,
                period: 'DAY',
                symbol: '☀',
                description: 'Offline Mode: Default Circadian Synchrony',
                is_automatic: true,
                current_time: new Date().toLocaleTimeString(),
                active_schedule_name: 'Offline Default',
                offline: true,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (url.pathname === '/api/dashboard') {
            return new Response(
              JSON.stringify({
                current_mode: 'Day',
                brightness_pct: 75,
                symbol: '☀',
                greeting: 'day',
                day_period: 'DAY',
                current_time: new Date().toLocaleTimeString(),
                today_date: new Date().toLocaleDateString(),
                schedules: [],
                recent_history: [],
                stats: {
                  schedules_count: 3,
                  routines_count: 3,
                  history_count: 0,
                  morning_level: 60,
                  day_level: 75,
                  night_level: 25,
                },
                offline: true,
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ offline: true, detail: 'Offline Mode: Network unavailable.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 3. Static Assets & App Shell: Stale-While-Revalidate / Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is an HTML page navigation, fallback to /index.html
          if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
