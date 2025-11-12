
const CACHE_VERSION = 'v1';
const TILE_CACHE = `map-tiles-${CACHE_VERSION}`;

// Patterns to match tile requests
const TILE_PATTERNS = [
  /api\.mapbox\.com\/styles/,
  /tile\.openstreetmap\.org/,
  /basemaps\.cartocdn\.com/,
  /nominatim\.openstreetmap\.org/ // Cache geocoding requests too
];

// Check if request is a tile request
function isTileRequest(url) {
  return TILE_PATTERNS.some(pattern => pattern.test(url));
}


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

// Fetch event - intercept and cache tile requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Handle tile requests with cache-first strategy
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached tile immediately
            return cachedResponse;
          }

          // Fetch from network and cache
          return fetch(request).then((response) => {
            // Only cache successful responses
            if (response && response.status === 200) {
              // Clone response before caching (can only read once)
              cache.put(request, response.clone());
            }
            return response;
          }).catch((error) => {
            console.error('[SW] Fetch failed for:', url, error);
            // Could return a placeholder tile here
            throw error;
          });
        });
      })
    );
  }
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