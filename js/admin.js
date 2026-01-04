// =================================================================
// MIRAI ADMIN SCRIPT V28 (STABLE LOGIN & DATABOOK)
// =================================================================

const SECRET_PASS = "2006";
let editor;
let currentDB = 'main'; // Mặc định quản lý Truyện Chính

// --- 1. KHỞI TẠO (ENTRY POINT) ---
document.addEventListener("DOMContentLoaded", () => {
    // 1.1. Khởi tạo Editor (EasyMDE)
    editor = new EasyMDE({
        element: document.getElementById("content"),
        spellChecker: false,
        status: ["lines", "words"],
        placeholder: "Nội dung bài viết...",
        autosave: { enabled: true, uniqueId: "MirAi_Draft", delay: 5000 },
    });

    // 1.2. Smart Paste (Tự động format khi Ctrl+V từ Google Docs)
    editor.codemirror.on("paste", (cm, event) => {
        event.preventDefault();
        let text = event.clipboardData.getData("text/plain");
        if (!text) return;
        let processed = text.trim()
            .replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n")
            .replace(/…/g, "...")
            .replace(/^\[(.*?)\]:\s*(.*)$/gm, '**[$1]:** $2')
            .replace(/\((.*?)\)/g, '*($1)*')
            .replace(/^\s*\*\*\*\s*$/gm, '---');
        cm.replaceSelection(processed);
        showToast("⚡ Đã Smart Paste & Format!");
    });

    // 1.3. Gán sự kiện cho Màn hình khóa
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
        lockScreen.addEventListener('click', login);
    }
    
    // Phím tắt F12 để login nhanh
    window.addEventListener('keydown', (e) => { 
        if(e.key === 'F12') login(); 
    });

    // 1.4. Load Cấu hình đã lưu (Token, Theme)
    if(localStorage.getItem('admin_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }

    const savedToken = localStorage.getItem('gh_token');
    if (savedToken && localStorage.getItem('remember_token') === 'true') {
        document.getElementById('token').value = savedToken;
        document.getElementById('rememberToken').checked = true;
    }
    document.getElementById('webhook').value = localStorage.getItem('discord_webhook') || '';
});

// --- 2. HỆ THỐNG ĐĂNG NHẬP (AUTH) ---
function login() {
    let pass = prompt("🔑 Mật mã:");
    if (pass === SECRET_PASS) {
        unlockInterface();
    } else if (pass) {
        alert("SAI MẬT MÃ!");
    }
}

function unlockInterface() {
    document.getElementById('lock-screen').style.display = 'none';
    // Thử load nhạc, nếu lỗi cũng không sao, vẫn vào được admin
    try {
        initAdminMusic();
    } catch (e) {
        console.warn("Không tải được nhạc nền:", e);
    }
}

// --- 3. QUẢN LÝ DATABASE (CHUYỂN ĐỔI TRUYỆN/WIKI) ---
function switchDatabase() {
    currentDB = document.getElementById('dbSelector').value;
    resetEditor();
    
    // Nếu đang ở tab Danh Sách thì tải lại ngay
    if (document.getElementById('view-list').classList.contains('active')) {
        loadChapterList();
    }
    
    // Đổi placeholder cho hợp ngữ cảnh
    const titleInput = document.getElementById('chapTitle');
    if (currentDB === 'main') {
        titleInput.placeholder = "Tiêu đề chương (VD: Chương 1)...";
    } else {
        titleInput.placeholder = "Tên mục (VD: Hồ sơ Minh, Lịch sử AI)...";
    }

    showToast(`📂 Đã chuyển sang: ${currentDB.toUpperCase()}`);
}

function getDbConfig() {
    if (currentDB === 'main') {
        return { json: 'data.json', folder: 'chapters' };
    } else {
        // Ví dụ: data_wiki.json và thư mục wiki/
        return { json: `data_${currentDB}.json`, folder: currentDB };
    }
}

// --- 4. GIAO DIỆN & TIỆN ÍCH (UI UTILS) ---
function switchView(viewId) {
    // Ẩn tất cả các view
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    // Hiện view được chọn
    document.getElementById('view-' + viewId).classList.add('active');
    
    // Highlight sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');

    // Load dữ liệu tương ứng
    if(viewId === 'list') loadChapterList();
    if(viewId === 'music') loadMusicList();
    if(viewId === 'achievements') loadAchievements();
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('admin_theme', isDark ? 'light' : 'dark');
}

function showToast(msg) {
    const t = document.getElementById('toast'); 
    t.innerText = msg; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function saveConfig() {
    const token = document.getElementById('token').value;
    const remember = document.getElementById('rememberToken').checked;
    
    if (remember) { 
        localStorage.setItem('gh_token', token); 
        localStorage.setItem('remember_token', 'true'); 
    } else { 
        localStorage.removeItem('gh_token'); 
        localStorage.setItem('remember_token', 'false'); 
    }
    localStorage.setItem('discord_webhook', document.getElementById('webhook').value);
    showToast("💾 Đã lưu cấu hình");
}

// --- 5. CHỨC NĂNG EDITOR ---
function runAutoFormat() {
    let txt = editor.value();
    editor.value(txt.replace(/^\[(.*?)\]:\s*(.*)$/gm, '**[$1]:** $2').replace(/\((.*?)\)/g, '*($1)*'));
    showToast("✨ Đã Format lại thủ công");
}

function toggleSnippets() { 
    const menu = document.getElementById('snippet-menu');
    menu.classList.toggle('show'); 
}

// Đóng menu khi click ra ngoài
window.addEventListener('click', (e) => { 
    if (!e.target.matches('.btn-outline')) {
        const menu = document.getElementById('snippet-menu');
        if(menu) menu.classList.remove('show');
    } 
});

function insertText(text) { 
    editor.codemirror.replaceSelection(text); 
    editor.codemirror.focus(); 
}

function updateStats() {
    const text = editor.value();
    const wordCount = text.trim().split(/\s+/).length;
    const TARGET = 2000;
    
    let percent = Math.min((wordCount / TARGET) * 100, 100);
    
    document.getElementById('word-count').innerText = `${wordCount} / ${TARGET} từ`;
    document.getElementById('read-time').innerText = `~${Math.ceil(wordCount / 200)}p đọc`;
    
    const bar = document.getElementById('word-progress');
    bar.style.width = `${percent}%`;
    
    if(wordCount >= TARGET) {
        bar.style.background = "#2ecc71";
        bar.style.boxShadow = "0 0 10px #2ecc71";
    } else {
        bar.style.background = "linear-gradient(90deg, #ff6b81, #ff9f43)";
        bar.style.boxShadow = "0 0 8px rgba(255, 107, 129, 0.6)";
    }
}

// --- 6. GITHUB API HELPER ---
async function githubRequest(path, body, method='PUT') {
    const token = document.getElementById('token').value;
    if(!token) throw new Error("Vui lòng nhập GitHub Token!");
    
    return fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${path}`, {
        method: method, 
        headers: {Authorization: `token ${token}`}, 
        body: JSON.stringify(body)
    });
}

async function handleImgUpload() {
    const f = document.getElementById('imgInput').files[0]; 
    if(!f) return;
    
    showToast("⏳ Đang nén & Up ảnh...");
    
    new Compressor(f, { 
        quality: 0.6, 
        maxWidth: 1200, 
        success(result) {
            const r = new FileReader(); 
            r.readAsDataURL(result);
            r.onload = async function() {
                try {
                    const b64 = r.result.split(',')[1];
                    const path = `images/${Date.now()}_img.jpg`;
                    await githubRequest(path, {message: "up img", content: b64});
                    
                    const url = `https://${CONFIG.adminUser}.github.io/${CONFIG.repoName}/${path}`;
                    editor.codemirror.replaceSelection(`\n![Ảnh](${url})\n`);
                    showToast("🖼️ Ảnh đã lên!");
                } catch(e) { alert("Lỗi Up ảnh: " + e); }
            };
        }
    });
}

// --- 7. QUẢN LÝ CHƯƠNG & BÀI VIẾT ---
async function loadChapterList() {
    const c = document.getElementById('list-container');
    const t = document.getElementById('token').value;
    if(!t) { c.innerHTML = "Vui lòng nhập Token!"; return; }
    
    const { json } = getDbConfig();
    c.innerHTML = `⏳ Đang tải dữ liệu [${currentDB.toUpperCase()}]...`;
    
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${json}?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        
        if(!res.ok) {
            window.chaptersCache = [];
            window.jsonSha = null;
            c.innerHTML = `Chưa có dữ liệu cho <b>${currentDB}</b>. Hãy tạo bài đầu tiên!`;
            return;
        }
        
        const data = await res.json();
        window.chaptersCache = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        window.jsonSha = data.sha;

        c.innerHTML = "";
        window.chaptersCache.forEach((item, i) => {
            let status = (item.timestamp && item.timestamp > Date.now()) ? '<span style="color:#f39c12">⏳ Hẹn giờ</span>' : '<span style="color:#2ecc71">✅ Đã đăng</span>';
            c.innerHTML += `
                <div class="list-item">
                    <div><b>#${i+1}: ${item.title}</b> <br> <small>${status}</small></div>
                    <div>
                        <button class="btn btn-outline" onclick="editChapter(${i})"><i class="fas fa-pen"></i></button>
                        <button class="btn btn-outline" style="color:#e74c3c; border-color:#e74c3c" onclick="deleteChapter(${i})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        });
    } catch(e) { c.innerHTML = "Lỗi tải danh sách: " + e.message; }
}

async function publishChapter() {
    const title = document.getElementById('chapTitle').value;
    const content = editor.value();
    const token = document.getElementById('token').value;
    
    if(!title || !content || !token) return alert("Thiếu thông tin!");
    document.getElementById('publishBtn').innerText = "⏳ Đang xử lý...";
    
    const { json, folder } = getDbConfig();

    try {
        // Lấy danh sách hiện tại để có SHA mới nhất
        let chapters = [];
        let listSha = null;
        try {
            const listRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${json}?t=${Date.now()}`, {headers:{Authorization:`token ${token}`}});
            if(listRes.ok) {
                const listData = await listRes.json();
                chapters = JSON.parse(decodeURIComponent(escape(atob(listData.content))));
                listSha = listData.sha;
            }
        } catch(e) {}

        const idx = document.getElementById('edit-index').value;
        const ts = document.getElementById('scheduleTime').value ? new Date(document.getElementById('scheduleTime').value).getTime() : Date.now();
        
        let path, sha = null;
        
        if(idx !== "") {
            // Sửa bài cũ
            path = chapters[idx].file;
            try {
                const fInfo = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${path}`, {headers:{Authorization:`token ${token}`}});
                if(fInfo.ok) sha = (await fInfo.json()).sha;
            } catch(e) {}
            chapters[idx].title = title; 
            chapters[idx].timestamp = ts;
        } else {
            // Tạo bài mới (Lưu vào đúng thư mục: wiki/, tech/...)
            path = `${folder}/${Date.now()}.md`;
            chapters.push({id: `${folder}_${Date.now()}`, title: title, file: path, timestamp: ts});
        }

        // Upload File MD
        await githubRequest(path, {
            message: `Upd ${title} in ${currentDB}`, 
            content: btoa(unescape(encodeURIComponent(content))), 
            sha: sha
        });
        
        // Upload JSON List
        await githubRequest(json, {
            message: `Upd List ${currentDB}`, 
            content: btoa(unescape(encodeURIComponent(JSON.stringify(chapters, null, 2)))), 
            sha: listSha
        });
        
        // Thông báo Discord (Chỉ khi là truyện chính)
        const wh = document.getElementById('webhook').value;
        if(wh && !idx && currentDB === 'main') {
            fetch(wh, {
                method:"POST", 
                headers:{"Content-Type":"application/json"}, 
                body:JSON.stringify({content: `🎉 **CHƯƠNG MỚI:** ${title}\n👉 Link: https://${CONFIG.adminUser}.github.io/${CONFIG.repoName}`})
            });
        }
        
        showToast("🚀 THÀNH CÔNG!");
        resetEditor();
    } catch(e) { alert("Lỗi: " + e); }
    document.getElementById('publishBtn').innerText = "🚀 ĐĂNG BÀI";
}

async function editChapter(i) {
    const item = window.chaptersCache[i]; 
    switchView('editor'); 
    showToast("Đang tải nội dung...");
    const t = document.getElementById('token').value;
    
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${item.file}?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        const d = await res.json();
        
        document.getElementById('chapTitle').value = item.title;
        editor.value(decodeURIComponent(escape(atob(d.content))));
        document.getElementById('edit-index').value = i;
        document.getElementById('publishBtn').innerText = "💾 CẬP NHẬT";
    } catch(e) { alert("Lỗi tải bài: " + e); }
}

async function deleteChapter(i) {
    if(!confirm("Xóa vĩnh viễn bài này?")) return;
    
    const item = window.chaptersCache[i];
    const t = document.getElementById('token').value;
    const { json } = getDbConfig();

    try {
        // 1. Xóa file MD
        const fRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${item.file}`, {headers:{Authorization:`token ${t}`}});
        if(fRes.ok) {
            const fData = await fRes.json();
            await githubRequest(item.file, {message:`Del ${item.title}`, sha: fData.sha}, 'DELETE');
        }
        
        // 2. Cập nhật list
        const lRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${json}?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        const lData = await lRes.json();
        
        let list = JSON.parse(decodeURIComponent(escape(atob(lData.content)))).filter(c => c.id !== item.id);
        
        await githubRequest(json, {
            message:`Rm ${item.title}`, 
            content: btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2)))), 
            sha: lData.sha
        });
        
        showToast("🗑️ Đã xóa!"); 
        loadChapterList();
    } catch(e) { alert("Lỗi xóa: " + e); }
}

function resetEditor() {
    document.getElementById('chapTitle').value = "";
    editor.value("");
    document.getElementById('edit-index').value = "";
    document.getElementById('publishBtn').innerText = "🚀 ĐĂNG BÀI";
}

// --- 8. MUSIC & UTILS ---
function translateLogic() {
    let t = document.getElementById('humanLogic').value.toLowerCase();
    const map = {'giờ':'env.hour','đọc':'env.readCount','lớn hơn':'>','nhỏ hơn':'<','bằng':'==','và':'&&'};
    for(let k in map) t = t.replace(new RegExp(k,'g'), map[k]);
    document.getElementById('logicResult').value = t;
}

const bgm = new Audio(); let pl = [], idx = 0;
async function initAdminMusic() {
    try { 
        const res = await fetch(`music.json?t=${Date.now()}`);
        if(res.ok) {
            pl = await res.json();
            if(pl.length > 0) { 
                document.getElementById('mini-player').style.display='block'; 
                bgm.src=pl[0].url; 
                document.getElementById('mp-title').innerText=pl[0].title; 
            }
        }
    } catch(e){}
}
function toggleAdminMusic() { bgm.paused ? bgm.play() : bgm.pause(); }
function nextAdminMusic() { 
    idx = (idx+1) % pl.length; 
    bgm.src = pl[idx].url; 
    document.getElementById('mp-title').innerText = pl[idx].title; 
    bgm.play(); 
}

// --- 9. ACHIEVEMENTS ---
async function loadAchievements() { 
    const c=document.getElementById('ach-list-container'); c.innerHTML="Loading..."; 
    const t=document.getElementById('token').value; 
    if(!t) { c.innerHTML = "Nhập Token!"; return; }
    try { 
        const res=await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/achievements.json?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}}); 
        if (!res.ok) { window.achData=[]; c.innerHTML="Trống"; return; } 
        const d=await res.json(); 
        window.achData=JSON.parse(decodeURIComponent(escape(atob(d.content)))); 
        window.achSha=d.sha; 
        c.innerHTML=''; 
        window.achData.forEach((a,i)=>{ c.innerHTML+=`<div class="list-item"><div>${a.icon} <b>${a.title}</b><br><small>${a.condition}</small></div><button class="btn btn-outline" style="color:#e74c3c; border-color:#e74c3c" onclick="delAchievement(${i})"><i class="fas fa-trash"></i></button></div>`; }); 
    } catch(e) { c.innerHTML="Lỗi: "+e.message; } 
}

async function addAchievement() { 
    const id=document.getElementById('achId').value, title=document.getElementById('achTitle').value, t=document.getElementById('token').value; 
    if (!id||!title||!t) return alert("Thiếu thông tin!"); 
    if (!window.achData) window.achData=[]; 
    window.achData.push({
        id: id, icon: document.getElementById('achIcon').value, 
        title: title, desc: document.getElementById('achDesc').value, 
        condition: document.getElementById('achCondition').value
    }); 
    const jB={message:"Upd Ach", content:btoa(unescape(encodeURIComponent(JSON.stringify(window.achData,null,2))))}; 
    if (window.achSha) jB.sha=window.achSha; 
    await githubRequest('achievements.json', jB); 
    showToast("Added!"); loadAchievements(); 
}

async function delAchievement(i) { 
    if (!confirm("Xóa?")) return; 
    window.achData.splice(i, 1); 
    const jB={message:"Del Ach", content:btoa(unescape(encodeURIComponent(JSON.stringify(window.achData,null,2)))), sha:window.achSha}; 
    await githubRequest('achievements.json', jB); 
    showToast("Deleted!"); loadAchievements(); 
}
