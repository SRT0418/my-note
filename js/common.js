window.addEventListener("load", () => {
    renderToday();
});



function renderToday() {
    const el = document.getElementById("today-date");
    if (!el) return;

    const today = new Date();
    el.textContent = today.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// ハンバーガーメニューの開閉を制御する（全ページ共通）
document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("hamburger-btn");
    const menu = document.getElementById("nav-menu");

    if (!btn || !menu) return;

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("open");
    });

    // メニュー外をクリックしたら閉じる
    document.addEventListener("click", (e) => {
        if (!menu.contains(e.target) && e.target !== btn) {
            menu.classList.remove("open");
        }
    });
});