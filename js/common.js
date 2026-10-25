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

// ドロワーメニューの開閉を制御する（全ページ共通）
document.addEventListener("DOMContentLoaded", () => {

    const openBtn    = document.getElementById("drawer-btn");
    const closeBtn   = document.getElementById("drawer-close-btn");
    const menu       = document.getElementById("nav-menu");
    const overlay    = document.getElementById("drawer-overlay");
    const sideTrigger = document.querySelector(".side-trigger");

    if (!menu) return;

    let closeTimer = null;

    // ── 開く ──────────────────────────────
    // withOverlay=true のとき背景暗幕・スクロールロックあり（クリック用）
    function openDrawer(withOverlay = false) {
        cancelClose();
        menu.classList.add("open");
        if (withOverlay && overlay) {
            overlay.classList.add("open");
            document.body.style.overflow = "hidden";
        }
    }

    // ── 閉じる ────────────────────────────
    function closeDrawer() {
        menu.classList.remove("open");
        if (overlay) overlay.classList.remove("open");
        document.body.style.overflow = "";
    }

    // ── タイマー制御（ホバー離脱後の遅延閉じ） ─────────
    function scheduleClose() {
        closeTimer = setTimeout(closeDrawer, 250);
    }

    function cancelClose() {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }
    }

    // ── クリックで開閉（オーバーレイあり） ────────────
    if (openBtn) {
        openBtn.addEventListener("click", () => {
            if (menu.classList.contains("open")) {
                closeDrawer();
            } else {
                openDrawer(true);
            }
        });
    }

    // ── ホバーで自動開閉（マウス操作のときだけ） ──────────────────
    // タッチ端末ではタップ時に mouseenter が合成発火し、
    // 「開く（hover）→ すぐ閉じる（click のトグル）」となってメニューが開かないため、
    // pointerType が "mouse" のときに限定する。タッチは click（オーバーレイ付き）のみで開閉する。
    const isMouse = (e) => e.pointerType === "mouse";

    if (sideTrigger) {
        sideTrigger.addEventListener("pointerenter", (e) => { if (isMouse(e)) openDrawer(false); });
        sideTrigger.addEventListener("pointerleave", (e) => { if (isMouse(e)) scheduleClose(); });
    }

    // ドロワー上にいる間は閉じない
    menu.addEventListener("pointerenter", (e) => { if (isMouse(e)) cancelClose(); });
    menu.addEventListener("pointerleave", (e) => { if (isMouse(e)) scheduleClose(); });

    // ── 閉じるボタン ─────────────────────────────
    if (closeBtn) {
        closeBtn.addEventListener("click", closeDrawer);
    }

    // ── オーバーレイをクリックしたら閉じる ───────────
    if (overlay) {
        overlay.addEventListener("click", closeDrawer);
    }

    // ── ESCキーでも閉じる ─────────────────────────
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
    });
});
