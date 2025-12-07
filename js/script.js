/**
 * ====================================================================
 * MIRAI PROJECT - CORE SCRIPT V7.0 (DEVELOPER EDITION)
 * Tác giả: NamuTachi & AI Assistant
 * Mô tả: Xử lý toàn bộ logic của web (Truyện, Nhạc, Giao diện, Bảo mật)
 * ====================================================================
 */

// --------------------------------------------------------------------
// 1. KHỞI TẠO CẤU HÌNH & TIỆN ÍCH CƠ BẢN
// --------------------------------------------------------------------

// Load ảnh nền từ file config.js
if (typeof CONFIG !== 'undefined' && CONFIG.bgImage) {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}

// Hàm hiển thị màn hình chờ (Loading)
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'flex';
}

// Hàm ẩn màn hình chờ
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) loadingElement.style.display = 'none';
}

// Hàm lấy dữ liệu từ Server (GitHub)
// Thêm timestamp (?t=...) để tránh việc trình duyệt lưu cache dữ liệu cũ
async function fetchDatabase() {
    try {
        const response = await fetch(`data.json?t=${Date.now()}`);
        if (response.ok) {
            return await response.json();
        } else {
            console.warn("Không tìm thấy file data.json");
            return [];
        }
    } catch (error) {
        console.error("Lỗi khi tải Database:", error);
        return [];
    }
}

// --------------------------------------------------------------------
// 2. LOGIC TRANG CHỦ (INDEX PAGE)
// --------------------------------------------------------------------

async function initIndexPage() {
    const chapterListElement = document.getElementById('chapter-list');
    
    // Nếu không tìm thấy element này nghĩa là không phải trang chủ -> Thoát
    if (!chapterListElement) return;

    showLoading();
    const chapters = await fetchDatabase();
    const searchInput = document.getElementById('search-input');
    
    // Hiển thị nút "Đọc tiếp" nếu có bookmark
    checkBookmark(chapters);

    // Hàm vẽ danh sách chương ra màn hình
    const renderChapters = (items) => {
        chapterListElement.innerHTML = '';
        
        // --- LOGIC HẸN GIỜ (SCHEDULER) ---
        const currentTime = Date.now();
        const visibleItems = items.filter(item => {
            // Nếu không có hẹn giờ -> Hiện luôn
            if (!item.timestamp) return true;
            // Nếu thời gian hẹn <= thời gian hiện tại -> Hiện
            return item.timestamp <= currentTime;
        });
        // ---------------------------------

        if (visibleItems.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center;">Chưa có chương nào được đăng.</p>';
            return;
        }

        visibleItems.forEach((item) => {
            // Tìm vị trí thực của chương trong mảng gốc để tạo link đúng
            const originalIndex = chapters.findIndex(c => c.id === item.id);
            
            if (originalIndex !== -1) {
                chapterListElement.innerHTML += `
                    <a href="reader.html?id=${originalIndex}" class="chap-card">
                        <div>${item.title}</div>
                    </a>`;
            }
        });
    };

    // Vẽ danh sách lần đầu
    renderChapters(chapters);
    hideLoading();

    // Kích hoạt tính năng tìm kiếm
    searchInput.addEventListener('input', (event) => {
        const keyword = event.target.value.toLowerCase();
        const filteredChapters = chapters.filter(c => c.title.toLowerCase().includes(keyword));
        renderChapters(filteredChapters);
    });
}

// --------------------------------------------------------------------
// 3. LOGIC TRANG ĐỌC (READER PAGE)
// --------------------------------------------------------------------

async function initReaderPage() {
    const contentElement = document.getElementById('content-area');
    
    // Nếu không tìm thấy element này nghĩa là không phải trang đọc -> Thoát
    if (!contentElement) return;

    showLoading();
    
    // Lấy ID chương từ đường dẫn URL (ví dụ: reader.html?id=5)
    const urlParams = new URLSearchParams(window.location.search);
    const chapterIndex = parseInt(urlParams.get('id'));
    const chapters = await fetchDatabase();

    // Kiểm tra ID có hợp lệ không
    if (isNaN(chapterIndex) || !chapters[chapterIndex]) {
        contentElement.innerHTML = '<h3>Lỗi: Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    // Lưu lại Bookmark
    localStorage.setItem('mirai_bookmark', chapterIndex);

    const currentChapter = chapters[chapterIndex];
    
    // Cập nhật tiêu đề tab và tiêu đề trang
    document.title = `${currentChapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = currentChapter.title;

    // Tải nội dung file Markdown (.md)
    try {
        const response = await fetch(`${currentChapter.file}?t=${Date.now()}`);
        const markdownText = await response.text();
        // Chuyển đổi Markdown sang HTML bằng thư viện Marked
        contentElement.innerHTML = marked.parse(markdownText);
    } catch (error) {
        contentElement.innerText = "Lỗi tải nội dung chương. Vui lòng kiểm tra lại đường dẫn file.";
        console.error(error);
    }

    // Xử lý nút Chuyển chương (Trước / Sau)
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterIndex - 1}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterIndex + 1}`;
    
    // Ẩn nút nếu đang ở chương đầu hoặc chương cuối
    if (chapterIndex === 0) prevBtn.style.display = 'none';
    if (chapterIndex === chapters.length - 1) nextBtn.style.display = 'none';

    // Kích hoạt các tính năng phụ trợ
    initProgressBar();      // Thanh tiến độ
    initGiscusComment();    // Bình luận
    applyUserSettings();    // Cài đặt font/màu
    
    hideLoading();
}

// --------------------------------------------------------------------
// 4. HỆ THỐNG ÂM NHẠC (DJ STATION - PLAYLIST)
// --------------------------------------------------------------------

let musicPlaylist = [];
let currentTrackIndex = parseInt(localStorage.getItem('bgm_track_idx')) || 0;
const audioPlayer = new Audio();
audioPlayer.loop = false; // Tắt lặp 1 bài để hỗ trợ chuyển bài
let isMusicPlaying = false;

// Hàm khởi tạo nhạc (Load từ music.json)
async function initMusicSystem() {
    try {
        const response = await fetch(`music.json?t=${Date.now()}`);
        if (response.ok) {
            musicPlaylist = await response.json();
        }
    } catch (error) {
        console.log("Chưa có file music.json, sử dụng cấu hình mặc định.");
    }

    // Nếu không có nhạc nào, dùng bài mặc định trong config.js
    if (musicPlaylist.length === 0) {
        if (typeof CONFIG !== 'undefined' && CONFIG.defaultMusic) {
            musicPlaylist = [{ title: "Default Lofi", url: CONFIG.defaultMusic }];
        } else {
            musicPlaylist = [{ title: "Default Lofi", url: "images/music.mp3" }];
        }
    }
    
    // Đảm bảo index không vượt quá danh sách
    if (currentTrackIndex >= musicPlaylist.length) currentTrackIndex = 0;
}

// Hàm tải bài hát vào Player
function loadTrack(index) {
    if (index >= musicPlaylist.length) index = 0;
    currentTrackIndex = index;
    
    audioPlayer.src = musicPlaylist[index].url;
    
    // Lưu lại vị trí bài hát đang nghe
    localStorage.setItem('bgm_track_idx', index);
}

// Sự kiện: Khi hết bài thì tự chuyển bài tiếp theo
audioPlayer.addEventListener('ended', playNextSong);

// Cập nhật giao diện (Icon xoay, Nút Play/Pause)
function updatePlayerUI() {
    const icon = document.getElementById('bgm-icon');
    const btn = document.getElementById('bgm-btn');
    
    if (!icon) return; // Nếu không có icon (ví dụ ở trang khác) thì bỏ qua
    
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
        
        // Ẩn sau 3 giây
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Hàm bật/tắt nhạc (Được gọi khi bấm vào đĩa than)
function toggleBGM() {
    // Nếu chưa load source thì load ngay
    if (!audioPlayer.src) loadTrack(currentTrackIndex);
    
    if (audioPlayer.paused) {
        audioPlayer.play().then(() => {
            isMusicPlaying = true;
            updatePlayerUI();
            localStorage.setItem('bgm_status', 'on');
            
            // Chỉ hiện thông báo nếu bài hát mới bắt đầu
            if (audioPlayer.currentTime < 1) showSongNotification();
        }).catch(error => {
            console.error("Lỗi phát nhạc (Có thể do trình duyệt chặn):", error);
        });
    } else {
        audioPlayer.pause();
        isMusicPlaying = false;
        updatePlayerUI();
        localStorage.setItem('bgm_status', 'off');
    }
}

// Hàm chuyển bài tiếp theo
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

// Logic Auto-play (Lách luật trình duyệt)
// Chờ người dùng click lần đầu tiên vào web để kích hoạt nhạc
if (localStorage.getItem('bgm_status') === 'on') {
    document.body.addEventListener('click', () => {
        if (audioPlayer.paused && localStorage.getItem('bgm_status') === 'on') {
            if (!audioPlayer.src) loadTrack(currentTrackIndex);
            
            audioPlayer.play().then(() => {
                isMusicPlaying = true;
                updatePlayerUI();
            });
        }
    }, { once: true }); // Sự kiện này chỉ chạy 1 lần duy nhất
}

// --------------------------------------------------------------------
// 5. CÁC TÍNH NĂNG PHỤ TRỢ (SETTINGS, TOOLS)
// --------------------------------------------------------------------

// Thanh tiến độ đọc (Reading Progress Bar)
function initProgressBar() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;
    
    window.addEventListener('scroll', () => {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progressPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        
        bar.style.width = `${progressPercent}%`;
    });
}

// Konami Code (Hacker Mode - Easter Egg)
const konamiSequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIndex = 0;

document.addEventListener('keydown', (event) => {
    if (event.key === konamiSequence[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiSequence.length) {
            document.body.classList.toggle('matrix-mode');
            const status = document.body.classList.contains('matrix-mode') ? 'KÍCH HOẠT' : 'TẮT';
            alert(`HACKER MODE: ${status}`);
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0; // Reset nếu bấm sai
    }
});

// Panel Cài đặt: Hiện/Ẩn
function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('active');
}

// Panel Cài đặt: Đổi cỡ chữ
function changeFontSize(action) {
    const content = document.getElementById('content-area');
    if (!content) return;
    
    let currentSize = parseFloat(window.getComputedStyle(content).fontSize);
    
    if (action === 'up') currentSize += 2;
    else currentSize -= 2;
    
    content.style.fontSize = `${currentSize}px`;
    localStorage.setItem('user_fontSize', currentSize);
}

// Panel Cài đặt: Đổi giao diện Sáng/Tối
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', nextTheme);
    localStorage.setItem('user_theme', nextTheme);
}

// Panel Cài đặt: Đổi Font chữ
function changeFont(fontName) {
    document.body.classList.remove('font-serif');
    
    if (fontName === 'serif') {
        document.body.classList.add('font-serif');
    }
    
    localStorage.setItem('user_font', fontName);
}

// Hàm áp dụng cài đặt người dùng khi tải trang
function applyUserSettings() {
    // 1. Áp dụng Theme
    if (localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    
    // 2. Áp dụng Font & Size (Chỉ ở trang đọc)
    const contentArea = document.getElementById('content-area');
    if (contentArea) {
        const savedSize = localStorage.getItem('user_fontSize');
        if (savedSize) contentArea.style.fontSize = `${savedSize}px`;
        
        const savedFont = localStorage.getItem('user_font');
        if (savedFont === 'serif') document.body.classList.add('font-serif');
    }
}

// Hàm hiển thị Bookmark ở trang chủ
function checkBookmark(chapters) {
    const bookmarkId = localStorage.getItem('mirai_bookmark');
    const bookmarkBtn = document.getElementById('bookmark-link');
    
    if (bookmarkId !== null && chapters[bookmarkId]) {
        bookmarkBtn.style.display = 'inline-flex';
        bookmarkBtn.href = `reader.html?id=${bookmarkId}`;
        // Cắt tên chương nếu dài quá
        const shortTitle = chapters[bookmarkId].title.substring(0, 15) + '...';
        bookmarkBtn.innerHTML = `📖 Đọc tiếp: ${shortTitle}`;
    }
}

// Hàm tải hệ thống bình luận Giscus
function initGiscusComment() {
    const commentContainer = document.getElementById('comments');
    // Kiểm tra nếu đã load rồi thì thôi
    if (!commentContainer || commentContainer.hasChildNodes()) return;
    
    const script = document.createElement('script');
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    
    // Các thuộc tính cấu hình Giscus lấy từ config.js
    script.setAttribute("data-repo", CONFIG.giscus.repo);
    script.setAttribute("data-repo-id", CONFIG.giscus.repoId);
    script.setAttribute("data-category", CONFIG.giscus.category);
    script.setAttribute("data-category-id", CONFIG.giscus.categoryId);
    script.setAttribute("data-mapping", "title");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-theme", "preferred_color_scheme");
    
    commentContainer.appendChild(script);
}

// --------------------------------------------------------------------
// 6. HỆ THỐNG BẢO VỆ BẢN QUYỀN (ANTI-COPY)
// --------------------------------------------------------------------

(function enableAntiCopy() {
    // Không chặn ở trang Admin
    if (window.location.href.includes("admin.html")) return;

    // Chặn chuột phải
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Chặn phím tắt (Ctrl+C, Ctrl+X...)
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && (e.key === 'c' || e.key === 'x' || e.key === 'u' || e.key === 's')) {
            e.preventDefault();
        }
    });

    // Chặn bôi đen bằng CSS
    const style = document.createElement('style');
    style.innerHTML = `
        body { 
            -webkit-user-select: none; 
            -moz-user-select: none; 
            -ms-user-select: none; 
            user-select: none; 
        }
        input, textarea { user-select: text; } /* Cho phép nhập liệu */
    `;
    document.head.appendChild(style);
})();

// --------------------------------------------------------------------
// 7. KHỞI CHẠY ỨNG DỤNG (MAIN)
// --------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // Chờ tải danh sách nhạc xong mới chạy tiếp để tránh lỗi
    await initMusicSystem();
    
    // Áp dụng cài đặt giao diện
    applyUserSettings();

    // Điều hướng (Router)
    if (document.getElementById('chapter-list')) {
        initIndexPage();
    } else if (document.getElementById('content-area')) {
        initReaderPage();
    }
});
