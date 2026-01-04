// =================================================================
// MirAi Service Worker V10 (Public Edition - Always Fresh)
// Chiến thuật: Network First (Ưu tiên tải mới)
// =================================================================

const CACHE_NAME = 'mirai-v10-public'; // Đổi tên để ép trình duyệt tải lại SW mới
const CACHE_ASSETS = [
    '/MirAi-project-/',
    'index.html',
    'reader.html',
    'list.html',
    'lore_hub.html',
    'css/style.css',
    'css/lore.css', // Nhớ thêm file này
    'js/script.js',
    'js/admin.js',
    'config.js',
    'manifest.json'
];

// 1. INSTALL: Cài đặt
self.addEventListener('install', event => {
    self.skipWaiting(); // Kích hoạt ngay lập tức
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(CACHE_ASSETS);
        })
    );
});

// 2. ACTIVATE: Xóa cache cũ
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            })
        ))
    );
    self.clients.claim(); // Chiếm quyền điều khiển ngay
});

// 3. FETCH: Chiến thuật Network First (Quan trọng nhất)
self.addEventListener('fetch', event => {
    const req = event.request;
    const url = new URL(req.url);

    // Bỏ qua các request không phải HTTP (như chrome-extension) hoặc API GitHub
    if (!url.protocol.startsWith('http') || url.hostname === 'api.github.com') {
        return;
    }

    // A. ĐỐI VỚI ẢNH & NHẠC (Nặng -> Dùng Cache First cho đỡ tốn 4G)
    if (req.destination === 'image' || req.destination === 'audio' || url.pathname.endsWith('.mp3')) {
        event.respondWith(
            caches.match(req).then(cachedResp => {
                return cachedResp || fetch(req).then(networkResp => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(req, networkResp.clone());
                        return networkResp;
                    });
                });
            })
        );
        return;
    }

    // B. ĐỐI VỚI HTML, CSS, JS, JSON (Quan trọng -> Network First)
    // Luôn thử tải từ mạng trước để lấy bản mới nhất
    event.respondWith(
        fetch(req).then(networkResp => {
            // Tải thành công -> Lưu vào cache để dành cho lần sau
            if (networkResp && networkResp.status === 200 && networkResp.type === 'basic') {
                const respClone = networkResp.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(req, respClone);
                });
            }
            return networkResp;
        }).catch(() => {
            // Mất mạng hoặc lỗi server -> Dùng Cache cũ
            return caches.match(req);
        })
    );
});
