// Load Config & Background
if (typeof CONFIG !== 'undefined') {
    document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;
}

// === TIỆN ÍCH CHUNG ===
const showLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'flex';
};
const hideLoading = () => {
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
};

// Hàm lấy dữ liệu (có chống cache để update truyện mới ngay)
async function fetchDB() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        return res.ok ? await res.json() : [];
    } catch { return []; }
}

// === TRANG CHỦ (INDEX) ===
async function initIndex() {
    if (!document.getElementById('chapter-list')) return;
    showLoading();
    
    const chapters = await fetchDB();
    const listEl = document.getElementById('chapter-list');
    const searchInput = document.getElementById('search-input');

    // Hàm render danh sách chương
    const render = (items) => {
        listEl.innerHTML = '';
        if(items.length === 0) { 
            listEl.innerHTML = '<p style="text-align:center">Chưa có chương nào.</p>'; 
            return;
        }
        
        items.forEach((chap, idx) => {
            // Tìm index gốc trong mảng chapters để link đúng
            const originalIndex = chapters.findIndex(c => c.id === chap.id);
            // Fallback: nếu không có id thì dùng index của mảng
            const linkIndex = originalIndex !== -1 ? originalIndex : chapters.indexOf(chap);

            listEl.innerHTML += `
                <a href="reader.html?id=${linkIndex}" class="chap-card">
                    <div style="font-size:0.8em; opacity:0.7">Chương ${idx + 1}</div>
                    ${chap.title}
                </a>
            `;
        });
    };

    // Render lần đầu
    render(chapters);
    hideLoading();
    
    // MỚI: Gọi hàm load bookmark (hiển thị nút Đọc tiếp)
    loadBookmark(chapters);

    // Tính năng tìm kiếm
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = chapters.filter(c => c.title.toLowerCase().includes(term));
            render(filtered);
        });
    }
}

// === TRANG ĐỌC (READER) ===
async function initReader() {
    if (!document.getElementById('content-area')) return;
    showLoading();

    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    const chapters = await fetchDB();

    // Check id hợp lệ
    if (isNaN(id) || !chapters[id]) {
        document.getElementById('content-area').innerHTML = '<h3>Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    // --- MỚI: LƯU BOOKMARK KHI VÀO CHƯƠNG ---
    localStorage.setItem('mirai_bookmark', id);

    const chap = chapters[id];
    document.title = `${chap.title} - ${CONFIG.webName}`;
    const titleEl = document.getElementById('chap-title');
    if (titleEl) titleEl.innerText = chap.title;

    // Load nội dung Markdown từ file
    try {
        const mdRes = await fetch(chap.file + `?t=${Date.now()}`);
        if (!mdRes.ok) throw new Error("File not found");
        const mdText = await mdRes.text();
        // Dùng thư viện marked để convert sang HTML
        document.getElementById('content-area').innerHTML = marked.parse(mdText);
    } catch (e) {
        document.getElementById('content-area').innerText = "Lỗi tải nội dung hoặc file chưa được tạo.";
        console.error(e);
    }

    // Xử lý nút điều hướng (Trước/Sau)
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.onclick = () => window.location.href = `reader.html?id=${id - 1}`;
        if (id === 0) prevBtn.style.display = 'none';
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => window.location.href = `reader.html?id=${id + 1}`;
        if (id === chapters.length - 1) nextBtn.style.display = 'none';
    }

    // Load Giscus (Bình luận)
    loadGiscus();
    hideLoading();

    // Apply cài đặt người dùng (font, theme)
    applyUserSetting();
}

// === MỚI: HÀM XỬ LÝ BOOKMARK (Dùng ở trang chủ) ===
function loadBookmark(chapters) {
    const bookmarkId = localStorage.getItem('mirai_bookmark');
    // Kiểm tra xem bookmark có tồn tại và hợp lệ không
    if (bookmarkId !== null && chapters[bookmarkId]) {
        const link = document.getElementById('bookmark-link');
        const chap = chapters[bookmarkId];
        if (link) {
            link.style.display = 'inline-flex';
            link.href = `reader.html?id=${bookmarkId}`;
            link.innerHTML = `📖 Đọc tiếp: ${chap.title}`;
        }
    }
}

// === GISCUS LOADER (Hệ thống comment) ===
function loadGiscus() {
    const commentSection = document.getElementById('comments');
    if (!commentSection || !CONFIG.giscus) return;

    // Xóa nội dung cũ để tránh duplicate comment box
    commentSection.innerHTML = '';

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
    commentSection.appendChild(script);
}

// === CÀI ĐẶT (DARKMODE & FONT SIZE) ===
function toggleSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.classList.toggle('active');
}

function changeFontSize(action) {
    const content = document.getElementById('content-area');
    if (!content) return;
    
    let currentSize = parseFloat(window.getComputedStyle(content).fontSize);
    if (action === 'up') currentSize += 2;
    else currentSize -= 2;
    
    // Giới hạn size chữ cho đỡ vỡ layout
    if (currentSize < 12) currentSize = 12;
    if (currentSize > 32) currentSize = 32;

    content.style.fontSize = currentSize + 'px';
    localStorage.setItem('user_fontSize', currentSize);
}

function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', next);
    localStorage.setItem('user_theme', next);
}

function applyUserSetting() {
    // Theme
    if (localStorage.getItem('user_theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    
    // Font Size (chỉ áp dụng ở trang đọc)
    const content = document.getElementById('content-area');
    if (content) {
        const size = localStorage.getItem('user_fontSize');
        if (size) content.style.fontSize = size + 'px';
    }
}

// Khởi chạy ứng dụng
applyUserSetting();
if(document.getElementById('chapter-list')) initIndex();
if(document.getElementById('content-area')) initReader();
