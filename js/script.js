// =================================================================
// MirAi Project - Main Script v4.3 (Phiên bản Hoàn Chỉnh & Ổn Định)
// Bao gồm: Core, Bookmark, PWA, BGM Player, Progress Bar, Konami Code, Settings...
// =================================================================

// --- KHỞI TẠO BAN ĐẦU ---
// Load Config & Background Image từ config.js
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
        console.error("Lỗi tải database (data.json):", error);
        return [];
    }
}

// === LOGIC CHO TỪNG TRANG (ROUTER) ===

// 1. Chạy khi ở Trang Chủ (index.html)
async function initIndexPage() {
    const chapterListEl = document.getElementById('chapter-list');
    if (!chapterListEl) return;

    showLoading();
    const chapters = await fetchDB();
    const searchInput = document.getElementById('search-input');

    loadBookmark(chapters); // Hiển thị nút "Đọc tiếp"

    const renderChapters = (items) => {
        chapterListEl.innerHTML = '';
        if (items.length === 0) {
            chapterListEl.innerHTML = '<p style="text-align:center; width: 100%;">Chưa có chương nào.</p>';
            return;
        }
        items.forEach((chap) => {
            const originalIndex = chapters.findIndex(c => c.id === chap.id);
            if (originalIndex !== -1) {
                chapterListEl.innerHTML += `
                    <a href="reader.html?id=${originalIndex}" class="chap-card">
                        <div>${chap.title}</div>
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

// 2. Chạy khi ở Trang Đọc (reader.html)
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

    localStorage.setItem('mirai_bookmark', chapterId); // Lưu chương đang đọc

    const chapter = chapters[chapterId];
    document.title = `${chapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = chapter.title;

    try {
        const markdownResponse = await fetch(`${chapter.file}?t=${Date.now()}`);
        const markdownText = await markdownResponse.text();
        contentAreaEl.innerHTML = marked.parse(markdownText);
    } catch (error) {
        contentAreaEl.innerText = "Lỗi tải nội dung chương.";
    }

    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}`;
    if (chapterId === 0) prevBtn.style.display = 'none';
    if (chapterId === chapters.length - 1) nextBtn.style.display = 'none';
    
    initReadingProgress();
    loadGiscus();
    hideLoading();
}

// === CÁC TÍNH NĂNG NÂNG CAO ===

// 1. THANH TIẾN ĐỘ ĐỌC
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

// 2. TRÌNH PHÁT NHẠC NỀN (BGM)
const bgm = new Audio('https://www.mboxdrive.com/lofi-study-112191.mp3');
bgm.loop = true;
let isBGMInitialized = false;

function updateBGMUI(isPlaying) {
    const icon = document.getElementById('bgm-icon');
    const controls = document.getElementById('bgm-controls');
    if (isPlaying) {
        icon.classList.add('playing');
        controls.innerHTML = '⏸️';
    } else {
        icon.classList.remove('playing');
        controls.innerHTML = '▶️';
    }
}

function toggleBGM() {
    if (!isBGMInitialized) {
        bgm.load();
        isBGMInitialized = true;
    }
    if (bgm.paused) {
        bgm.play().then(() => {
            updateBGMUI(true);
            localStorage.setItem('bgm_status', 'on');
        }).catch(e => console.error("Lỗi phát nhạc:", e));
    } else {
        bgm.pause();
        updateBGMUI(false);
        localStorage.setItem('bgm_status', 'off');
    }
}
// Logic tự động phát lại khi người dùng đã cho phép
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (bgm.paused && localStorage.getItem('bgm_status') === 'on') {
            toggleBGM();
        }
    }, { once: true }); // Chỉ chạy 1 lần
}

// 3. EASTER EGG - KONAMI CODE
const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
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

// 4. PANEL CÀI ĐẶT (SETTINGS)
function toggleSettings() { document.getElementById('settings-panel').classList.toggle('active'); }
function changeFontSize(action) {
    const content = document.getElementById('content-area'); if(!content) return;
    let size = parseFloat(window.getComputedStyle(content).fontSize);
    size += (action === 'up' ? 2 : -2);
    content.style.fontSize = `${size}px`;
    localStorage.setItem('user_fontSize', size);
}
function toggleTheme() {
    const theme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('user_theme', theme);
}
function changeFont(font) {
    document.body.classList.remove('font-serif');
    if (font === 'serif') document.body.classList.add('font-serif');
    localStorage.setItem('user_font', font);
}

// 5. ÁP DỤNG CÀI ĐẶT CỦA NGƯỜI DÙNG
function applyUserSettings() {
    if (localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        const size = localStorage.getItem('user_fontSize');
        if (size) contentArea.style.fontSize = `${size}px`;
        const font = localStorage.getItem('user_font');
        if (font === 'serif') document.body.classList.add('font-serif');
    }
}

// 6. BOOKMARK
function loadBookmark(chapters) {
    const id = localStorage.getItem('mirai_bookmark');
    const linkEl = document.getElementById('bookmark-link');
    if (id !== null && chapters[id]) {
        linkEl.style.display = 'inline-flex';
        linkEl.href = `reader.html?id=${id}`;
        linkEl.innerHTML = `📖 Đọc tiếp: ${chapters[id].title.substring(0, 15)}...`;
    }
}

// 7. GISCUS (BÌNH LUẬN)
function loadGiscus() {
    const container = document.getElementById('comments');
    if (!container || container.hasChildNodes()) return;
    const script = document.createElement('script');
    script.src = "https://giscus.app/client.js";
    script.setAttribute("data-repo", CONFIG.giscus.repo);
    script.setAttribute("data-repo-id", CONFIG.giscus.repoId);
    script.setAttribute("data-category", CONFIG.giscus.category);
    script.setAttribute("data-category-id", CONFIG.giscus.categoryId);
    script.setAttribute("data-mapping", "title");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-theme", "preferred_color_scheme");
    script.setAttribute("crossorigin", "anonymous");
    script.async = true;
    container.appendChild(script);
}

// === ĐIỂM KHỞI ĐỘNG CHÍNH CỦA WEB ===
document.addEventListener('DOMContentLoaded', () => {
    applyUserSettings(); // Luôn áp dụng theme và font trước

    // Chạy đúng hàm cho đúng trang
    if (document.getElementById('chapter-list')) {
        initIndexPage();
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
