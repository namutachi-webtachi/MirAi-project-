// config.js - Chỉnh sửa thông tin của cậu tại đây
const CONFIG = {
    // 1. Thông tin Web
    webName: "MirAi Project",
    subTitle: "Namutachi",
    adminUser: "namutachi-webtachi", // Tên GitHub của cậu
    repoName: "MirAi-project-",      // Tên Repo

    // 2. Social Media (Thêm link của bro vào đây)
    social: {
        facebook: "https://www.facebook.com/profile.php?id=61584772166691", 
        discord: "https://discord.gg/r4Y9gUNQ"
    },

    // 3. Cấu hình Bình luận (Giscus)
    giscus: {
        repo: "namutachi-webtachi/MirAi-comments",
        repoId: "R_kgDOQiwFrA",
        category: "Announcements",
        categoryId: "DIC_kwDOQiwFrM4CzaA2"
    },

    // 4. Ảnh nền
    bgImage: "https://i.pinimg.com/1200x/b0/8f/59/b08f5925aeb1141b7cf18ea63f3185ae.jpg", // <--- NHỚ DẤU PHẨY NÀY

    // 5. Nhạc mặc định
    defaultMusic: "images/music.mp3" 
};
// === CHỐNG COPY WEB (ANTI-FORK PROTECTION) ===
(function() {
    const myDomain = "namutachi-webtachi.github.io"; // <--- Tên miền chính chủ của bro
    const currentDomain = window.location.hostname;

    // Cho phép chạy trên localhost để bro test, còn lại phải đúng domain chính
    if (currentDomain !== myDomain && currentDomain !== "127.0.0.1" && currentDomain !== "localhost") {
        
        // Cách 1: Hiện cảnh báo "Ăn cắp"
        alert("⚠️ CẢNH BÁO: Đây là trang web mạo danh!");
        alert("Bạn đang truy cập vào bản sao chép trái phép. Hệ thống sẽ đưa bạn về trang chính chủ của NamuTachi.");
        
        // Cách 2: Chuyển hướng ngay lập tức về nhà
        window.location.href = `https://${myDomain}/MirAi-project-/`; 
    }
})();
