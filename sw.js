

const APP_CACHE_NAME = 'cogniflow-app-v5';
const CDN_CACHE_NAME = 'cogniflow-cdn-v4';
const SHARE_CACHE_NAME = 'cogniflow-share-target';

const appUrlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icon.svg',
];

const cdnUrlsToCache = [
    'https://cdn.tailwindcss.com',
    'https://esm.sh/jszip@3.10.1?dev',
    'https://esm.sh/sql.js@1.10.3?dev',
    'https://esm.sh/sql.js@1.10.3/dist/sql-wasm.wasm',
    'https://esm.sh/canvas-confetti@1.9.3?dev',
    'https://esm.sh/zustand@4.5.2/?dev&external=react',
    'https://esm.sh/@google/genai?dev',
    'https://esm.sh/react@18.3.1?dev',
    'https://esm.sh/react@18.3.1/jsx-runtime?dev',
    'https://esm.sh/react-dom@18.3.1/client?dev'
];

// On install, pre-cache the main application shell and critical CDN files.
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(APP_CACHE_NAME).then(cache => {
        console.log('Opened app cache');
        return cache.addAll(appUrlsToCache);
      }),
      caches.open(CDN_CACHE_NAME).then(cache => {
        console.log('Opened CDN cache');
        return cache.addAll(cdnUrlsToCache);
      })
    ])
  );
});


// On activation, clean up old, unused caches.
self.addEventListener('activate', event => {
  const cacheWhitelist = [APP_CACHE_NAME, CDN_CACHE_NAME, SHARE_CACHE_NAME];
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
  const url = new URL(event.request.url);

  // --- Share Target Handler ---
  // Intercept POST requests from the system share sheet
  if (event.request.method === 'POST' && url.pathname === '/share-target/') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');
        const title = formData.get('title');
        const text = formData.get('text');
        const sharedUrl = formData.get('url');

        const cache = await caches.open(SHARE_CACHE_NAME);

        // If a file was shared, store it
        if (file && file instanceof File) {
          await cache.put('shared-file', new Response(file, {
            headers: { 'Content-Type': file.type, 'X-File-Name': file.name }
          }));
        }

        // If text was shared, store it as a JSON blob
        if (title || text || sharedUrl) {
          const data = { title, text, url: sharedUrl };
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          await cache.put('shared-data', new Response(blob));
        }

        // Redirect the user back to the main app to process the data
        return Response.redirect('/', 303);
      } catch (err) {
        console.error('Share target failed', err);
        return Response.redirect('/', 303);
      }
    })());
    return;
  }

  // --- Standard Fetch Handling ---
  
  // We only care about GET requests for caching
  if (event.request.method !== 'GET') {
    return;
  }

  const isCdnUrl = url.origin === 'https://esm.sh' || url.origin === 'https://cdn.tailwindcss.com' || url.origin === 'https://aistudiocdn.com';

  if (isCdnUrl) {
    // Strategy: Cache First, then Network for CDN resources
    event.respondWith(
      caches.open(CDN_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
  } else {
    // Strategy: Cache first, falling back to network for app resources.
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) return response;
        return fetch(event.request).then(fetchResponse => {
          if (fetchResponse && fetchResponse.status === 200 && fetchResponse.type === 'basic') {
             return caches.open(APP_CACHE_NAME).then(cache => {
                cache.put(event.request, fetchResponse.clone());
                return fetchResponse;
            });
          }
          return fetchResponse;
        }).catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
  }
});

// Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type) {
    if (event.data.type === 'CLEAR_APP_CACHE') {
      caches.delete(APP_CACHE_NAME).then(() => console.log('App Cache cleared.'));
    }
    if (event.data.type === 'CLEAR_CDN_CACHE') {
      caches.delete(CDN_CACHE_NAME).then(() => console.log('CDN Cache cleared.'));
    }
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'check-due-cards') {
    event.waitUntil(checkDueCardsAndNotify());
  }
});

async function checkDueCardsAndNotify() {
  // We can't import the full app DB logic here easily due to bundling constraints.
  // Instead, we perform a lightweight check using raw IndexedDB if notifications are enabled.
  // Note: 'window' is not available in SW, so we use 'self.indexedDB'.
  
  // Checking permissions in SW context isn't always reliable across browsers, 
  // but if we are here, we likely have permission or the sync wouldn't be useful for notifications.
  if (self.Notification && self.Notification.permission === 'granted') {
      try {
          const dbRequest = self.indexedDB.open('CogniFlowDB', 8);
          dbRequest.onsuccess = (e) => {
              const db = e.target.result;
              const transaction = db.transaction(['decks'], 'readonly');
              const store = transaction.objectStore('decks');
              const request = store.getAll();
              request.onsuccess = () => {
                  const decks = request.result || [];
                  const today = new Date();
                  today.setHours(23, 59, 59, 999);
                  
                  let totalDue = 0;
                  decks.forEach(deck => {
                      const items = deck.cards || deck.questions || [];
                      const due = items.filter(item => !item.suspended && new Date(item.dueDate) <= today).length;
                      totalDue += due;
                  });

                  if (totalDue > 0) {
                      self.registration.showNotification('CogniFlow - Time to Study!', {
                          body: `You have ${totalDue} card${totalDue !== 1 ? 's' : ''} due for review today.`,
                          icon: '/assets/icon.svg',
                          tag: 'due-cards'
                      });
                  }
                  db.close();
              };
          };
      } catch (err) {
          console.error('Failed to check DB in background sync', err);
      }
  }
}
