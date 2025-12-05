// Load Config & Background
document.body.style.backgroundImage = `url('${CONFIG.bgImage}')`;

// === TIỆN ÍCH CHUNG ===
const showLoading = () => document.getElementById('loading').style.display = 'flex';
const hideLoading = () => document.getElementById('loading').style.display = 'none';

// Hàm lấy dữ liệu (có chống cache)
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

    const render = (items) => {
        listEl.innerHTML = '';
        if(items.length === 0) { listEl.innerHTML = '<p style="text-align:center">Chưa có chương nào.</p>'; return;}
        
        items.forEach((chap, idx) => {
            // Tìm index gốc trong mảng chapters để link đúng
            const originalIndex = chapters.findIndex(c => c.id === chap.id);
            listEl.innerHTML += `
                <a href="reader.html?id=${originalIndex}" class="chap-card">
                    <div style="font-size:0.8em; opacity:0.7">Chương ${idx + 1}</div>
                    ${chap.title}
                </a>
            `;
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

// === TRANG ĐỌC (READER) ===
async function initReader() {
    if (!document.getElementById('content-area')) return;
    showLoading();

    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    const chapters = await fetchDB();

    if (isNaN(id) || !chapters[id]) {
        document.getElementById('content-area').innerHTML = '<h3>Không tìm thấy chương này!</h3>';
        hideLoading();
        return;
    }

    const chap = chapters[id];
    document.title = `${chap.title} - ${CONFIG.webName}`;
    document.getElementById('chap-title').innerText = chap.title;

    // Load nội dung MD
    try {
        const mdRes = await fetch(chap.file + `?t=${Date.now()}`);
        const mdText = await mdRes.text();
        document.getElementById('content-area').innerHTML = marked.parse(mdText);
    } catch {
        document.getElementById('content-area').innerText = "Lỗi tải nội dung.";
    }

    // Điều hướng
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.onclick = () => window.location.href = `reader.html?id=${id - 1}`;
    nextBtn.onclick = () => window.location.href = `reader.html?id=${id + 1}`;
    
    if (id === 0) prevBtn.style.display = 'none';
    if (id === chapters.length - 1) nextBtn.style.display = 'none';

    // Load Giscus (Bình luận)
    loadGiscus();
    hideLoading();

    // Apply cài đặt người dùng
    applyUserSetting();
}

// === GISCUS LOADER ===
function loadGiscus() {
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
    document.getElementById('comments').appendChild(script);
}

// === CÀI ĐẶT (DARKMODE & FONT) ===
function toggleSettings() {
    document.getElementById('settings-panel').classList.toggle('active');
}

function changeFontSize(action) {
    const content = document.getElementById('content-area');
    let currentSize = parseFloat(window.getComputedStyle(content).fontSize);
    if (action === 'up') currentSize += 2;
    else currentSize -= 2;
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
    
    // Font Size (chỉ ở trang đọc)
    if (document.getElementById('content-area')) {
        const size = localStorage.getItem('user_fontSize');
        if (size) document.getElementById('content-area').style.fontSize = size + 'px';
    }
}

// Khởi chạy
applyUserSetting();
if(document.getElementById('chapter-list')) initIndex();
if(document.getElementById('content-area')) initReader();
