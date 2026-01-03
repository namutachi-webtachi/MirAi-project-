// =================================================================
// MirAi Service Worker V9 (Hybrid Strategy - God Tier)
// =================================================================

const CACHE_VERSION = 'mirai-v9-god-tier';
const CACHE_STATIC = `static-${CACHE_VERSION}`;
const CACHE_IMAGES = `images-${CACHE_VERSION}`;
const CACHE_PAGES = `pages-${CACHE_VERSION}`;

// Danh sách file cốt lõi cần tải ngay lập tức
const CORE_ASSETS = [
    '/MirAi-project-/',
    'index.html',
    'reader.html',
    'css/style.css',
    'css/admin.css',
    'js/script.js',
    'js/admin.js',
    'config.js',
    'manifest.json'
];

// 1. INSTALL: Cài đặt và cache file cốt lõi
self.addEventListener('install', event => {
    self.skipWaiting(); // Kích hoạt ngay, không chờ
    event.waitUntil(
        caches.open(CACHE_STATIC).then(cache => cache.addAll(CORE_ASSETS))
    );
});

// 2. ACTIVATE: Dọn dẹp cache cũ
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (![CACHE_STATIC, CACHE_IMAGES, CACHE_PAGES].includes(key)) {
                    return caches.delete(key);
                }
            })
        ))
    );
    self.clients.claim();
});

// 3. FETCH: Bộ điều hướng thông minh (The Brain)
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // 🛑 BỎ QUA: Chrome Extension, API GitHub, và Admin Panel (để luôn update)
    if (!url.protocol.startsWith('http') || 
        url.hostname === 'api.github.com' || 
        url.pathname.includes('admin.html')) {
        return; 
    }

    // 🎯 CHIẾN THUẬT 1: ẢNH & NHẠC -> CACHE FIRST (Tải 1 lần dùng mãi)
    if (req.destination === 'image' || req.destination === 'audio' || url.pathname.endsWith('.mp3')) {
        event.respondWith(
            caches.open(CACHE_IMAGES).then(async cache => {
                const cachedResponse = await cache.match(req);
                if (cachedResponse) return cachedResponse;
                const networkResponse = await fetch(req);
                cache.put(req, networkResponse.clone());
                return networkResponse;
            })
        );
        return;
    }

    // 🎯 CHIẾN THUẬT 2: CSS/JS/FONTS -> STALE-WHILE-REVALIDATE (Hiện cũ, tải mới ngầm)
    if (req.destination === 'style' || req.destination === 'script' || req.destination === 'font') {
        event.respondWith(
            caches.open(CACHE_STATIC).then(async cache => {
                const cachedResponse = await cache.match(req);
                const fetchPromise = fetch(req).then(networkResponse => {
                    cache.put(req, networkResponse.clone());
                    return networkResponse;
                });
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 🎯 CHIẾN THUẬT 3: HTML (TRANG WEB) -> NETWORK FIRST (Ưu tiên mới nhất)
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).then(networkResponse => {
                return caches.open(CACHE_PAGES).then(cache => {
                    cache.put(req, networkResponse.clone());
                    return networkResponse;
                });
            }).catch(() => {
                return caches.match(req) || caches.match('index.html'); // Offline thì về trang chủ
            })
        );
        return;
    }
});
