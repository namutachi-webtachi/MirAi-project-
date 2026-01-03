// =================================================================
// MIRAI PROJECT - CORE SCRIPT V7.1 (Databook Ready)
// Dựa trên nền tảng V7.0 của NamuTachi
// =================================================================

// --- 1. KHỞI TẠO & HELPERS (Giữ nguyên) ---
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}
const showLoading = () => { const el = document.getElementById('loading'); if (el) el.style.display = 'flex'; };
const hideLoading = () => { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; };

// --- 2. DATABASE (NÂNG CẤP) ---
// Hàm này giờ nhận tên file JSON làm tham số
async function fetchDatabase(jsonFile = 'data.json') {
    try {
        const response = await fetch(`${jsonFile}?t=${Date.now()}`);
        return response.ok ? await response.json() : [];
    } catch (error) {
        console.error("Lỗi tải Database:", error);
        return [];
    }
}

// --- 3. LOGIC TRANG CHỦ & LIST (NÂNG CẤP) ---
// Hàm này giờ nhận tên file JSON và thư mục làm tham số
async function initIndexPage(jsonFile = 'data.json', folderPrefix = 'chapters') {
    const chapterListElement = document.getElementById('chapter-list');
    if (!chapterListElement) return;

    showLoading();
    const allItems = await fetchDatabase(jsonFile);
    const searchInput = document.getElementById('search-input');
    
    // Bookmark chỉ load ở trang chính
    if (folderPrefix === 'chapters') {
        loadBookmark(allItems);
    }

    const renderItems = (items) => {
        chapterListElement.innerHTML = '';
        if (items.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center;">Chưa có nội dung.</p>';
            return;
        }

        const visibleItems = items.filter(item => !item.timestamp || item.timestamp <= Date.now());

        if (visibleItems.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center;">Chưa có mục nào được phát hành.</p>';
            return;
        }

        visibleItems.forEach((item) => {
            const originalIndex = allItems.findIndex(c => c.id === item.id);
            if (originalIndex !== -1) {
                // Thêm `&db=` vào URL để reader biết đang đọc từ đâu
                chapterListElement.innerHTML += `
                    <a href="reader.html?id=${originalIndex}&db=${folderPrefix}" class="chap-card">
                        <div>${item.title}</div>
                    </a>
                `;
            }
        });
    };

    renderItems(allItems);
    hideLoading();

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const keyword = event.target.value.toLowerCase();
            renderItems(allItems.filter(c => c.title.toLowerCase().includes(keyword)));
        });
    }
}

// --- 4. LOGIC TRANG ĐỌC (NÂNG CẤP TOÀN DIỆN) ---
async function initReaderPage() {
    const contentElement = document.getElementById('content-area');
    if (!contentElement) return;

    showLoading();
    
    const urlParams = new URLSearchParams(window.location.search);
    const customFile = urlParams.get('file'); // Dùng cho file lẻ như lore.md
    
    // 1. CHẾ ĐỘ ĐỌC FILE LẺ (VD: lore.md từ Admin Tool cũ)
    if (customFile) {
        document.title = "Tài liệu MirAi";
        document.getElementById('chap-title').innerText = "Tài liệu Lưu trữ";
        document.getElementById('prev-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'none';
        
        try {
            const response = await fetch(`${customFile}?t=${Date.now()}`);
            contentElement.innerHTML = marked.parse(await response.text());
        } catch(e) { contentElement.innerText = "Lỗi tải tài liệu."; }
        
        hideLoading();
        applyUserSettings();
        loadGiscus();
        return; // Dừng tại đây
    }

    // 2. CHẾ ĐỘ ĐỌC TỪ MỤC LỤC (TRUYỆN CHÍNH & DATABOOK)
    const chapterId = parseInt(urlParams.get('id'));
    const dbPrefix = urlParams.get('db') || 'chapters';
    const jsonFile = (dbPrefix === 'chapters') ? 'data.json' : `data_${dbPrefix}.json`;
    const backLink = (dbPrefix === 'chapters') ? 'index.html' : `list.html?db=${dbPrefix}`;
    
    // Cập nhật link nút "Trang chủ"
    const homeBtn = document.querySelector('.reader-controls a');
    if(homeBtn) homeBtn.href = backLink;

    const chapters = await fetchDatabase(jsonFile);

    if (isNaN(chapterId) || !chapters[chapterId]) {
        contentElement.innerHTML = '<h3>Lỗi: Không tìm thấy mục này!</h3>';
        hideLoading();
        return;
    }

    const currentChapter = chapters[chapterId];
    if (currentChapter.timestamp && currentChapter.timestamp > Date.now()) {
        alert("⛔ Mục này chưa đến giờ phát hành!");
        window.location.href = backLink;
        return;
    }

    // Lưu bookmark chỉ cho truyện chính
    if (dbPrefix === 'chapters') {
        localStorage.setItem('mirai_bookmark', chapterId);
    }

    document.title = `${currentChapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = currentChapter.title;

    try {
        // Thêm prefix thư mục vào đường dẫn file
        const filePath = (dbPrefix === 'chapters') ? currentChapter.file : `${dbPrefix}/${currentChapter.file}`;
        const response = await fetch(`${filePath}?t=${Date.now()}`);
        contentElement.innerHTML = marked.parse(await response.text());
    } catch (error) {
        contentElement.innerText = "Lỗi tải nội dung.";
    }

    // Điều hướng Trước/Sau
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}&db=${dbPrefix}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}&db=${dbPrefix}`;
    
    if (chapterId === 0) prevBtn.style.display = 'none';
    if (chapterId >= chapters.length - 1) nextBtn.style.display = 'none';

    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings();
}

// --- 5. HỆ THỐNG ÂM NHẠC (Giữ nguyên) ---
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
        musicPlaylist = [{ title: "Default Lofi", url: CONFIG.defaultMusic || "images/music.mp3" }];
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
    const controls = document.getElementById('bgm-controls');
    if (!icon || !controls) return;
    icon.classList.toggle('playing', isMusicPlaying);
    controls.innerText = isMusicPlaying ? '⏸️' : '▶️';
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
    currentTrackIndex = (currentTrackIndex + 1) % musicPlaylist.length;
    loadTrack(currentTrackIndex);
    if (localStorage.getItem('bgm_status') === 'on') {
        audioPlayer.play();
        isMusicPlaying = true;
        updatePlayerUI();
    }
}
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (audioPlayer.paused) toggleBGM();
    }, { once: true });
}

// --- 6. CÁC TÍNH NĂNG KHÁC (Giữ nguyên) ---
function initReadingProgress() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        const h = document.documentElement;
        const percent = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
        bar.style.width = `${percent}%`;
    });
}
function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('active');
}
function changeFontSize(action) {
    const el = document.getElementById('content-area');
    if (!el) return;
    let size = parseFloat(window.getComputedStyle(el).fontSize);
    size += (action === 'up' ? 2 : -2);
    el.style.fontSize = `${size}px`;
    localStorage.setItem('user_fontSize', size);
}
function toggleTheme() {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('user_theme', next);
}
function changeFont(fontName) {
    if (fontName === 'serif') document.body.setAttribute('data-font', 'serif');
    else document.body.removeAttribute('data-font');
    localStorage.setItem('user_font', fontName);
}
function applyUserSettings() {
    if (localStorage.getItem('user_theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    const el = document.getElementById('content-area');
    if (el) {
        const size = localStorage.getItem('user_fontSize');
        if (size) el.style.fontSize = `${size}px`;
    }
    if (localStorage.getItem('user_font') === 'serif') document.body.setAttribute('data-font', 'serif');
}
function loadBookmark(chapters) {
    const id = localStorage.getItem('mirai_bookmark');
    const linkEl = document.getElementById('bookmark-link');
    if (id !== null && chapters[id] && linkEl) {
        linkEl.style.display = 'inline-flex';
        linkEl.href = `reader.html?id=${id}&db=chapters`;
        linkEl.innerHTML = `📖 Đọc tiếp: ${chapters[id].title.substring(0, 15)}...`;
    }
}
function loadGiscus() {
    const el = document.getElementById('comments');
    if (!el || el.hasChildNodes()) return;
    const s = document.createElement('script');
    s.src = "https://giscus.app/client.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    Object.entries(CONFIG.giscus).forEach(([key, value]) => s.setAttribute(`data-${key}`, value));
    s.setAttribute("data-mapping", "title");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-theme", "preferred_color_scheme");
    el.appendChild(s);
}

// --- 7. ENTRY POINT (Giữ nguyên) ---
document.addEventListener('DOMContentLoaded', async () => {
    await initMusicSystem();
    applyUserSettings();

    if (document.getElementById('chapter-list')) {
        // Chỉ gọi initIndexPage ở trang index.html.
        // Trang list.html đã có logic riêng của nó.
        if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/')) {
            initIndexPage();
        }
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
