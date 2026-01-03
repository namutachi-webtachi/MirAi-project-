const SECRET_PASS = "2006";
let editor;

// --- 1. CORE & UI ---
document.addEventListener("DOMContentLoaded", () => {
    // Theme Init
    if(localStorage.getItem('admin_theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
    
    // Editor Init
    editor = new EasyMDE({
        element: document.getElementById("content"),
        spellChecker: false,
        status: ["lines", "words"],
        placeholder: "Paste nội dung từ Google Docs vào đây (Ctrl+V)...",
        autosave: { enabled: true, uniqueId: "MirAi_Draft", delay: 5000 },
    });

    // Smart Paste
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

    // Stats Hook
    setTimeout(() => { if(editor) { editor.codemirror.on("change", updateStats); updateStats(); } }, 1000);

    // Load Config
    const savedToken = localStorage.getItem('gh_token');
    if (savedToken && localStorage.getItem('remember_token') === 'true') {
        document.getElementById('token').value = savedToken;
        document.getElementById('rememberToken').checked = true;
    }
    document.getElementById('webhook').value = localStorage.getItem('discord_webhook') || '';
});

// --- AUTH ---
document.getElementById('lock-screen').addEventListener('click', login);
window.addEventListener('keydown', (e) => { if(e.key === 'F12') login(); });

function login() {
    let pass = prompt("🔑 Mật mã:");
    if (pass === SECRET_PASS) {
        document.getElementById('lock-screen').style.display = 'none';
        initAdminMusic();
    } else if (pass) alert("SAI MẬT MÃ!");
}

// --- UI UTILS ---
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');

    // Gọi các hàm load dữ liệu tương ứng
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

// --- EDITOR FEATURES ---
function runAutoFormat() {
    let txt = editor.value();
    editor.value(txt.replace(/^\[(.*?)\]:\s*(.*)$/gm, '**[$1]:** $2').replace(/\((.*?)\)/g, '*($1)*'));
    showToast("✨ Đã Format lại thủ công");
}

function toggleSnippets() { document.getElementById('snippet-menu').classList.toggle('show'); }
window.addEventListener('click', (e) => { 
    if (!e.target.matches('.btn-outline')) {
        const menu = document.getElementById('snippet-menu');
        if(menu) menu.classList.remove('show');
    } 
});

function insertText(text) { editor.codemirror.replaceSelection(text); editor.codemirror.focus(); }

function updateStats() {
    const wordCount = editor.value().trim().split(/\s+/).length;
    const TARGET = 2000;
    let percent = Math.min((wordCount / TARGET) * 100, 100);
    document.getElementById('word-count').innerText = `${wordCount} / ${TARGET} từ`;
    document.getElementById('read-time').innerText = `~${Math.ceil(wordCount / 200)}p đọc`;
    const bar = document.getElementById('word-progress');
    bar.style.width = `${percent}%`;
    bar.style.background = (wordCount >= TARGET) ? "#2ecc71" : "linear-gradient(90deg, #ff6b81, #ff9f43)";
    if(wordCount >= TARGET) bar.style.boxShadow = "0 0 10px #2ecc71";
}

// --- API HELPER ---
async function githubRequest(path, body, method='PUT') {
    const token = document.getElementById('token').value;
    if(!token) throw new Error("Nhập GitHub Token!");
    return fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${path}`, {
        method: method, headers: {Authorization: `token ${token}`}, body: JSON.stringify(body)
    });
}

async function handleImgUpload() {
    const f = document.getElementById('imgInput').files[0]; if(!f) return;
    showToast("⏳ Đang nén & Up ảnh...");
    new Compressor(f, { quality: 0.6, maxWidth: 1200, success(result) {
        const r = new FileReader(); r.readAsDataURL(result);
        r.onload = async function() {
            try {
                const b64 = r.result.split(',')[1];
                const path = `images/${Date.now()}_img.jpg`;
                await githubRequest(path, {message: "up img", content: b64});
                editor.codemirror.replaceSelection(`\n![Ảnh](https://${CONFIG.adminUser}.github.io/${CONFIG.repoName}/${path})\n`);
                showToast("🖼️ Ảnh đã lên!");
            } catch(e) { alert(e); }
        };
    }});
}

// --- CHAPTER LOGIC ---
async function loadChapterList() {
    const c = document.getElementById('list-container'), t = document.getElementById('token').value;
    if(!t) { c.innerHTML = "Nhập Token!"; return; }
    c.innerHTML = "⏳ Đang tải...";
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/data.json?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        const data = await res.json();
        window.chaptersCache = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        c.innerHTML = "";
        window.chaptersCache.forEach((item, i) => {
            let st = (item.timestamp > Date.now()) ? '<span style="color:#f39c12">⏳</span>' : '<span style="color:#2ecc71">✅</span>';
            c.innerHTML += `<div class="list-item"><div><b>#${i+1}: ${item.title}</b> ${st}</div><div><button class="btn btn-outline" onclick="editChapter(${i})"><i class="fas fa-pen"></i></button><button class="btn btn-outline" style="color:#e74c3c" onclick="deleteChapter(${i})"><i class="fas fa-trash"></i></button></div></div>`;
        });
    } catch(e) { c.innerHTML = "Lỗi tải list: " + e.message; }
}

async function publishChapter() {
    const title = document.getElementById('chapTitle').value, content = editor.value(), token = document.getElementById('token').value;
    if(!title || !content || !token) return alert("Thiếu thông tin!");
    document.getElementById('publishBtn').innerText = "⏳ Đang xử lý...";
    try {
        const listRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/data.json?t=${Date.now()}`, {headers:{Authorization:`token ${token}`}});
        const listData = await listRes.json();
        let chapters = JSON.parse(decodeURIComponent(escape(atob(listData.content))));
        const idx = document.getElementById('edit-index').value, ts = document.getElementById('scheduleTime').value ? new Date(document.getElementById('scheduleTime').value).getTime() : Date.now();
        
        let path, sha = null;
        if(idx !== "") {
            path = chapters[idx].file;
            // Lấy SHA mới nhất của file MD
            const fInfo = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${path}`, {headers:{Authorization:`token ${token}`}});
            sha = (await fInfo.json()).sha;
            chapters[idx].title = title; chapters[idx].timestamp = ts;
        } else {
            path = `chapters/chap_${Date.now()}.md`;
            chapters.push({id: `chap_${Date.now()}`, title: title, file: path, timestamp: ts});
        }

        await githubRequest(path, {message: `Upd ${title}`, content: btoa(unescape(encodeURIComponent(content))), sha: sha});
        await githubRequest('data.json', {message: "Upd List", content: btoa(unescape(encodeURIComponent(JSON.stringify(chapters, null, 2)))), sha: listData.sha});
        
        const wh = document.getElementById('webhook').value;
        if(wh && !idx) fetch(wh, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({content: `🎉 **CHƯƠNG MỚI:** ${title}\n👉 Link: https://${CONFIG.adminUser}.github.io/${CONFIG.repoName}`})});
        
        showToast("🚀 THÀNH CÔNG!");
        document.getElementById('chapTitle').value = ""; editor.value(""); document.getElementById('edit-index').value = "";
    } catch(e) { alert("Lỗi: " + e); }
    document.getElementById('publishBtn').innerText = "🚀 ĐĂNG BÀI";
}

async function editChapter(i) {
    const item = window.chaptersCache[i]; switchView('editor'); showToast("Loading...");
    const t = document.getElementById('token').value;
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${item.file}?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        const d = await res.json();
        document.getElementById('chapTitle').value = item.title;
        editor.value(decodeURIComponent(escape(atob(d.content))));
        document.getElementById('edit-index').value = i;
        document.getElementById('publishBtn').innerText = "💾 CẬP NHẬT";
    } catch(e) { alert("Lỗi tải chương: " + e); }
}

// --- FIX LỖI DOUBLE READ STREAM Ở ĐÂY ---
async function deleteChapter(i) {
    if(!confirm("Xóa vĩnh viễn?")) return;
    const item = window.chaptersCache[i], t = document.getElementById('token').value;
    try {
        // 1. Xóa file MD
        const fRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${item.file}`, {headers:{Authorization:`token ${t}`}});
        if(fRes.ok) {
            const fData = await fRes.json();
            await githubRequest(item.file, {message:`Del ${item.title}`, sha: fData.sha}, 'DELETE');
        }
        
        // 2. Cập nhật list
        const lRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/data.json?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        const lData = await lRes.json(); // Đọc 1 lần duy nhất
        
        let list = JSON.parse(decodeURIComponent(escape(atob(lData.content)))).filter(c => c.id !== item.id);
        
        await githubRequest('data.json', {
            message:`Rm ${item.title}`, 
            content: btoa(unescape(encodeURIComponent(JSON.stringify(list, null, 2)))), 
            sha: lData.sha // Dùng lại biến đã đọc
        });
        
        showToast("🗑️ Đã xóa!"); loadChapterList();
    } catch(e) { alert("Lỗi xóa: " + e); }
}

// --- MUSIC LOGIC (ĐÃ THÊM VÀO) ---
async function loadMusicList() {
    const c = document.getElementById('music-list-container'), t = document.getElementById('token').value;
    if(!t) { c.innerHTML = "Nhập Token!"; return; }
    c.innerHTML = "Loading...";
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/music.json?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        if(!res.ok) throw new Error("Chưa có nhạc");
        const d = await res.json();
        window.musicData = JSON.parse(decodeURIComponent(escape(atob(d.content))));
        window.musicSha = d.sha;
        c.innerHTML = "";
        window.musicData.forEach((s, i) => {
            c.innerHTML += `<div class="list-item"><div>🎵 ${s.title}</div><button class="btn btn-outline" style="color:#e74c3c; border-color:#e74c3c" onclick="delSong(${i})"><i class="fas fa-trash"></i></button></div>`;
        });
    } catch(e) { c.innerHTML = "Trống hoặc Lỗi: " + e.message; window.musicData = []; }
}

async function uploadMusic() {
    const t = document.getElementById('token').value, ti = document.getElementById('songTitle').value, f = document.getElementById('mp3Input').files[0];
    if(!t || !ti || !f) return alert("Thiếu thông tin!");
    showToast("⏳ Uploading...");
    const r = new FileReader(); r.readAsDataURL(f);
    r.onload = async function() {
        try {
            const b64 = r.result.split(',')[1];
            const path = `images/music/${Date.now()}_${f.name}`;
            await githubRequest(path, {message: "Up Song", content: b64});
            if(!window.musicData) await loadMusicList();
            window.musicData.push({title: ti, url: path});
            const jB = {message: "Up List", content: btoa(unescape(encodeURIComponent(JSON.stringify(window.musicData, null, 2))))};
            if(window.musicSha) jB.sha = window.musicSha;
            await githubRequest('music.json', jB);
            showToast("🎵 Uploaded!"); loadMusicList();
        } catch(e) { alert(e); }
    }
}

async function delSong(i) {
    if(!confirm("Xóa nhạc?")) return;
    const t = document.getElementById('token').value;
    try {
        const song = window.musicData[i];
        const fRes = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/${song.url}`, {headers:{Authorization:`token ${t}`}});
        if(fRes.ok) {
            const fData = await fRes.json();
            await githubRequest(song.url, {message:"Del File", sha: fData.sha}, 'DELETE');
        }
        window.musicData.splice(i, 1);
        const jB = {message: "Del List", content: btoa(unescape(encodeURIComponent(JSON.stringify(window.musicData, null, 2)))), sha: window.musicSha};
        await githubRequest('music.json', jB);
        showToast("Deleted!"); loadMusicList();
    } catch(e) { alert(e); }
}

// --- ACHIEVEMENTS LOGIC (ĐÃ THÊM VÀO) ---
async function loadAchievements() {
    const c = document.getElementById('ach-list-container'), t = document.getElementById('token').value;
    if(!t) { c.innerHTML = "Nhập Token!"; return; }
    c.innerHTML = "Loading...";
    try {
        const res = await fetch(`https://api.github.com/repos/${CONFIG.adminUser}/${CONFIG.repoName}/contents/achievements.json?t=${Date.now()}`, {headers:{Authorization:`token ${t}`}});
        if(!res.ok) throw new Error("Chưa có thành tựu");
        const d = await res.json();
        window.achData = JSON.parse(decodeURIComponent(escape(atob(d.content))));
        window.achSha = d.sha;
        c.innerHTML = "";
        window.achData.forEach((a, i) => {
            c.innerHTML += `<div class="list-item"><div>${a.icon} <b>${a.title}</b><br><small>${a.condition}</small></div><button class="btn btn-outline" style="color:#e74c3c; border-color:#e74c3c" onclick="delAchievement(${i})"><i class="fas fa-trash"></i></button></div>`;
        });
    } catch(e) { c.innerHTML = "Trống hoặc Lỗi: " + e.message; window.achData = []; }
}

async function addAchievement() {
    const id = document.getElementById('achId').value, title = document.getElementById('achTitle').value, t = document.getElementById('token').value;
    if(!id || !title || !t) return alert("Thiếu thông tin!");
    if(!window.achData) window.achData = [];
    window.achData.push({
        id: id, icon: document.getElementById('achIcon').value, 
        title: title, desc: document.getElementById('achDesc').value, 
        condition: document.getElementById('achCondition').value
    });
    const jB = {message: "Upd Ach", content: btoa(unescape(encodeURIComponent(JSON.stringify(window.achData, null, 2))))};
    if(window.achSha) jB.sha = window.achSha;
    await githubRequest('achievements.json', jB);
    showToast("Added!"); loadAchievements();
}

async function delAchievement(i) {
    if(!confirm("Xóa?")) return;
    window.achData.splice(i, 1);
    const jB = {message: "Del Ach", content: btoa(unescape(encodeURIComponent(JSON.stringify(window.achData, null, 2)))), sha: window.achSha};
    await githubRequest('achievements.json', jB);
    showToast("Deleted!"); loadAchievements();
}

// --- UTILS ---
function translateLogic() {
    let t = document.getElementById('humanLogic').value.toLowerCase();
    const map = {'giờ':'env.hour','đọc':'env.readCount','lớn hơn':'>','nhỏ hơn':'<','bằng':'==','và':'&&'};
    for(let k in map) t = t.replace(new RegExp(k,'g'), map[k]);
    document.getElementById('logicResult').value = t;
}

const bgm = new Audio(); let pl = [], idx = 0;
async function initAdminMusic() {
    try { pl = await (await fetch(`music.json?t=${Date.now()}`)).json(); if(pl.length){ document.getElementById('mini-player').style.display='block'; bgm.src=pl[0].url; document.getElementById('mp-title').innerText=pl[0].title; } } catch{}
}
function toggleAdminMusic() { bgm.paused ? bgm.play() : bgm.pause(); }
function nextAdminMusic() { idx=(idx+1)%pl.length; bgm.src=pl[idx].url; document.getElementById('mp-title').innerText=pl[idx].title; bgm.play(); }
