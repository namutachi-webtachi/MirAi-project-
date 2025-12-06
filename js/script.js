// =================================================================
// MirAi Project - Main Script v4.2 (Ultimate Edition)
// Bao gồm: Core, Bookmark, PWA, BGM Player, Progress Bar, Konami Code, Settings...
// =================================================================

// Load Config & Background Image from config.js
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}

// === TIỆN ÍCH CHUNG ===
const showLoading = () => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'flex';
};
const hideLoading = () => {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
};

// Hàm lấy dữ liệu (luôn thêm timestamp để tránh cache)
async function fetchDB() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        return response.ok ? await response.json() : [];
    } catch (error) {
        console.error("Failed to fetch database:", error);
        return [];
    }
}

// === TRANG CHỦ (index.html) ===
async function initIndexPage() {
    const chapterListEl = document.getElementById('chapter-list');
    if (!chapterListEl) return;

    showLoading();
    
    const chapters = await fetchDB();
    const searchInput = document.getElementById('search-input');

    loadBookmark(chapters); // Gọi hàm load bookmark

    const renderChapters = (items) => {
        chapterListEl.innerHTML = '';
        if (items.length === 0) {
            chapterListEl.innerHTML = '<p style="text-align:center; width: 100%;">Chưa có chương nào được đăng.</p>';
            return;
        }
        
        items.forEach((chap) => {
            const originalIndex = chapters.findIndex(c => c.id === chap.id);
            if (originalIndex !== -1) {
                chapterListEl.innerHTML += `
                    <a href="reader.html?id=${originalIndex}" class="chap-card">
                        <div style="font-size:0.9em; opacity:0.8;">${chap.title}</div>
                    </a>
                `;
            }
        });
    };

    renderChapters(chapters);
    hideLoading();

    // Event Listener cho ô tìm kiếm
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredChapters = chapters.filter(c => c.title.toLowerCase().includes(searchTerm));
        renderChapters(filteredChapters);
    });
}

// === TRANG ĐỌC (reader.html) ===
async function initReaderPage() {
    const contentAreaEl = document.getElementById('content-area');
    if (!contentAreaEl) return;

    showLoading();

    const params = new URLSearchParams(window.location.search);
    const chapterId = parseInt(params.get('id'));
    const chapters = await fetchDB();

    if (isNaN(chapterId) || !chapters[chapterId]) {
        contentAreaEl.innerHTML = '<h3>Lỗi: Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    // LƯU BOOKMARK KHI BẮT ĐẦU ĐỌC
    localStorage.setItem('mirai_bookmark', chapterId);

    const chapter = chapters[chapterId];
    document.title = `${chapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = chapter.title;

    // Tải và hiển thị nội dung chương
    try {
        const markdownResponse = await fetch(`${chapter.file}?t=${Date.now()}`);
        const markdownText = await markdownResponse.text();
        contentAreaEl.innerHTML = marked.parse(markdownText);
    } catch (error) {
        contentAreaEl.innerText = "Lỗi tải nội dung chương. Vui lòng thử lại.";
        console.error("Failed to load chapter content:", error);
    }

    // Xử lý nút Next/Prev
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}`;
    if (chapterId === 0) prevBtn.style.display = 'none';
    if (chapterId === chapters.length - 1) nextBtn.style.display = 'none';
    
    // Kích hoạt các tính năng nâng cao
    initReadingProgress();
    loadGiscus();
    applyUserSettings(); // Áp dụng cài đặt font, size
    hideLoading();
}

// === TÍNH NĂNG NÂNG CAO ===

// 1. Thanh tiến độ đọc
function initReadingProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;
    window.addEventListener('scroll', () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        progressBar.style.width = `${progress}%`;
    });
}

// 2. Trình phát nhạc nền (BGM)
const bgm = new Audio('https://www.mboxdrive.com/lofi-study-112191.mp3');
bgm.loop = true;
const bgmPlayer = document.getElementById('bgm-player');
const bgmIcon = document.getElementById('bgm-icon');
const bgmControls = document.getElementById('bgm-controls');

function toggleBGM() {
    if (bgm.paused) {
        bgm.play().catch(e => console.error("BGM play failed:", e));
        bgmIcon.classList.add('playing');
        bgmControls.innerHTML = '⏸️';
        localStorage.setItem('bgm_status', 'on');
    } else {
        bgm.pause();
        bgmIcon.classList.remove('playing');
        bgmControls.innerHTML = '▶️';
        localStorage.setItem('bgm_status', 'off');
    }
}
// Tự động chạy nhạc nếu người dùng đã bật trước đó
if (localStorage.getItem('bgm_status') === 'on') {
    // Cần tương tác người dùng để tự phát nhạc trên một số trình duyệt
    document.body.addEventListener('click', () => {
        if(bgm.paused) toggleBGM();
    }, { once: true });
}

// 3. Easter Egg - Konami Code
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiPosition = 0;
document.addEventListener('keydown', (e) => {
    if (e.key === konamiCode[konamiPosition]) {
        konamiPosition++;
        if (konamiPosition === konamiCode.length) {
            document.body.classList.toggle('matrix-mode');
            alert('HACKER MODE ' + (document.body.classList.contains('matrix-mode') ? 'ACTIVATED.' : 'DEACTIVATED.'));
            konamiPosition = 0;
        }
    } else {
        konamiPosition = 0;
    }
});

// 4. Panel Cài đặt (Settings)
function toggleSettings() { document.getElementById('settings-panel').classList.toggle('active'); }
function changeFontSize(action) {
    const content = document.getElementById('content-area');
    if (!content) return;
    let currentSize = parseFloat(window.getComputedStyle(content).fontSize);
    currentSize += (action === 'up' ? 2 : -2);
    content.style.fontSize = `${currentSize}px`;
    localStorage.setItem('user_fontSize', currentSize);
}
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('user_theme', newTheme);
}
function changeFont(font) {
    document.body.classList.remove('font-serif');
    if (font === 'serif') document.body.classList.add('font-serif');
    localStorage.setItem('user_font', font);
}

// 5. Áp dụng Cài đặt của người dùng khi tải trang
function applyUserSettings() {
    if (localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        const savedSize = localStorage.getItem('user_fontSize');
        if (savedSize) contentArea.style.fontSize = `${savedSize}px`;
        const savedFont = localStorage.getItem('user_font');
        if (savedFont === 'serif') document.body.classList.add('font-serif');
    }
}

// 6. Bookmark
function loadBookmark(chapters) {
    const bookmarkId = localStorage.getItem('mirai_bookmark');
    if (bookmarkId !== null && chapters[bookmarkId]) {
        const linkEl = document.getElementById('bookmark-link');
        const chapter = chapters[bookmarkId];
        linkEl.style.display = 'inline-flex';
        linkEl.href = `reader.html?id=${bookmarkId}`;
        linkEl.innerHTML = `📖 Đọc tiếp: ${chapter.title.substring(0, 15)}...`; // Rút gọn tên chương
    }
}

// 7. Giscus (Bình luận)
function loadGiscus() {
    const commentsContainer = document.getElementById('comments');
    if (!commentsContainer || commentsContainer.hasChildNodes()) return; // Chỉ load 1 lần

    const script = document.createElement('script');
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", CONFIG.giscus.repo);
    script.setAttribute("data-repo-id", CONFIG.giscus.repoId);
    script.setAttribute("data-category", CONFIG.giscus.category);
    script.setAttribute("data-category-id", CONFIG.giscus.categoryId);
    script.setAttribute("data-mapping", "title");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "preferred_color_scheme");
    script.setAttribute("data-lang", "vi");
    script.setAttribute("crossorigin", "anonymous");
    script.async = true;
    commentsContainer.appendChild(script);
}

// === KHỞI CHẠY TOÀN BỘ HỆ THỐNG ===
document.addEventListener('DOMContentLoaded', () => {
    applyUserSettings(); // Áp dụng theme trước tiên

    // "Router" đơn giản để chạy đúng hàm cho đúng trang
    if (document.getElementById('chapter-list')) {
        initIndexPage();
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
