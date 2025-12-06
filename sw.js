const CACHE_NAME = 'mirai-project-cache-v1';
const urlsToCache = [
  '/',
  '/MirAi-project-/',
  '/MirAi-project-/index.html',
  '/MirAi-project-/reader.html',
  '/MirAi-project-/css/style.css',
  '/MirAi-project-/js/script.js',
  '/MirAi-project-/config.js',
  '/MirAi-project-/data.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Trả về từ cache nếu có
        }
        return fetch(event.request); // Nếu không, fetch từ mạng
      }
    )
  );
});
