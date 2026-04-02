// JobKernel Service Worker — handles PWA installability and share target routing
const CACHE_NAME = 'jobkernel-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle share target: Android sends to /capture?url=...&text=...&title=...
  // We redirect to the hash-based route the SPA uses: /?url=...&text=...#capture
  if (url.pathname === '/capture') {
    const params = url.searchParams.toString();
    const redirectUrl = `/${params ? '?' + params : ''}#capture`;
    event.respondWith(Response.redirect(redirectUrl, 303));
    return;
  }

  // All other requests pass through to the network
  return;
});
