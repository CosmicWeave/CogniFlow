const APP_CACHE_NAME = 'cogniflow-app-v1';
const CDN_CACHE_NAME = 'cogniflow-cdn-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

// On install, pre-cache the main application shell files.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then(cache => {
        console.log('Opened app cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// On activation, clean up old, unused caches.
self.addEventListener('activate', event => {
  const cacheWhitelist = [APP_CACHE_NAME, CDN_CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // We only care about GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  const isCdnUrl = url.origin === 'https://esm.sh' || url.origin === 'https://cdn.tailwindcss.com';

  if (isCdnUrl) {
    // Strategy: Stale-while-revalidate for CDN resources.
    // Serve from cache immediately for speed, but fetch an update in the background.
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            console.warn('CDN fetch failed, relying on cache.', error);
          });
          // Return cached version first, then update in background.
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // Strategy: Cache first, falling back to network for app resources.
    event.respondWith(
      caches.match(event.request).then(response => {
        // If we have a cached response, serve it immediately.
        if (response) {
          return response;
        }
        
        // Otherwise, fetch from the network.
        return fetch(event.request).then(fetchResponse => {
          // If the fetch is successful, cache the response for future offline use.
          if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
             return caches.open(APP_CACHE_NAME).then(cache => {
                cache.put(event.request, fetchResponse.clone());
                return fetchResponse;
            });
          }
          return fetchResponse;
        }).catch(() => {
          // If the network fetch fails (e.g., offline) and it's a navigation request,
          // serve the main app page as a fallback. This is crucial for SPA functionality.
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

// Listen for messages from the client to perform actions like clearing caches.
self.addEventListener('message', event => {
  if (event.data && event.data.type) {
    if (event.data.type === 'CLEAR_APP_CACHE') {
      console.log('Clearing App Cache:', APP_CACHE_NAME);
      caches.delete(APP_CACHE_NAME).then(() => {
        console.log('App Cache cleared.');
      });
    }
    if (event.data.type === 'CLEAR_CDN_CACHE') {
      console.log('Clearing CDN Cache:', CDN_CACHE_NAME);
      caches.delete(CDN_CACHE_NAME).then(() => {
        console.log('CDN Cache cleared.');
      });
    }
  }
});
