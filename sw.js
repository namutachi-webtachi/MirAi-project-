// =================================================================
// MirAi Service Worker V7 (Network First - Fix Cache Loop)
// =================================================================

const CACHE_NAME = 'mirai-v7-nuke-cache'; // Đổi tên để ép xóa cache cũ
const URLS_TO_CACHE = [
    '/MirAi-project-/',
    'index.html',
    'reader.html',
    'css/style.css',
    'js/script.js',
    'config.js',
    'manifest.json'
];

// 1. Cài đặt và kích hoạt ngay lập tức
self.addEventListener('install', event => {
    self.skipWaiting(); // Bắt buộc SW mới chạy ngay, không chờ
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Opened cache');
            return cache.addAll(URLS_TO_CACHE);
        })
    );
});

// 2. Xóa sạch các bản Cache cũ khi kích hoạt
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Đang xóa cache cũ:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Chiếm quyền điều khiển ngay lập tức
});

// 3. Chiến thuật: NETWORK FIRST (Ưu tiên mạng)
// Luôn tải từ mạng trước. Nếu có mạng -> Lưu bản mới vào cache -> Trả về cho người dùng.
// Chỉ khi mất mạng -> Mới lấy từ Cache.
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Tải thành công -> Copy vào cache để dùng cho lần sau
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // Mất mạng hoặc lỗi server -> Dùng cache
                return caches.match(event.request);
            })
    );
});
