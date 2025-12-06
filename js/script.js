// =================================================================
// MirAi Project - Main Script v5.0 (Ultimate Full Version)
// =================================================================

// 1. KHỞI TẠO CẤU HÌNH & HÌNH NỀN
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}

// 2. CÁC HÀM TIỆN ÍCH HIỂN THỊ (LOADING)
const showLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'flex';
};

const hideLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
};

// 3. HÀM KẾT NỐI DATABASE (Lấy dữ liệu JSON)
async function fetchDB() {
    try {
        // Thêm timestamp để tránh trình duyệt cache dữ liệu cũ
        const res = await fetch(`data.json?t=${Date.now()}`);
        return res.ok ? await res.json() : [];
    } catch (e) {
        console.error("Lỗi khi tải Database:", e);
        return [];
    }
}

// 4. LOGIC TRANG CHỦ (INDEX PAGE)
async function initIndexPage() {
    const listEl = document.getElementById('chapter-list');
    if (!listEl) return;

    showLoading();
    const chapters = await fetchDB();
    const searchInput = document.getElementById('search-input');
    
    // Gọi hàm hiển thị bookmark nếu có
    loadBookmark(chapters);

    // Hàm render danh sách chương
    const render = (items) => {
        listEl.innerHTML = '';
        if (items.length === 0) {
            listEl.innerHTML = '<p style="text-align:center;">Chưa có chương nào được đăng.</p>';
            return;
        }
        items.forEach((item) => {
            // Tìm index gốc để link đúng chương
            const idx = chapters.findIndex(c => c.id === item.id);
            if (idx !== -1) {
                listEl.innerHTML += `
                    <a href="reader.html?id=${idx}" class="chap-card">
                        <div>${item.title}</div>
                    </a>`;
            }
        });
    };

    render(chapters);
    hideLoading();

    // Sự kiện tìm kiếm
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = chapters.filter(c => c.title.toLowerCase().includes(term));
        render(filtered);
    });
}

// 5. LOGIC TRANG ĐỌC (READER PAGE)
async function initReaderPage() {
    const contentEl = document.getElementById('content-area');
    if (!contentEl) return;

    showLoading();
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    const chapters = await fetchDB();

    // Kiểm tra xem chương có tồn tại không
    if (isNaN(id) || !chapters[id]) {
        contentEl.innerHTML = '<h3>Lỗi: Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    // Lưu Bookmark
    localStorage.setItem('mirai_bookmark', id);

    // Hiển thị thông tin chương
    const chapter = chapters[id];
    document.title = `${chapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = chapter.title;

    // Tải nội dung file Markdown
    try {
        const res = await fetch(`${chapter.file}?t=${Date.now()}`);
        const text = await res.text();
        contentEl.innerHTML = marked.parse(text);
    } catch (e) {
        contentEl.innerText = "Lỗi tải nội dung chương.";
    }

    // Xử lý nút Chuyển chương Next/Prev
    const prev = document.getElementById('prev-btn');
    const next = document.getElementById('next-btn');
    prev.onclick = () => window.location.href = `reader.html?id=${id - 1}`;
    next.onclick = () => window.location.href = `reader.html?id=${id + 1}`;
    
    if (id === 0) prev.style.display = 'none';
    if (id === chapters.length - 1) next.style.display = 'none';

    // Kích hoạt các tính năng phụ
    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings(); // Áp dụng font, theme
}

// 6. HỆ THỐNG PHÁT NHẠC (PLAYLIST MUSIC PLAYER)
let playlist = [];
let currentTrackIdx = parseInt(localStorage.getItem('bgm_track_idx')) || 0;
const bgm = new Audio();
bgm.loop = false; // Để tự chuyển bài
let isBGMPlaying = false;

// Hàm khởi tạo nhạc (Load từ music.json)
async function initMusic() {
    try {
        const res = await fetch(`music.json?t=${Date.now()}`);
        if(res.ok) playlist = await res.json();
    } catch(e) { console.error("Lỗi tải playlist:", e); }

    // Nếu không có nhạc, dùng bài mặc định trong config
    if (playlist.length === 0) {
        if(typeof CONFIG!=='undefined' && CONFIG.defaultMusic) 
            playlist = [{title: "Default Lofi", url: CONFIG.defaultMusic}];
        else 
            playlist = [{title: "Default Lofi", url: "images/music.mp3"}];
    }
    
    if (currentTrackIdx >= playlist.length) currentTrackIdx = 0;
}

// Hàm tải bài hát vào Player
function loadTrack(index) {
    if (index >= playlist.length) index = 0;
    currentTrackIdx = index;
    bgm.src = playlist[index].url;
    localStorage.setItem('bgm_track_idx', index);
}

// Sự kiện: Hết bài tự chuyển
bgm.addEventListener('ended', nextSong);

// Cập nhật giao diện Player (Icon quay, Nút Play/Pause)
function updatePlayerUI() {
    const icon = document.getElementById('bgm-icon');
    const btn = document.getElementById('bgm-btn');
    if(!icon) return;
    
    if(isBGMPlaying) {
        icon.classList.add('playing');
        btn.innerHTML = '⏸️';
    } else {
        icon.classList.remove('playing');
        btn.innerHTML = '▶️';
    }
}

// Hiện thông báo tên bài hát
function showSongToast() {
    const toast = document.getElementById('song-toast');
    if(toast && playlist[currentTrackIdx]) {
        toast.innerText = `🎵 ${playlist[currentTrackIdx].title}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Hàm bật/tắt nhạc
function toggleBGM() {
    if (!bgm.src) loadTrack(currentTrackIdx);
    
    if (bgm.paused) {
        bgm.play().then(() => {
            isBGMPlaying = true;
            updatePlayerUI();
            localStorage.setItem('bgm_status', 'on');
            if(bgm.currentTime < 1) showSongToast();
        }).catch(e => console.error("Lỗi phát nhạc:", e));
    } else {
        bgm.pause();
        isBGMPlaying = false;
        updatePlayerUI();
        localStorage.setItem('bgm_status', 'off');
    }
}

// Hàm chuyển bài tiếp theo
function nextSong() {
    currentTrackIdx++;
    if (currentTrackIdx >= playlist.length) currentTrackIdx = 0;
    loadTrack(currentTrackIdx);
    
    if (localStorage.getItem('bgm_status') === 'on') {
        bgm.play();
        isBGMPlaying = true;
        updatePlayerUI();
        showSongToast();
    }
}

// Logic Auto-play (Lách luật trình duyệt)
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (bgm.paused && localStorage.getItem('bgm_status') === 'on') {
            if(!bgm.src) loadTrack(currentTrackIdx);
            bgm.play().then(() => {
                isBGMPlaying = true;
                updatePlayerUI();
            });
        }
    }, { once: true });
}

// 7. CÁC TÍNH NĂNG KHÁC (Progress Bar, Hacker Mode, Settings...)

// Thanh tiến độ đọc
function initReadingProgress() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
        const h = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        bar.style.width = `${h > 0 ? (window.scrollY / h) * 100 : 0}%`;
    });
}

// Konami Code (Hacker Mode)
const kCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let kPos = 0;
document.addEventListener('keydown', e => {
    if(e.key === kCode[kPos]) {
        kPos++;
        if(kPos === kCode.length) {
            document.body.classList.toggle('matrix-mode');
            alert('HACKER MODE ' + (document.body.classList.contains('matrix-mode') ? 'ON' : 'OFF'));
            kPos = 0;
        }
    } else {
        kPos = 0;
    }
});

// Cài đặt: Hiện/Ẩn Panel
function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('active');
}

// Cài đặt: Đổi cỡ chữ
function changeFontSize(act) {
    const el = document.getElementById('content-area');
    if(!el) return;
    let s = parseFloat(window.getComputedStyle(el).fontSize);
    s += (act === 'up' ? 2 : -2);
    el.style.fontSize = `${s}px`;
    localStorage.setItem('user_fontSize', s);
}

// Cài đặt: Đổi giao diện Sáng/Tối
function toggleTheme() {
    const t = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', t);
    localStorage.setItem('user_theme', t);
}

// Cài đặt: Đổi Font chữ (Fix lỗi cũ)
function changeFont(f) {
    document.body.classList.remove('font-serif');
    if(f === 'serif') document.body.classList.add('font-serif');
    localStorage.setItem('user_font', f);
}

// Hàm áp dụng cài đặt khi load trang
function applyUserSettings() {
    // Theme
    if(localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    // Font & Size
    const el = document.getElementById('content-area');
    if(el) {
        const s = localStorage.getItem('user_fontSize');
        if(s) el.style.fontSize = `${s}px`;
        
        const f = localStorage.getItem('user_font');
        if(f === 'serif') document.body.classList.add('font-serif');
    }
}

// Hàm hiển thị Bookmark
function loadBookmark(chaps) {
    const id = localStorage.getItem('mirai_bookmark');
    const el = document.getElementById('bookmark-link');
    if(id !== null && chaps[id]) {
        el.style.display = 'inline-flex';
        el.href = `reader.html?id=${id}`;
        el.innerHTML = `📖 Đọc tiếp: ${chaps[id].title.substring(0, 15)}...`;
    }
}

// Hàm load bình luận Giscus
function loadGiscus() {
    const div = document.getElementById('comments');
    if (!div || div.hasChildNodes()) return;
    
    const s = document.createElement('script');
    s.src = "https://giscus.app/client.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-repo", CONFIG.giscus.repo);
    s.setAttribute("data-repo-id", CONFIG.giscus.repoId);
    s.setAttribute("data-category", CONFIG.giscus.category);
    s.setAttribute("data-category-id", CONFIG.giscus.categoryId);
    s.setAttribute("data-mapping", "title");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-theme", "preferred_color_scheme");
    
    div.appendChild(s);
}

// === KHỞI CHẠY CHƯƠNG TRÌNH (MAIN) ===
document.addEventListener('DOMContentLoaded', async () => {
    // Chờ load nhạc xong mới chạy tiếp để tránh lỗi
    await initMusic();
    
    applyUserSettings();

    // Router đơn giản
    if (document.getElementById('chapter-list')) {
        initIndexPage();
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
