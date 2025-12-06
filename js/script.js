// =================================================================
// MirAi Project - Main Script v4.3.2 (Bản FULL KHÔNG CHE)
// =================================================================

// 1. LOAD CẤU HÌNH & ẢNH NỀN
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}

// 2. TIỆN ÍCH HIỂN THỊ LOADING
const showLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'flex';
};

const hideLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
};

// 3. HÀM LẤY DỮ LIỆU TỪ SERVER (DATABASE)
async function fetchDB() {
    try {
        // Thêm timestamp để tránh việc trình duyệt lưu cache cũ
        const res = await fetch(`data.json?t=${Date.now()}`);
        return res.ok ? await res.json() : [];
    } catch (e) {
        console.error("Lỗi tải database:", e);
        return [];
    }
}

// 4. LOGIC TRANG CHỦ (INDEX)
async function initIndexPage() {
    const listEl = document.getElementById('chapter-list');
    if (!listEl) return;

    showLoading();
    const chapters = await fetchDB();
    const searchInput = document.getElementById('search-input');
    
    // Load bookmark nếu có
    loadBookmark(chapters);

    // Hàm vẽ danh sách chương
    const render = (items) => {
        listEl.innerHTML = '';
        if (items.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; width: 100%;">Chưa có chương nào.</p>';
            return;
        }
        items.forEach((item) => {
            const originalIndex = chapters.findIndex(c => c.id === item.id);
            if (originalIndex !== -1) {
                listEl.innerHTML += `
                    <a href="reader.html?id=${originalIndex}" class="chap-card">
                        <div>${item.title}</div>
                    </a>
                `;
            }
        });
    };

    render(chapters);
    hideLoading();

    // Tính năng tìm kiếm
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = chapters.filter(c => c.title.toLowerCase().includes(term));
        render(filtered);
    });
}

// 5. LOGIC TRANG ĐỌC (READER)
async function initReaderPage() {
    const contentEl = document.getElementById('content-area');
    if (!contentEl) return;

    showLoading();
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    const chapters = await fetchDB();

    if (isNaN(id) || !chapters[id]) {
        contentEl.innerHTML = '<h3>Lỗi: Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    // Lưu lại vị trí đang đọc
    localStorage.setItem('mirai_bookmark', id);

    const chapter = chapters[id];
    document.title = `${chapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = chapter.title;

    // Tải nội dung truyện
    try {
        const res = await fetch(`${chapter.file}?t=${Date.now()}`);
        const text = await res.text();
        contentEl.innerHTML = marked.parse(text);
    } catch (e) {
        contentEl.innerText = "Lỗi tải nội dung chương.";
    }

    // Xử lý nút Chuyển chương
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.onclick = () => window.location.href = `reader.html?id=${id - 1}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${id + 1}`;
    
    if (id === 0) prevBtn.style.display = 'none';
    if (id === chapters.length - 1) nextBtn.style.display = 'none';

    // Kích hoạt các tính năng phụ trợ
    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings(); // Áp dụng font, size, theme
}

// 6. THANH TIẾN ĐỘ ĐỌC
function initReadingProgress() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        bar.style.width = `${progress}%`;
    });
}

// 7. TRÌNH PHÁT NHẠC (BGM)
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

// Lách luật: Chờ click đầu tiên để bật nhạc nếu đã lưu trạng thái 'on'
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (bgm.paused && localStorage.getItem('bgm_status') === 'on') {
            toggleBGM();
        }
    }, { once: true });
}

// 8. HACKER MODE (KONAMI CODE)
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

// 9. CÁC HÀM CÀI ĐẶT (SETTINGS)
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
    const theme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('user_theme', theme);
}

function changeFont(font) {
    document.body.classList.remove('font-serif');
    if (font === 'serif') {
        document.body.classList.add('font-serif');
    }
    localStorage.setItem('user_font', font);
}

// Hàm áp dụng tất cả cài đặt khi mới vào trang
function applyUserSettings() {
    // Theme
    if (localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    // Font & Size
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        const size = localStorage.getItem('user_fontSize');
        if (size) contentArea.style.fontSize = `${size}px`;
        
        const font = localStorage.getItem('user_font');
        if (font === 'serif') document.body.classList.add('font-serif');
    }
}

// 10. BOOKMARK & GISCUS
function loadBookmark(chapters) {
    const id = localStorage.getItem('mirai_bookmark');
    const linkEl = document.getElementById('bookmark-link');
    if (id !== null && chapters[id]) {
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

// === KHỞI CHẠY (MAIN) ===
document.addEventListener('DOMContentLoaded', () => {
    applyUserSettings();
    if (document.getElementById('chapter-list')) {
        initIndexPage();
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
