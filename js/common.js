window.addEventListener("load", () => {
    renderToday();
    if (typeof window.checkHabitDailyReset === "function") {
        window.checkHabitDailyReset();
    }
    scheduleMidnightHabitReset();
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

    // ── 習慣タスク日次リセット判定（全ページ共通） ────
    if (typeof window.checkHabitDailyReset === "function") {
        window.checkHabitDailyReset();
    }
});

// ===================================================
// 毎日習慣タスクの日次自動リセットシステム（アプリ全域共有）
// ===================================================

function getHabitTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getHabitDateKey(dateInput) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getHabitDaysDiff(dateKey1, dateKey2) {
    if (!dateKey1 || !dateKey2) return 0;
    const k1 = String(dateKey1).replace(/^"|"$/g, "").trim();
    const k2 = String(dateKey2).replace(/^"|"$/g, "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k1) || !/^\d{4}-\d{2}-\d{2}$/.test(k2)) return 0;
    const d1 = new Date(k1 + "T00:00:00");
    const d2 = new Date(k2 + "T00:00:00");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function formatHabitDateLabel(dateKey) {
    const k = String(dateKey).replace(/^"|"$/g, "").trim();
    const d = new Date(k + "T00:00:00");
    if (isNaN(d.getTime())) return k;
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

let isResettingHabits = false;
function checkHabitDailyReset() {
    if (isResettingHabits) return false;
    isResettingHabits = true;
    try {
        const today = getHabitTodayKey();
        let lastDateRaw = localStorage.getItem("habitLastDate");
        let lastDate = lastDateRaw ? String(lastDateRaw).replace(/^"|"$/g, "").trim() : "";

        let tasks = [];
        let completed = [];
        let history = [];
        try { tasks = JSON.parse(localStorage.getItem("habitTasks")) || []; } catch (e) { tasks = []; }
        try { completed = JSON.parse(localStorage.getItem("habitCompleted")) || []; } catch (e) { completed = []; }
        try { history = JSON.parse(localStorage.getItem("habitDailyHistory")) || []; } catch (e) { history = []; }

        // 過去日付に達成されたタスクが混入しているか判定
        const hasStaleCompleted = completed.some(t => !t || getHabitDateKey(t.completedAt) !== today);
        const isNewDay = lastDate && lastDate !== today;

        // 初回アクセス（lastDateなし）かつ過去達成タスクもない場合
        if (!lastDate && !hasStaleCompleted) {
            localStorage.setItem("habitLastDate", today);
            return false;
        }

        // すでに今日リセット済みで過去タスクの混入もない場合
        if (lastDate === today && !hasStaleCompleted) {
            return false;
        }

        let diffDays = 1;
        if (lastDate) {
            diffDays = getHabitDaysDiff(lastDate, today);
        }

        // 1. 最後に利用した日の実績を履歴に保存 (未保存の場合のみ)
        const archiveDate = (lastDate && lastDate !== today && diffDays > 0) ? lastDate : null;
        if (archiveDate) {
            const exists = history.some(h => h.dateKey === archiveDate);
            if (!exists) {
                const prevCompleted = completed.filter(t => t && (getHabitDateKey(t.completedAt) === archiveDate || getHabitDateKey(t.completedAt) < today));
                const total = tasks.length + prevCompleted.length;
                const completedCount = prevCompleted.length;
                const unfinishedCount = tasks.length;
                const rate = total === 0 ? 0 : Math.round((completedCount / total) * 100);

                const entry = {
                    dateKey: archiveDate,
                    dateLabel: formatHabitDateLabel(archiveDate),
                    completedCount,
                    unfinishedCount,
                    rate,
                    completedList: prevCompleted.map(t => ({ title: t.title })),
                    unfinishedList: tasks.map(t => ({ title: t.title })),
                    savedAt: new Date().toISOString()
                };
                history.unshift(entry);
                localStorage.setItem("habitDailyHistory", JSON.stringify(history));
            }
        }

        // 2. 今日完了したものと過去完了したものを分離
        const todayCompleted = [];
        const pastCompleted = [];

        completed.forEach(t => {
            if (!t) return;
            if (getHabitDateKey(t.completedAt) === today) {
                todayCompleted.push(t);
            } else {
                pastCompleted.push(t);
            }
        });

        // 3. ストリーク（継続日数）の更新
        if (diffDays === 1) {
            // 昨日利用していた場合：昨日達成したタスクはストリーク+1、未達成は0
            pastCompleted.forEach(t => {
                t.streak = (t.streak || 0) + 1;
            });
            tasks.forEach(t => {
                t.streak = 0;
            });
        } else if (diffDays > 1) {
            // 2日以上空いた場合：すべて途切れ
            pastCompleted.forEach(t => {
                t.streak = 0;
            });
            tasks.forEach(t => {
                t.streak = 0;
            });
        }

        // 4. 過去達成タスクの completedAt を削除して未達成リストへマージ
        pastCompleted.forEach(t => {
            delete t.completedAt;
        });

        const taskMap = new Map();
        tasks.forEach(t => {
            if (t && t.id != null) taskMap.set(String(t.id), t);
        });
        pastCompleted.forEach(t => {
            if (t && t.id != null) taskMap.set(String(t.id), t);
        });

        const mergedTasks = Array.from(taskMap.values());

        localStorage.setItem("habitTasks", JSON.stringify(mergedTasks));
        localStorage.setItem("habitCompleted", JSON.stringify(todayCompleted));
        localStorage.setItem("habitLastDate", today);

        // 5. クラウドへ同期
        if (window.MyNoteDBSync && typeof window.MyNoteDBSync.flushSync === "function") {
            window.MyNoteDBSync.flushSync(["habitTasks", "habitCompleted", "habitDailyHistory", "habitLastDate"]);
        }

        // 6. 画面再描画の通知
        window.dispatchEvent(new CustomEvent("myNoteDataSynced"));
        if (typeof window.renderAll === "function") {
            window.renderAll();
        }

        return true;
    } finally {
        isResettingHabits = false;
    }
}

// 0:00:01 に日付変更を監視して自動リセット
function scheduleMidnightHabitReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 1, 0);
    const msUntilMidnight = Math.max(1000, tomorrow - now);

    setTimeout(() => {
        if (typeof window.checkHabitDailyReset === "function") {
            window.checkHabitDailyReset();
        }
        if (typeof window.renderAll === "function") {
            window.renderAll();
        }
        scheduleMidnightHabitReset();
    }, msUntilMidnight);
}

// グローバル公開
window.checkHabitDailyReset = checkHabitDailyReset;
window.checkDailyReset = checkHabitDailyReset;
window.getHabitTodayKey = getHabitTodayKey;
window.getHabitDateKey = getHabitDateKey;

// タブ復帰時やフォーカス時にも日付変更をチェック
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        if (typeof window.checkHabitDailyReset === "function") {
            window.checkHabitDailyReset();
        }
    }
});

window.addEventListener("focus", () => {
    if (typeof window.checkHabitDailyReset === "function") {
        window.checkHabitDailyReset();
    }
});

