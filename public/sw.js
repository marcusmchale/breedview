
const CACHE_VERSION = 'v1';
const TILE_CACHE = `map-tiles-${CACHE_VERSION}`;


// Install event - prepare caches
self.addEventListener('install', () => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('map-tiles-') && name !== TILE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  const shouldCache =
    url.hostname === 'api.mapbox.com' ||
    url.hostname.endsWith('.tiles.mapbox.com') ||
    url.hostname === 'tile.openstreetmap.org' ||
    url.hostname === 'basemaps.cartocdn.com' ||
    url.hostname === 'nominatim.openstreetmap.org';

  if (!shouldCache) return;

  event.respondWith(
    caches.open(TILE_CACHE).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        });
      });
    })
  );
});

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_TILE_CACHE') {
    event.waitUntil(
      caches.delete(TILE_CACHE).then(() => {
        console.log('[SW] Tile cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      caches.open(TILE_CACHE).then(async (cache) => {
        const keys = await cache.keys();
        event.ports[0].postMessage({
          success: true,
          size: keys.length
        });
      })
    );
  }
});