// Simple service worker to handle development environment issues
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Intercept fetch requests and handle chrome-extension scheme
self.addEventListener('fetch', (event) => {
  // Skip caching for chrome-extension URLs
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Handle other requests normally
  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback for offline scenarios
      return new Response('Offline', { status: 503 });
    })
  );
});