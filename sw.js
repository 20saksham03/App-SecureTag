const CACHE_NAME = 'securetag-v1.0.0';
const OFFLINE_URL = '/index.html';

// Files to cache for offline functionality
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js'
];

// Install event - cache files
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching offline page');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  console.log('[ServiceWorker] Fetch', event.request.url);
  
  // Handle API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return offline response for API calls
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'App is offline. Please check your connection.',
              timestamp: new Date().toISOString()
            }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
        })
    );
    return;
  }
  
  // Handle page requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.open(CACHE_NAME)
            .then((cache) => {
              return cache.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // Handle other requests (images, scripts, etc.)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // If both cache and network fail, return a fallback
        if (event.request.destination === 'image') {
          return new Response(
            '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#666">Image unavailable</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      })
  );
});

// Background sync for offline QR code scans
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync', event.tag);
  
  if (event.tag === 'qr-sync') {
    event.waitUntil(
      // Sync offline QR scans when connection is restored
      syncOfflineQRScans()
    );
  }
});

// Push notifications for verification results
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received', event);
  
  const options = {
    body: event.data ? event.data.text() : 'QR code verification complete',
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/manifest.json'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/manifest.json'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('SecureTag', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Function to sync offline QR scans
async function syncOfflineQRScans() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const offlineScans = await cache.match('/offline-scans');
    
    if (offlineScans) {
      const scans = await offlineScans.json();
      
      // Process each offline scan
      for (const scan of scans) {
        try {
          const response = await fetch('/api/verify-qr', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ qrCode: scan.qrCode })
          });
          
          if (response.ok) {
            console.log('[ServiceWorker] Synced offline scan:', scan.qrCode);
          }
        } catch (error) {
          console.error('[ServiceWorker] Failed to sync scan:', error);
        }
      }
      
      // Clear offline scans after syncing
      await cache.delete('/offline-scans');
    }
  } catch (error) {
    console.error('[ServiceWorker] Background sync failed:', error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_QR_SCAN') {
    // Cache offline QR scan
    caches.open(CACHE_NAME).then((cache) => {
      const offlineScans = [event.data.qrCode];
      cache.put('/offline-scans', new Response(JSON.stringify(offlineScans)));
    });
  }
});

console.log('[ServiceWorker] Service Worker loaded and ready!');
