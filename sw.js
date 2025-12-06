const CACHE_NAME = 'mirai-v5-safe';
// Chỉ cache những file cốt lõi chắc chắn có
const urls = [
    '/MirAi-project-/',
    'index.html',
    'reader.html',
    'css/style.css',
    'js/script.js',
    'config.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Dùng map để add từng file, lỗi file nào bỏ qua file đó chứ không crash cả lũ
            return Promise.all(
                urls.map(url => {
                    return cache.add(url).catch(error => {
                        console.warn('Không thể cache file:', url, error);
                    });
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
