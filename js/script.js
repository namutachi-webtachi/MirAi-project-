// =================================================================
// MIRAI PROJECT - CORE SCRIPT V7.0 (DEVELOPER EDITION)
// Tác giả: NamuTachi
// Mô tả: Xử lý toàn bộ logic Frontend (Web, Nhạc, Truyện, UI)
// =================================================================

// -----------------------------------------------------------------
// 1. KHỞI TẠO CẤU HÌNH & MÔI TRƯỜNG
// -----------------------------------------------------------------

// Kiểm tra và load ảnh nền từ file config.js
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}

// Hàm hiển thị màn hình chờ (Loading)
const showLoading = () => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'flex';
};

// Hàm ẩn màn hình chờ
const hideLoading = () => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'none';
};

// -----------------------------------------------------------------
// 2. TƯƠNG TÁC DỮ LIỆU (DATABASE)
// -----------------------------------------------------------------

// Hàm lấy dữ liệu từ file data.json trên GitHub
// Thêm tham số timestamp (?t=...) để ép trình duyệt tải mới, không dùng cache cũ
async function fetchDatabase() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        if (response.ok) {
            return await response.json();
        } else {
            return []; // Trả về mảng rỗng nếu lỗi
        }
    } catch (error) {
        console.error("Lỗi khi tải Database:", error);
        return [];
    }
}

// -----------------------------------------------------------------
// 3. LOGIC TRANG CHỦ (INDEX PAGE)
// -----------------------------------------------------------------

async function initIndexPage() {
    const chapterListElement = document.getElementById('chapter-list');
    
    // Nếu không tìm thấy element này -> Không phải trang chủ -> Thoát
    if (!chapterListElement) return;

    showLoading();
    const chapters = await fetchDatabase();
    const searchInput = document.getElementById('search-input');
    
    // Hiển thị nút "Đọc tiếp" nếu có lịch sử
    loadBookmark(chapters);

    // Hàm vẽ danh sách chương ra màn hình
    const renderChapters = (items) => {
        chapterListElement.innerHTML = '';
        
        if (items.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center; width: 100%;">Chưa có chương nào được đăng.</p>';
            return;
        }

        // Lọc các chương đã đến giờ đăng (Logic Hẹn giờ)
        const currentTime = Date.now();
        const visibleItems = items.filter(item => {
            if (!item.timestamp) return true; // Không hẹn giờ -> Hiện luôn
            return item.timestamp <= currentTime; // Đã qua giờ hẹn -> Hiện
        });

        if (visibleItems.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center;">Chưa có chương nào đến giờ phát hành.</p>';
            return;
        }

        visibleItems.forEach((item) => {
            // Tìm index gốc trong mảng chapters để tạo link đúng
            const originalIndex = chapters.findIndex(c => c.id === item.id);
            
            if (originalIndex !== -1) {
                chapterListElement.innerHTML += `
                    <a href="reader.html?id=${originalIndex}" class="chap-card">
                        <div>${item.title}</div>
                    </a>
                `;
            }
        });
    };

    // Vẽ danh sách lần đầu
    renderChapters(chapters);
    hideLoading();

    // Kích hoạt tính năng tìm kiếm
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const keyword = event.target.value.toLowerCase();
            const filteredChapters = chapters.filter(c => c.title.toLowerCase().includes(keyword));
            renderChapters(filteredChapters);
        });
    }
}

// -----------------------------------------------------------------
// 4. LOGIC TRANG ĐỌC (READER PAGE)
// -----------------------------------------------------------------

async function initReaderPage() {
    const contentElement = document.getElementById('content-area');
    
    // Nếu không tìm thấy element này -> Không phải trang đọc -> Thoát
    if (!contentElement) return;

    showLoading();
    
    // Lấy ID chương từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = parseInt(urlParams.get('id'));
    const chapters = await fetchDatabase();

    // Kiểm tra ID có hợp lệ không
    if (isNaN(chapterId) || !chapters[chapterId]) {
        contentElement.innerHTML = '<h3>Lỗi: Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    // Bảo mật Hẹn giờ: Chặn truy cập trực tiếp nếu chưa đến giờ
    const currentChapter = chapters[chapterId];
    if (currentChapter.timestamp && currentChapter.timestamp > Date.now()) {
        alert("⛔ Chương này chưa đến giờ phát hành!");
        window.location.href = "index.html";
        return;
    }

    // Lưu Bookmark
    localStorage.setItem('mirai_bookmark', chapterId);

    // Cập nhật tiêu đề
    document.title = `${currentChapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = currentChapter.title;

    // Tải nội dung Markdown và render
    try {
        const response = await fetch(`${currentChapter.file}?t=${Date.now()}`);
        const markdownText = await response.text();
        contentElement.innerHTML = marked.parse(markdownText);
    } catch (error) {
        contentElement.innerText = "Lỗi tải nội dung chương.";
    }

    // Xử lý nút điều hướng (Trước/Sau)
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}`;
    
    if (chapterId === 0) prevBtn.style.display = 'none';
    if (chapterId === chapters.length - 1) nextBtn.style.display = 'none';

    // Kích hoạt các tính năng phụ
    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings(); // Áp dụng cài đặt người dùng
}

// -----------------------------------------------------------------
// 5. HỆ THỐNG ÂM NHẠC (PLAYLIST & PLAYER)
// -----------------------------------------------------------------

let musicPlaylist = [];
let currentTrackIndex = parseInt(localStorage.getItem('bgm_track_idx')) || 0;
const audioPlayer = new Audio();
audioPlayer.loop = false; // Tắt loop để tự chuyển bài
let isMusicPlaying = false;

// Khởi tạo hệ thống nhạc
async function initMusicSystem() {
    try {
        // Tải danh sách nhạc từ music.json
        const response = await fetch(`music.json?t=${Date.now()}`);
        if (response.ok) {
            musicPlaylist = await response.json();
        }
    } catch (error) {
        // console.error("Không tải được playlist, dùng mặc định.");
    }

    // Nếu không có nhạc nào, dùng bài mặc định trong Config
    if (musicPlaylist.length === 0) {
        if (typeof CONFIG !== 'undefined' && CONFIG.defaultMusic) {
            musicPlaylist = [{ title: "Default Lofi", url: CONFIG.defaultMusic }];
        } else {
            musicPlaylist = [{ title: "Default Lofi", url: "images/music.mp3" }];
        }
    }
    
    // Đảm bảo index không vượt quá độ dài playlist
    if (currentTrackIndex >= musicPlaylist.length) currentTrackIndex = 0;
}

// Hàm tải bài hát vào Player
function loadTrack(index) {
    if (index >= musicPlaylist.length) index = 0;
    currentTrackIndex = index;
    
    audioPlayer.src = musicPlaylist[index].url;
    localStorage.setItem('bgm_track_idx', index);
}

// Sự kiện: Khi hết bài thì tự chuyển bài tiếp theo
audioPlayer.addEventListener('ended', playNextSong);

// Cập nhật giao diện Player (Icon quay, Nút Play/Pause)
function updatePlayerUI() {
    const icon = document.getElementById('bgm-icon');
    const btn = document.getElementById('bgm-btn');
    
    if (!icon) return;
    
    if (isMusicPlaying) {
        icon.classList.add('playing');
        btn.innerHTML = '⏸️';
    } else {
        icon.classList.remove('playing');
        btn.innerHTML = '▶️';
    }
}

// Hiện thông báo tên bài hát (Toast)
function showSongNotification() {
    const toast = document.getElementById('song-toast');
    if (toast && musicPlaylist[currentTrackIndex]) {
        toast.innerText = `🎵 ${musicPlaylist[currentTrackIndex].title}`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Hàm Bật/Tắt nhạc (Toggle)
function toggleBGM() {
    // Nếu chưa có source thì load
    if (!audioPlayer.src) loadTrack(currentTrackIndex);
    
    if (audioPlayer.paused) {
        audioPlayer.play().then(() => {
            isMusicPlaying = true;
            updatePlayerUI();
            localStorage.setItem('bgm_status', 'on');
            
            // Chỉ hiện thông báo nếu bài hát mới bắt đầu
            if (audioPlayer.currentTime < 1) showSongNotification();
        }).catch(error => {
            console.error("Lỗi phát nhạc:", error);
        });
    } else {
        audioPlayer.pause();
        isMusicPlaying = false;
        updatePlayerUI();
        localStorage.setItem('bgm_status', 'off');
    }
}

// Hàm chuyển bài tiếp theo (Next)
function playNextSong() {
    currentTrackIndex++;
    if (currentTrackIndex >= musicPlaylist.length) currentTrackIndex = 0;
    
    loadTrack(currentTrackIndex);
    
    // Nếu đang bật nhạc thì tự phát bài mới
    if (localStorage.getItem('bgm_status') === 'on') {
        audioPlayer.play();
        isMusicPlaying = true;
        updatePlayerUI();
        showSongNotification();
    }
}

// Logic "Lách luật" trình duyệt: Tự phát nhạc sau cú click đầu tiên
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (audioPlayer.paused && localStorage.getItem('bgm_status') === 'on') {
            if (!audioPlayer.src) loadTrack(currentTrackIndex);
            
            audioPlayer.play().then(() => {
                isMusicPlaying = true;
                updatePlayerUI();
            });
        }
    }, { once: true }); // Chỉ chạy 1 lần duy nhất
}

// -----------------------------------------------------------------
// 6. CÁC TÍNH NĂNG KHÁC (THANH TIẾN ĐỘ, HACKER MODE, SETTINGS)
// -----------------------------------------------------------------

// Thanh tiến độ đọc
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

// Konami Code (Hacker Mode)
const konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIndex = 0;

document.addEventListener('keydown', (event) => {
    if (event.key === konamiSequence[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiSequence.length) {
            document.body.classList.toggle('matrix-mode');
            const status = document.body.classList.contains('matrix-mode') ? 'ON' : 'OFF';
            alert(`HACKER MODE: ${status}`);
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

// Settings: Hiện/Ẩn Panel
function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('active');
}

// Settings: Đổi cỡ chữ
function changeFontSize(action) {
    const content = document.getElementById('content-area');
    if (!content) return;
    
    let size = parseFloat(window.getComputedStyle(content).fontSize);
    size += (action === 'up' ? 2 : -2);
    content.style.fontSize = `${size}px`;
    localStorage.setItem('user_fontSize', size);
}

// Settings: Đổi Theme
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('user_theme', nextTheme);
}

// Settings: Đổi Font
function changeFont(fontName) {
    document.body.classList.remove('font-serif');
    if (fontName === 'serif') {
        document.body.classList.add('font-serif');
    }
    localStorage.setItem('user_font', fontName);
}

// Áp dụng cài đặt khi load trang
function applyUserSettings() {
    if (localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    const content = document.getElementById('content-area');
    if (content) {
        const size = localStorage.getItem('user_fontSize');
        if (size) content.style.fontSize = `${size}px`;
        const font = localStorage.getItem('user_font');
        if (font === 'serif') document.body.classList.add('font-serif');
    }
}

// Bookmark
function loadBookmark(chapters) {
    const id = localStorage.getItem('mirai_bookmark');
    const linkEl = document.getElementById('bookmark-link');
    if (id !== null && chapters[id]) {
        linkEl.style.display = 'inline-flex';
        linkEl.href = `reader.html?id=${id}`;
        linkEl.innerHTML = `📖 Đọc tiếp: ${chapters[id].title.substring(0, 15)}...`;
    }
}

// Bình luận Giscus
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

// -----------------------------------------------------------------
// 7. KHỞI CHẠY (MAIN ENTRY POINT)
// -----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // Chờ tải nhạc xong mới chạy logic khác
    await initMusicSystem();
    
    // Áp dụng cài đặt
    applyUserSettings();

    // Điều hướng logic theo trang
    if (document.getElementById('chapter-list')) {
        initIndexPage();
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
