// =================================================================
// MIRAI PROJECT - CORE SCRIPT V7.7 (EXTENDED & FULLY FIXED)
// Tác giả: NamuTachi
// Phiên bản: Hỗ trợ Databook, Fix lỗi Path, Full Logic
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
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
};

// Hàm ẩn màn hình chờ
const hideLoading = () => {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
};

// -----------------------------------------------------------------
// 2. TƯƠNG TÁC DỮ LIỆU (DATABASE)
// -----------------------------------------------------------------

// Hàm lấy dữ liệu từ file JSON bất kỳ
async function fetchDatabase(jsonFile = 'data.json') {
    try {
        // Thêm timestamp để tránh cache
        const response = await fetch(`${jsonFile}?t=${Date.now()}`);
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
// 3. LOGIC TRANG CHỦ & LIST (INDEX PAGE)
// -----------------------------------------------------------------

async function initIndexPage(jsonFile = 'data.json', folderPrefix = 'chapters') {
    const chapterListElement = document.getElementById('chapter-list');
    
    // Nếu không tìm thấy element này -> Không phải trang list -> Thoát
    if (!chapterListElement) return;

    showLoading();
    const allItems = await fetchDatabase(jsonFile);
    const searchInput = document.getElementById('search-input');
    
    // Hiển thị nút "Đọc tiếp" (Bookmark) CHỈ NẾU là truyện chính
    if (folderPrefix === 'chapters') {
        const bookmarkLink = document.getElementById('bookmark-link');
        if (bookmarkLink) {
            loadBookmark(allItems);
        }
    }

    // Hàm vẽ danh sách chương ra màn hình
    const renderItems = (items) => {
        chapterListElement.innerHTML = '';
        
        if (items.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center; width: 100%;">Chưa có nội dung nào được đăng.</p>';
            return;
        }

        // Lọc các chương đã đến giờ đăng (Logic Hẹn giờ)
        const currentTime = Date.now();
        const visibleItems = items.filter(item => {
            if (!item.timestamp) return true; // Không hẹn giờ -> Hiện luôn
            return item.timestamp <= currentTime; // Đã qua giờ hẹn -> Hiện
        });

        if (visibleItems.length === 0) {
            chapterListElement.innerHTML = '<p style="text-align:center;">Chưa có mục nào đến giờ phát hành.</p>';
            return;
        }

        visibleItems.forEach((item) => {
            // Tìm index gốc trong mảng allItems để tạo link đúng
            const originalIndex = allItems.findIndex(c => c.id === item.id);
            
            if (originalIndex !== -1) {
                // Thêm tham số &db=... để trang đọc biết file này thuộc mục nào
                chapterListElement.innerHTML += `
                    <a href="reader.html?id=${originalIndex}&db=${folderPrefix}" class="chap-card">
                        <div>${item.title}</div>
                    </a>
                `;
            }
        });
    };

    // Vẽ danh sách lần đầu
    renderItems(allItems);
    hideLoading();

    // Kích hoạt tính năng tìm kiếm
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const keyword = event.target.value.toLowerCase();
            const filteredItems = allItems.filter(c => c.title.toLowerCase().includes(keyword));
            renderItems(filteredItems);
        });
    }
}

// -----------------------------------------------------------------
// 4. LOGIC TRANG ĐỌC (READER PAGE - ĐÃ FIX LỖI PATH)
// -----------------------------------------------------------------

async function initReaderPage() {
    const contentElement = document.getElementById('content-area');
    
    // Nếu không tìm thấy element này -> Không phải trang đọc -> Thoát
    if (!contentElement) return;

    showLoading();
    
    // Lấy các tham số từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const customFile = urlParams.get('file'); // Dùng cho file lẻ (VD: lore.md)
    const chapterId = parseInt(urlParams.get('id')); // Dùng cho file trong list
    const dbPrefix = urlParams.get('db') || 'chapters'; // Mặc định là truyện chính
    
    // Xác định file JSON và link quay về
    const jsonFile = (dbPrefix === 'chapters') ? 'data.json' : `data_${dbPrefix}.json`;
    const backLink = (dbPrefix === 'chapters') ? 'index.html' : `list.html?db=${dbPrefix}`;
    
    // Cập nhật nút "Quay về" trên giao diện
    const homeBtn = document.querySelector('.reader-controls a');
    if (homeBtn) {
        homeBtn.href = backLink;
    }

    // --- TRƯỜNG HỢP 1: ĐỌC FILE LẺ (CUSTOM FILE) ---
    if (customFile) {
        document.title = "Tài liệu MirAi";
        document.getElementById('chap-title').innerText = "Tài liệu Lưu trữ";
        // Ẩn nút điều hướng vì file lẻ không có trước/sau
        document.getElementById('prev-btn').style.display = 'none';
        document.getElementById('next-btn').style.display = 'none';
        
        try {
            const response = await fetch(`${customFile}?t=${Date.now()}`);
            if (!response.ok) throw new Error("File not found");
            const markdownText = await response.text();
            contentElement.innerHTML = marked.parse(markdownText);
        } catch (e) {
            contentElement.innerText = "Lỗi tải tài liệu: " + e.message;
        }
        
        hideLoading();
        applyUserSettings();
        loadGiscus();
        return; // Kết thúc hàm
    }

    // --- TRƯỜNG HỢP 2: ĐỌC TỪ DANH SÁCH (DATABASE) ---
    const chapters = await fetchDatabase(jsonFile);

    // Kiểm tra ID có hợp lệ không
    if (isNaN(chapterId) || !chapters[chapterId]) {
        contentElement.innerHTML = '<h3>Lỗi: Không tìm thấy mục này!</h3>';
        hideLoading();
        return;
    }

    // Bảo mật Hẹn giờ
    const currentChapter = chapters[chapterId];
    if (currentChapter.timestamp && currentChapter.timestamp > Date.now()) {
        alert("⛔ Mục này chưa đến giờ phát hành!");
        window.location.href = backLink;
        return;
    }

    // Lưu Bookmark (Chỉ lưu cho truyện chính để tránh loạn)
    if (dbPrefix === 'chapters') {
        localStorage.setItem('mirai_bookmark', chapterId);
    }

    // Cập nhật tiêu đề
    document.title = `${currentChapter.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = currentChapter.title;

    // Tải nội dung Markdown và render
    try {
        // [FIX QUAN TRỌNG NHẤT]: Luôn dùng đường dẫn gốc trong JSON
        // Admin Tool đã lưu full path (VD: wiki/minh.md), nên không cần cộng chuỗi nữa.
        const filePath = currentChapter.file;
        
        const response = await fetch(`${filePath}?t=${Date.now()}`);
        if (!response.ok) throw new Error("File not found: " + filePath);
        
        const markdownText = await response.text();
        contentElement.innerHTML = marked.parse(markdownText);
    } catch (error) {
        contentElement.innerText = "Lỗi tải nội dung: " + error.message;
        console.error(error);
    }

    // Xử lý nút điều hướng (Trước/Sau)
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    // Cập nhật link cho nút điều hướng (phải kèm theo &db=...)
    prevBtn.onclick = () => window.location.href = `reader.html?id=${chapterId - 1}&db=${dbPrefix}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${chapterId + 1}&db=${dbPrefix}`;
    
    // Ẩn nút nếu ở đầu/cuối danh sách
    if (chapterId === 0) {
        prevBtn.style.display = 'none';
    }
    if (chapterId >= chapters.length - 1) {
        nextBtn.style.display = 'none';
    }

    // Kích hoạt các tính năng phụ
    initReadingProgress();
    loadGiscus();
    hideLoading();
    applyUserSettings();
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
        const response = await fetch(`music.json?t=${Date.now()}`);
        if (response.ok) {
            musicPlaylist = await response.json();
        }
    } catch (error) {
        console.error("Lỗi tải nhạc:", error);
    }

    // Nếu không có nhạc nào, dùng bài mặc định
    if (musicPlaylist.length === 0) {
        if (typeof CONFIG !== 'undefined' && CONFIG.defaultMusic) {
            musicPlaylist = [{ title: "Default Lofi", url: CONFIG.defaultMusic }];
        } else {
            musicPlaylist = [{ title: "Default Lofi", url: "images/music.mp3" }];
        }
    }
    
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

// Cập nhật giao diện Player
function updatePlayerUI() {
    const icon = document.getElementById('bgm-icon');
    const btn = document.getElementById('bgm-controls');
    
    if (!icon || !btn) return;
    
    if (isMusicPlaying) {
        icon.classList.add('playing');
        btn.innerHTML = '⏸️';
    } else {
        icon.classList.remove('playing');
        btn.innerHTML = '▶️';
    }
}

// Hàm Bật/Tắt nhạc
function toggleBGM() {
    if (!audioPlayer.src) loadTrack(currentTrackIndex);
    
    if (audioPlayer.paused) {
        audioPlayer.play().then(() => {
            isMusicPlaying = true;
            updatePlayerUI();
            localStorage.setItem('bgm_status', 'on');
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

// Hàm chuyển bài tiếp theo
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

// Tự phát nhạc sau cú click đầu tiên (Lách luật trình duyệt)
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

// -----------------------------------------------------------------
// 6. CÁC TÍNH NĂNG KHÁC (UI UTILS)
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

// Settings: Đổi Font (Đã fix lỗi logic)
function changeFont(fontName) {
    if (fontName === 'serif') {
        document.body.setAttribute('data-font', 'serif');
    } else {
        document.body.removeAttribute('data-font');
    }
    localStorage.setItem('user_font', fontName);
}

// Áp dụng cài đặt khi load trang
function applyUserSettings() {
    // Theme
    if (localStorage.getItem('user_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    
    // Font Size
    const content = document.getElementById('content-area');
    if (content) {
        const size = localStorage.getItem('user_fontSize');
        if (size) content.style.fontSize = `${size}px`;
    }
    
    // Font Family
    if (localStorage.getItem('user_font') === 'serif') {
        document.body.setAttribute('data-font', 'serif');
    }
}

// Bookmark
function loadBookmark(chapters) {
    const id = localStorage.getItem('mirai_bookmark');
    const linkEl = document.getElementById('bookmark-link');
    if (id !== null && chapters[id] && linkEl) {
        linkEl.style.display = 'inline-flex';
        linkEl.href = `reader.html?id=${id}&db=chapters`;
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
    
    // Áp dụng cài đặt giao diện
    applyUserSettings();

    // Điều hướng logic theo trang hiện tại
    const path = window.location.pathname;
    
    if (document.getElementById('chapter-list')) {
        // Nếu là trang index.html hoặc root
        if (path.endsWith('/') || path.endsWith('index.html')) {
            initIndexPage();
        }
        // Nếu là trang list.html thì nó tự gọi initIndexPage trong file HTML của nó
    } 
    else if (document.getElementById('content-area')) {
        // Nếu là trang đọc truyện
        initReaderPage();
    }
});
