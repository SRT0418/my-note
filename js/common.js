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

// ===== テレビミラーリング機能（全ページ共通） =====
// nav-menu が存在するページに「📺 テレビに映す」ボタンとモーダルを動的に挿入する
document.addEventListener("DOMContentLoaded", () => {

    // nav-menu が無いページ（login, auth-callback 等）では何もしない
    if (!document.getElementById("nav-menu")) return;

    // ── ① ボタンを動的に挿入 ──────────────────────────────
    // 既に手動で埋め込まれているページではスキップする
    if (!document.getElementById("screen-share-btn")) {
        const btn = document.createElement("button");
        btn.id = "screen-share-btn";
        btn.textContent = "📺 テレビに映す";
        // header の直後に挿入（header がなければ body の先頭）
        const header = document.querySelector("header");
        if (header && header.nextSibling) {
            header.parentNode.insertBefore(btn, header.nextSibling);
        } else {
            document.body.appendChild(btn);
        }
    }

    // ── ② モーダルを動的に挿入 ──────────────────────────────
    if (!document.getElementById("mirror-modal-overlay")) {
        const modalHTML = `
<div id="mirror-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="mirror-modal-title">
    <div id="mirror-modal">
        <div class="mirror-modal-header">
            <h2 id="mirror-modal-title">📺 テレビに映す方法</h2>
            <button id="mirror-modal-close" aria-label="閉じる">&times;</button>
        </div>
        <p class="mirror-modal-desc">
            お使いのスマートフォンのOSに合わせた手順でミラーリングしてください。<br>
            テレビ側が同じWi-Fiに接続されている必要があります。
        </p>
        <div class="mirror-platform-list">

            <div class="mirror-platform-card">
                <div class="mirror-platform-title">
                    <span class="mirror-platform-icon">🍎</span>
                    AirPlay
                    <span class="mirror-badge ios">iPhone / iPad</span>
                </div>
                <ol class="mirror-steps">
                    <li>iPhone/iPad とテレビ（Apple TV または AirPlay対応テレビ）を<strong>同じWi-Fi</strong>に接続する</li>
                    <li>画面下端（または右上隅）から上にスワイプして<strong>コントロールセンター</strong>を開く</li>
                    <li><strong>「画面ミラーリング」</strong>（四角が重なったアイコン）をタップ</li>
                    <li>表示されたリストからテレビ（Apple TV）を選択する</li>
                    <li>テレビにパスコードが表示された場合は入力する</li>
                </ol>
            </div>

            <div class="mirror-platform-card">
                <div class="mirror-platform-title">
                    <span class="mirror-platform-icon">📡</span>
                    Chromecast（Cast）
                    <span class="mirror-badge android">Android</span>
                </div>
                <ol class="mirror-steps">
                    <li>Android と Chromecast（またはChromecast内蔵テレビ）を<strong>同じWi-Fi</strong>に接続する</li>
                    <li>画面上端から下にスワイプして<strong>クイック設定</strong>を開く</li>
                    <li><strong>「画面のキャスト」</strong>または<strong>「スマートビュー」</strong>をタップ</li>
                    <li>表示されたデバイス一覧からテレビを選択する</li>
                    <li>※ Google Homeアプリ → デバイス選択 →「画面をキャスト」でも可</li>
                </ol>
            </div>

            <div class="mirror-platform-card">
                <div class="mirror-platform-title">
                    <span class="mirror-platform-icon">🖥️</span>
                    Miracast（ワイヤレスディスプレイ）
                    <span class="mirror-badge android">Android / Windows</span>
                </div>
                <ol class="mirror-steps">
                    <li>テレビ側でMiracast（ワイヤレスディスプレイ）受信モードを有効にする</li>
                    <li>Android の設定 → <strong>「接続」→「ワイヤレスディスプレイ」</strong>をオンにする</li>
                    <li>テレビ名が表示されたらタップして接続する</li>
                    <li>※ 機種によってメニュー名が異なる場合があります</li>
                </ol>
            </div>

        </div>
    </div>
</div>`;
        document.body.insertAdjacentHTML("beforeend", modalHTML);
    }

    // ── ③ イベント登録 ──────────────────────────────
    const mirrorOverlay = document.getElementById("mirror-modal-overlay");
    const screenShareBtn = document.getElementById("screen-share-btn");
    const mirrorCloseBtn = document.getElementById("mirror-modal-close");

    function openMirrorModal() {
        mirrorOverlay.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeMirrorModal() {
        mirrorOverlay.classList.remove("open");
        document.body.style.overflow = "";
    }

    if (screenShareBtn) screenShareBtn.addEventListener("click", openMirrorModal);
    if (mirrorCloseBtn) mirrorCloseBtn.addEventListener("click", closeMirrorModal);

    // モーダル外クリックで閉じる
    if (mirrorOverlay) {
        mirrorOverlay.addEventListener("click", (e) => {
            if (e.target === mirrorOverlay) closeMirrorModal();
        });
    }

    // Escキーで閉じる（ドロワーの Esc と共存するため capture は使わない）
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && mirrorOverlay && mirrorOverlay.classList.contains("open")) {
            closeMirrorModal();
        }
    });
});