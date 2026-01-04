// =================================================================
// MIRAI PROJECT - CORE SCRIPT V8.0 (EXPLICIT LOGIC)
// Phương châm: Tách biệt logic, không gộp chung, đảm bảo ổn định.
// =================================================================

// --- 1. CẤU HÌNH & TIỆN ÍCH CHUNG (SHARED) ---
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}
const showLoading = () => { const el = document.getElementById('loading'); if (el) el.style.display = 'flex'; };
const hideLoading = () => { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; };

// --- 2. LOGIC TRANG CHỦ (index.html) ---
// Chỉ chạy khi ở trang chủ, load data.json
async function loadMainStoryIndex() {
    const listEl = document.getElementById('chapter-list');
    if (!listEl) return;

    console.log("--> Đang tải Truyện Chính...");
    showLoading();

    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if (!res.ok) throw new Error("Không tìm thấy data.json");
        
        const chapters = await res.json();
        const searchInput = document.getElementById('search-input');

        // Load Bookmark (Chỉ có ở truyện chính)
        loadBookmark(chapters);

        // Render Danh sách
        const render = (items) => {
            listEl.innerHTML = '';
            // Lọc bài chưa đến giờ đăng
            const visible = items.filter(i => !i.timestamp || i.timestamp <= Date.now());
            
            if (visible.length === 0) {
                listEl.innerHTML = '<p style="text-align:center">Chưa có chương nào.</p>';
                return;
            }

            visible.forEach(item => {
                // Tìm ID gốc để tạo link đúng
                const idx = chapters.findIndex(c => c.id === item.id);
                // Link truyện chính dùng ?id=...
                listEl.innerHTML += `
                    <a href="reader.html?id=${idx}&type=main" class="chap-card">
                        <div>${item.title}</div>
                    </a>`;
            });
        };

        render(chapters);
        
        // Tìm kiếm
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                render(chapters.filter(c => c.title.toLowerCase().includes(term)));
            });
        }

    } catch (e) {
        listEl.innerHTML = `<p style="color:red">Lỗi tải truyện: ${e.message}</p>`;
    }
    hideLoading();
}

// --- 3. LOGIC TRANG DATABOOK (list.html) ---
// Chỉ chạy khi ở trang list, load data_wiki.json, data_tech.json...
async function loadLoreList() {
    const listEl = document.getElementById('chapter-list');
    if (!listEl) return;

    // Lấy tên DB từ URL (VD: ?db=wiki)
    const params = new URLSearchParams(window.location.search);
    const dbName = params.get('db');

    if (!dbName) {
        listEl.innerHTML = "Lỗi: Không xác định được thư viện.";
        return;
    }

    console.log(`--> Đang tải Databook: ${dbName}...`);
    showLoading();

    try {
        const fileName = `data_${dbName}.json`;
        const res = await fetch(`${fileName}?t=${Date.now()}`);
        
        if (!res.ok) {
            listEl.innerHTML = `<p style="text-align:center">Chưa có dữ liệu cho mục này.</p>`;
            hideLoading();
            return;
        }

        const items = await res.json();
        const searchInput = document.getElementById('search-input');

        const render = (list) => {
            listEl.innerHTML = '';
            if (list.length === 0) {
                listEl.innerHTML = '<p style="text-align:center">Danh sách trống.</p>';
                return;
            }
            list.forEach(item => {
                // Link Databook dùng ?file=... (Trỏ thẳng vào file MD)
                // Admin Tool lưu file path đầy đủ (VD: wiki/minh.md)
                listEl.innerHTML += `
                    <a href="reader.html?file=${item.file}&type=lore" class="chap-card">
                        <div>${item.title}</div>
                    </a>`;
            });
        };

        render(items);

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                render(items.filter(c => c.title.toLowerCase().includes(term)));
            });
        }

    } catch (e) {
        listEl.innerHTML = `<p style="color:red">Lỗi tải dữ liệu: ${e.message}</p>`;
    }
    hideLoading();
}

// --- 4. LOGIC TRANG ĐỌC (reader.html) ---
// Chia làm 2 trường hợp rõ ràng: Đọc Truyện Chính và Đọc File Lẻ (Lore)
async function initReader() {
    const contentEl = document.getElementById('content-area');
    if (!contentEl) return;

    showLoading();
    const params = new URLSearchParams(window.location.search);
    
    // --- TRƯỜNG HỢP A: ĐỌC FILE LẺ (Lore, Wiki, Tech...) ---
    // URL sẽ có dạng: reader.html?file=wiki/minh.md
    if (params.has('file')) {
        console.log("--> Chế độ đọc File (Lore)");
        const filePath = params.get('file');
        
        // Ẩn nút điều hướng (vì đọc file lẻ không có trước sau)
        document.getElementById('prev-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'none';
        
        // Sửa nút Quay về -> Về Lore Hub
        const homeBtn = document.querySelector('.reader-controls a');
        if(homeBtn) {
            homeBtn.href = "lore_hub.html";
            homeBtn.innerText = "⬅ Về Databook";
        }

        document.getElementById('chap-title').innerText = "Tài liệu lưu trữ";

        try {
            const res = await fetch(`${filePath}?t=${Date.now()}`);
            if(!res.ok) throw new Error("File không tồn tại");
            const txt = await res.text();
            contentEl.innerHTML = marked.parse(txt);
            document.title = "Đang đọc tài liệu - MirAi";
        } catch (e) {
            contentEl.innerHTML = `<h3 style="color:red">Lỗi: ${e.message}</h3>`;
        }
    } 
    
    // --- TRƯỜNG HỢP B: ĐỌC TRUYỆN CHÍNH (Main Story) ---
    // URL sẽ có dạng: reader.html?id=1&type=main
    else if (params.has('id')) {
        console.log("--> Chế độ đọc Truyện Chính");
        const id = parseInt(params.get('id'));
        
        try {
            const res = await fetch(`data.json?t=${Date.now()}`);
            const chapters = await res.json();

            if (!chapters[id]) throw new Error("Chương không tồn tại");

            const chapter = chapters[id];
            
            // Check hẹn giờ
            if (chapter.timestamp && chapter.timestamp > Date.now()) {
                alert("Chương này chưa đến giờ phát hành!");
                window.location.href = "index.html";
                return;
            }

            // Lưu bookmark
            localStorage.setItem('mirai_bookmark', id);

            // Render
            document.title = `${chapter.title} - ${CONFIG.webName}`;
            document.getElementById('chap-title').innerText = chapter.title;
            
            const mdRes = await fetch(`${chapter.file}?t=${Date.now()}`);
            if(!mdRes.ok) throw new Error("Không tải được nội dung chương");
            contentEl.innerHTML = marked.parse(await mdRes.text());

            // Xử lý nút điều hướng
            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');

            prevBtn.onclick = () => window.location.href = `reader.html?id=${id - 1}&type=main`;
            nextBtn.onclick = () => window.location.href = `reader.html?id=${id + 1}&type=main`;

            if (id === 0) prevBtn.style.display = 'none';
            if (id >= chapters.length - 1) nextBtn.style.display = 'none';

        } catch (e) {
            contentEl.innerHTML = `<h3 style="color:red">Lỗi: ${e.message}</h3>`;
        }
    }

    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings();
}

// --- 5. CÁC TÍNH NĂNG PHỤ (GIỮ NGUYÊN CODE CŨ) ---
// (Phần này bro cứ giữ nguyên các hàm nhạc, theme, font... không cần sửa gì cả)
// Tôi paste lại để bro copy 1 lần cho tiện

let musicPlaylist = [];
let currentTrackIndex = parseInt(localStorage.getItem('bgm_track_idx')) || 0;
const audioPlayer = new Audio();
audioPlayer.loop = false;
let isMusicPlaying = false;

async function initMusicSystem() {
    try {
        const response = await fetch(`music.json?t=${Date.now()}`);
        if (response.ok) musicPlaylist = await response.json();
    } catch (error) {}
    if (musicPlaylist.length === 0) {
        musicPlaylist = [{ title: "Default Lofi", url: (typeof CONFIG !== 'undefined' && CONFIG.defaultMusic) ? CONFIG.defaultMusic : "images/music.mp3" }];
    }
    if (currentTrackIndex >= musicPlaylist.length) currentTrackIndex = 0;
}
function loadTrack(index) {
    if (index >= musicPlaylist.length) index = 0;
    currentTrackIndex = index;
    audioPlayer.src = musicPlaylist[index].url;
    localStorage.setItem('bgm_track_idx', index);
}
audioPlayer.addEventListener('ended', playNextSong);
function updatePlayerUI() {
    const icon = document.getElementById('bgm-icon');
    const btn = document.getElementById('bgm-controls');
    if (!icon || !btn) return;
    isMusicPlaying ? icon.classList.add('playing') : icon.classList.remove('playing');
    btn.innerHTML = isMusicPlaying ? '⏸️' : '▶️';
}
function toggleBGM() {
    if (!audioPlayer.src) loadTrack(currentTrackIndex);
    if (audioPlayer.paused) {
        audioPlayer.play().then(() => {
            isMusicPlaying = true;
            updatePlayerUI();
            localStorage.setItem('bgm_status', 'on');
        });
    } else {
        audioPlayer.pause();
        isMusicPlaying = false;
        updatePlayerUI();
        localStorage.setItem('bgm_status', 'off');
    }
}
function playNextSong() {
    currentTrackIndex++;
    if (currentTrackIndex >= musicPlaylist.length) currentTrackIndex = 0;
    loadTrack(currentTrackIndex);
    if (localStorage.getItem('bgm_status') === 'on') {
        audioPlayer.play();
        isMusicPlaying = true;
        updatePlayerUI();
    }
}
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (audioPlayer.paused && localStorage.getItem('bgm_status') === 'on') {
            if (!audioPlayer.src) loadTrack(currentTrackIndex);
            audioPlayer.play().then(() => {
                isMusicPlaying = true;
                updatePlayerUI();
            });
        }
    }, { once: true });
}

function initReadingProgress() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progressPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        bar.style.width = `${progressPercent}%`;
    });
}
function toggleSettings() { document.getElementById('settings-panel').classList.toggle('active'); }
function changeFontSize(action) {
    const content = document.getElementById('content-area');
    if (!content) return;
    let size = parseFloat(window.getComputedStyle(content).fontSize);
    size += (action === 'up' ? 2 : -2);
    content.style.fontSize = `${size}px`;
    localStorage.setItem('user_fontSize', size);
}
function toggleTheme() {
    const nextTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('user_theme', nextTheme);
}
function changeFont(fontName) {
    if (fontName === 'serif') document.body.setAttribute('data-font', 'serif');
    else document.body.removeAttribute('data-font');
    localStorage.setItem('user_font', fontName);
}
function applyUserSettings() {
    if (localStorage.getItem('user_theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    const content = document.getElementById('content-area');
    if (content) {
        const size = localStorage.getItem('user_fontSize');
        if (size) content.style.fontSize = `${size}px`;
    }
    if (localStorage.getItem('user_font') === 'serif') document.body.setAttribute('data-font', 'serif');
}
function loadBookmark(chapters) {
    const id = localStorage.getItem('mirai_bookmark');
    const linkEl = document.getElementById('bookmark-link');
    if (id !== null && chapters[id] && linkEl) {
        linkEl.style.display = 'inline-flex';
        linkEl.href = `reader.html?id=${id}&type=main`;
        linkEl.innerHTML = `📖 Đọc tiếp: ${chapters[id].title.substring(0, 15)}...`;
    }
}
function loadGiscus() {
    const container = document.getElementById('comments');
    if (!container || container.hasChildNodes()) return;
    const script = document.createElement('script');
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", CONFIG.giscus.repo);
    script.setAttribute("data-repo-id", CONFIG.giscus.repoId);
    script.setAttribute("data-category", CONFIG.giscus.category);
    script.setAttribute("data-category-id", CONFIG.giscus.categoryId);
    script.setAttribute("data-mapping", "title");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-theme", "preferred_color_scheme");
    container.appendChild(script);
}

// --- 6. KHỞI CHẠY (ENTRY POINT - ĐỊNH TUYẾN THỦ CÔNG) ---
document.addEventListener('DOMContentLoaded', async () => {
    await initMusicSystem();
    applyUserSettings();

    const path = window.location.pathname;

    // 1. Nếu là trang chủ (index.html) -> Chạy logic Truyện Chính
    if (path.endsWith('/') || path.endsWith('index.html')) {
        loadMainStoryIndex();
    }
    // 2. Nếu là trang list (list.html) -> Chạy logic Databook
    else if (path.includes('list.html')) {
        loadLoreList();
    }
    // 3. Nếu là trang đọc (reader.html) -> Chạy logic Đọc
    else if (path.includes('reader.html')) {
        initReader();
    }
});
