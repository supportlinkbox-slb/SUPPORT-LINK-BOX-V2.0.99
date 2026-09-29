// Service worker cleaned / Ad scripts disabled
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});
