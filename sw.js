// sw.js - Phiên bản "Network First" cho dữ liệu
const CACHE_NAME = 'mirai-v6-fix-scheduler'; // Đổi tên để ép trình duyệt xóa cache cũ

// Những file tĩnh (ít thay đổi) -> Cache chặt để load nhanh
const STATIC_ASSETS = [
    '/MirAi-project-/',
    'index.html',
    'reader.html',
    'css/style.css',
    'config.js',
    'manifest.json',
    'images/icons/icon-192x192.png'
];

// 1. Cài đặt Service Worker
self.addEventListener('install', event => {
    self.skipWaiting(); // Kích hoạt ngay lập tức, không chờ
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. Kích hoạt và Xóa cache cũ
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Xóa cache cũ:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Xử lý tải dữ liệu (QUAN TRỌNG NHẤT)
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // NẾU LÀ FILE DỮ LIỆU (data.json, script.js, html) -> ƯU TIÊN MẠNG (Network First)
    // Để đảm bảo luôn thấy chương mới và logic hẹn giờ đúng
    if (url.pathname.endsWith('data.json') || url.pathname.endsWith('script.js') || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Tải được từ mạng -> Lưu bản mới vào cache -> Trả về
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedResponse));
                    return response;
                })
                .catch(() => {
                    // Mất mạng -> Mới dùng cache cũ
                    return caches.match(event.request);
                })
        );
    } 
    // NẾU LÀ ẢNH, FONT, CSS -> ƯU TIÊN CACHE (Cache First) cho nhanh
    else {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});
