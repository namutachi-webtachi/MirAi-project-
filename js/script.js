// =================================================================
// MIRAI PROJECT - CORE SCRIPT V7.3 (Maximum Compatibility)
// Dựa trên nền tảng V7.0, chỉ THÊM, không SỬA logic gốc.
// =================================================================

// --- 1. KHỞI TẠO & HELPERS (Giữ nguyên 100% từ code gốc) ---
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}
const showLoading = () => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'flex';
};
const hideLoading = () => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'none';
};

// --- 2. DATABASE (Giữ nguyên hàm gốc, thêm hàm mới) ---
// Hàm gốc cho truyện chính
async function fetchDatabase() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        return response.ok ? await response.json() : [];
    } catch (error) {
        console.error("Lỗi khi tải Database:", error);
        return [];
    }
}
// [MỚI] Hàm riêng cho Databook
async function fetchDatabookDatabase(jsonFile) {
    try {
        const response = await fetch(`${jsonFile}?t=${Date.now()}`);
        return response.ok ? await response.json() : [];
    } catch (error) {
        console.error("Lỗi khi tải Databook DB:", error);
        return [];
    }
}

// --- 3. LOGIC TRANG CHỦ & LIST (TÁCH BIỆT) ---
// Hàm gốc cho trang index.html
async function initIndexPage() {
    const chapterListElement = document.getElementById('chapter-list');
    if (!chapterListElement) return;

    showLoading();
    const chapters = await fetchDatabase();
    const searchInput = document.getElementById('search-input');
    
    loadBookmark(chapters);

    const renderChapters = (items) => {
        chapterListElement.innerHTML = '';
        if (items.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center; width: 100%;">Chưa có chương nào được đăng.</p>';
            return;
        }
        const visibleItems = items.filter(item => !item.timestamp || item.timestamp <= Date.now());
        if (visibleItems.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center;">Chưa có chương nào đến giờ phát hành.</p>';
            return;
        }
        visibleItems.forEach((item) => {
            const originalIndex = chapters.findIndex(c => c.id === item.id);
            if (originalIndex !== -1) {
                // Link gốc không có &db=
                chapterListElement.innerHTML += `
                    <a href="reader.html?id=${originalIndex}" class="chap-card">
                        <div>${item.title}</div>
                    </a>
                `;
            }
        });
    };

    renderChapters(chapters);
    hideLoading();

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const keyword = event.target.value.toLowerCase();
            renderChapters(chapters.filter(c => c.title.toLowerCase().includes(keyword)));
        });
    }
}
// [MỚI] Hàm riêng cho trang list.html
async function initListPage() {
    const listElement = document.getElementById('chapter-list');
    if (!listElement) return;

    const urlParams = new URLSearchParams(window.location.search);
    const dbName = urlParams.get('db');
    if (!dbName) {
        listElement.innerHTML = "Lỗi: Không tìm thấy thư viện.";
        return;
    }

    showLoading();
    const jsonFile = `data_${dbName}.json`;
    const folderPrefix = dbName;
    const allItems = await fetchDatabookDatabase(jsonFile);
    const searchInput = document.getElementById('search-input');

    const renderItems = (items) => {
        listElement.innerHTML = '';
        if (items.length === 0) {
            listElement.innerHTML = '<p style="text-align:center;">Chưa có nội dung.</p>';
            return;
        }
        items.forEach((item) => {
            const originalIndex = allItems.findIndex(c => c.id === item.id);
            if (originalIndex !== -1) {
                listElement.innerHTML += `
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
    const dbPrefix = urlParams.get('db');
    
    // PHÂN LUỒNG: Đọc Databook hay đọc Truyện chính?
    if (dbPrefix) {
        // --- LOGIC ĐỌC DATABOOK ---
        const chapterId = parseInt(urlParams.get('id'));
        const jsonFile = `data_${dbPrefix}.json`;
        const chapters = await fetchDatabookDatabase(jsonFile);

        if (isNaN(chapterId) || !chapters[chapterId]) {
            contentElement.innerHTML = '<h3>Lỗi: Không tìm thấy mục này!</h3>';
            hideLoading(); return;
        }

        const currentChapter = chapters[chapterId];
        document.title = `${currentChapter.title} - ${CONFIG.webName}`;
        document.getElementById('chap-title').innerText = currentChapter.title;

        try {
            const response = await fetch(`${dbPrefix}/${currentChapter.file}?t=${Date.now()}`);
            contentElement.innerHTML = marked.parse(await response.text());
        } catch (error) { contentElement.innerText = "Lỗi tải nội dung."; }

        // Cập nhật nút điều hướng
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const homeBtn = document.querySelector('.reader-controls a');
        
        if(homeBtn) homeBtn.href = `list.html?db=${dbPrefix}`;
        prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}&db=${dbPrefix}`;
        nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}&db=${dbPrefix}`;
        
        if (chapterId === 0) prevBtn.style.display = 'none';
        if (chapterId >= chapters.length - 1) nextBtn.style.display = 'none';

    } else {
        // --- LOGIC ĐỌC TRUYỆN CHÍNH (Y HỆT CODE GỐC) ---
        const chapterId = parseInt(urlParams.get('id'));
        const chapters = await fetchDatabase();

        if (isNaN(chapterId) || !chapters[chapterId]) {
            contentElement.innerHTML = '<h3>Lỗi: Không tìm thấy chương này!</h3>';
            hideLoading(); return;
        }
        
        const currentChapter = chapters[chapterId];
        if (currentChapter.timestamp && currentChapter.timestamp > Date.now()) {
            alert("⛔ Chương này chưa đến giờ phát hành!");
            window.location.href = "index.html"; return;
        }
        
        localStorage.setItem('mirai_bookmark', chapterId);
        document.title = `${currentChapter.title} - ${CONFIG.webName}`;
        document.getElementById('chap-title').innerText = currentChapter.title;

        try {
            const response = await fetch(`${currentChapter.file}?t=${Date.now()}`);
            contentElement.innerHTML = marked.parse(await response.text());
        } catch (error) { contentElement.innerText = "Lỗi tải nội dung chương."; }

        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}`;
        nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}`;
        if (chapterId === 0) prevBtn.style.display = 'none';
        if (chapterId === chapters.length - 1) nextBtn.style.display = 'none';
    }

    // Kích hoạt các tính năng phụ (dùng chung)
    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings();
}

// --- 5. HỆ THỐNG ÂM NHẠC (Giữ nguyên 100% từ code gốc) ---
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
        if (typeof CONFIG !== 'undefined' && CONFIG.defaultMusic) {
            musicPlaylist = [{ title: "Default Lofi", url: CONFIG.defaultMusic }];
        } else {
            musicPlaylist = [{ title: "Default Lofi", url: "images/music.mp3" }];
        }
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
        }).catch(console.error);
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

// --- 6. CÁC TÍNH NĂNG KHÁC (Giữ nguyên 100% từ code gốc) ---
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
function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('active');
}
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
        linkEl.href = `reader.html?id=${id}`;
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

// --- 7. ENTRY POINT (Sửa lại để gọi đúng hàm) ---
document.addEventListener('DOMContentLoaded', async () => {
    await initMusicSystem();
    applyUserSettings();

    // Điều hướng logic theo trang
    const path = window.location.pathname;
    if (path.endsWith('/') || path.endsWith('index.html')) {
        initIndexPage();
    } else if (path.endsWith('list.html')) {
        initListPage();
    } else if (path.endsWith('reader.html')) {
        initReaderPage();
    }
});
