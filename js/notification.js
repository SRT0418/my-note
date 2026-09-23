/**
 * MyNote Notification System (js/notification.js)
 * アプリ全体の通知機能（通知センター ＋ デスクトップ通知）
 */

(function () {
    // 既読通知ID一覧を取得
    function getReadNotificationIds() {
        try {
            return JSON.parse(localStorage.getItem("readNotificationIds")) || [];
        } catch (e) {
            return [];
        }
    }

    // 既読通知ID一覧を保存
    function saveReadNotificationIds(ids) {
        localStorage.setItem("readNotificationIds", JSON.stringify(ids));
    }

    // デスクトップ通知設定の取得・保存
    function getDesktopNotifySetting() {
        return localStorage.getItem("desktopNotifyEnabled") === "true";
    }

    function setDesktopNotifySetting(enabled) {
        localStorage.setItem("desktopNotifyEnabled", enabled ? "true" : "false");
    }

    // 今日の日付文字列 (YYYY-MM-DD)
    function getTodayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    // N日後の日付文字列 (YYYY-MM-DD)
    function getFutureDateKey(daysToAdd) {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    // 全アイテムから通知オブジェクトの配列を計算
    function calculateNotifications() {
        const notifications = [];
        const todayKey = getTodayKey();
        const in3DaysKey = getFutureDateKey(3);
        const readIds = getReadNotificationIds();
        const todayDateObj = new Date();
        const currentMonth = todayDateObj.getMonth() + 1;
        const currentDay = todayDateObj.getDate();

        // 1. 予定（schedules）
        try {
            const schedules = JSON.parse(localStorage.getItem("schedules")) || [];
            schedules.forEach(s => {
                if (!s || !s.startDate || !s.endDate) return;
                // 本日の予定
                if (s.startDate <= todayKey && s.endDate >= todayKey) {
                    const id = `sched-today-${s.id}-${todayKey}`;
                    const timeStr = s.allDay ? "終日" : (s.startTime ? `${s.startTime}～` : "");
                    notifications.push({
                        id: id,
                        category: "schedule",
                        title: "本日の予定",
                        message: `${s.title} ${timeStr ? "(" + timeStr + ")" : ""}`,
                        link: "calendar.html",
                        date: s.startDate,
                        badge: "予定",
                        isRead: readIds.includes(id),
                        priority: "high"
                    });
                }
                // 近日の予定（1〜3日以内）
                else if (s.startDate > todayKey && s.startDate <= in3DaysKey) {
                    const id = `sched-soon-${s.id}-${s.startDate}`;
                    notifications.push({
                        id: id,
                        category: "schedule",
                        title: "近日の予定",
                        message: `${s.title} (${s.startDate})`,
                        link: "calendar.html",
                        date: s.startDate,
                        badge: "予定",
                        isRead: readIds.includes(id),
                        priority: "mid"
                    });
                }
            });
        } catch (e) {
            console.error("Schedule notify error", e);
        }

        // 2. 課題締切（tasks）
        try {
            const kadais = JSON.parse(localStorage.getItem("tasks")) || [];
            kadais.forEach(k => {
                if (!k || !k.deadline) return;
                const id = `kadai-${k.id}-${k.deadline}`;
                if (k.deadline < todayKey) {
                    notifications.push({
                        id: id,
                        category: "kadai",
                        title: "課題締切超過！",
                        message: `【期限切れ】${k.title} (締切: ${k.deadline})`,
                        link: "kadai.html",
                        date: k.deadline,
                        badge: "課題",
                        isRead: readIds.includes(id),
                        priority: "high"
                    });
                } else if (k.deadline === todayKey) {
                    notifications.push({
                        id: id,
                        category: "kadai",
                        title: "課題締切当日！",
                        message: `【本日締切】${k.title}`,
                        link: "kadai.html",
                        date: k.deadline,
                        badge: "課題",
                        isRead: readIds.includes(id),
                        priority: "high"
                    });
                } else if (k.deadline <= in3DaysKey) {
                    notifications.push({
                        id: id,
                        category: "kadai",
                        title: "課題締切間近",
                        message: `【あと3日以内】${k.title} (締切: ${k.deadline})`,
                        link: "kadai.html",
                        date: k.deadline,
                        badge: "課題",
                        isRead: readIds.includes(id),
                        priority: "mid"
                    });
                }
            });
        } catch (e) {
            console.error("Kadai notify error", e);
        }

        // 3. 毎日習慣タスク（habitTasks）
        try {
            const habits = JSON.parse(localStorage.getItem("habitTasks")) || [];
            const completedHabits = JSON.parse(localStorage.getItem("habitCompleted")) || [];
            const completedIds = completedHabits.map(h => h.id);

            habits.forEach(h => {
                if (!h) return;
                if (!completedIds.includes(h.id)) {
                    const id = `habit-${h.id}-${todayKey}`;
                    notifications.push({
                        id: id,
                        category: "habit",
                        title: "習慣リマインダー",
                        message: `本日の習慣「${h.title}」が未達成です`,
                        link: "everydayTask.html",
                        date: todayKey,
                        badge: "習慣",
                        isRead: readIds.includes(id),
                        priority: "mid"
                    });
                }
            });
        } catch (e) {
            console.error("Habit notify error", e);
        }

        // 4. 誕生日（birthdays）
        try {
            const birthdays = JSON.parse(localStorage.getItem("birthdays")) || [];
            birthdays.forEach(b => {
                if (!b || !b.month || !b.day) return;
                // 今日の誕生日
                if (b.month === currentMonth && b.day === currentDay) {
                    const id = `bday-today-${b.id || b.name}-${todayKey}`;
                    notifications.push({
                        id: id,
                        category: "birthday",
                        title: "本日の誕生日",
                        message: `🎂 ${b.isMine ? "自分" : b.name}の誕生日です！`,
                        link: "birthdays.html",
                        date: todayKey,
                        badge: "誕生日",
                        isRead: readIds.includes(id),
                        priority: "high"
                    });
                } else {
                    // 7日以内の誕生日
                    for (let days = 1; days <= 7; days++) {
                        const target = new Date();
                        target.setDate(target.getDate() + days);
                        if (target.getMonth() + 1 === b.month && target.getDate() === b.day) {
                            const id = `bday-soon-${b.id || b.name}-${b.month}-${b.day}`;
                            notifications.push({
                                id: id,
                                category: "birthday",
                                title: "もうすぐ誕生日",
                                message: `🎁 ${b.name}の誕生日まであと${days}日 (${b.month}/${b.day})`,
                                link: "birthdays.html",
                                date: `${b.month}/${b.day}`,
                                badge: "誕生日",
                                isRead: readIds.includes(id),
                                priority: "mid"
                            });
                            break;
                        }
                    }
                }
            });
        } catch (e) {
            console.error("Birthday notify error", e);
        }

        return notifications;
    }

    // UI初期構築
    function setupNotificationUI() {
        let bellBtn = document.getElementById("notification-bell-btn");
        let navMenu = document.getElementById("nav-menu");

        if (!bellBtn) {
            bellBtn = document.createElement("button");
            bellBtn.id = "notification-bell-btn";
            bellBtn.className = "nav-notification-btn";
            bellBtn.setAttribute("aria-label", "通知センター");
            bellBtn.title = "通知センター";
            bellBtn.innerHTML = `<span>🔔 通知センター</span><span id="notification-badge" class="notification-badge" style="display:none;">0</span>`;
        }

        if (navMenu) {
            let container = navMenu.querySelector("#nav-notification-container");
            if (container) {
                if (!container.contains(bellBtn)) {
                    container.appendChild(bellBtn);
                }
            } else {
                let accountSec = navMenu.querySelector(".nav-menu-account");
                if (accountSec && !accountSec.contains(bellBtn)) {
                    accountSec.appendChild(bellBtn);
                } else if (!navMenu.contains(bellBtn)) {
                    const headerEl = navMenu.querySelector(".nav-menu-header");
                    if (headerEl && headerEl.nextSibling) {
                        navMenu.insertBefore(bellBtn, headerEl.nextSibling);
                    } else {
                        navMenu.appendChild(bellBtn);
                    }
                }
            }
        }

        // モーダル生成
        if (!document.getElementById("notification-modal")) {
            const modal = document.createElement("div");
            modal.id = "notification-modal";
            modal.className = "notification-modal-overlay";
            modal.innerHTML = `
                <div class="notification-modal-content">
                    <div class="notification-modal-header">
                        <h2>🔔 通知センター</h2>
                        <button id="notification-modal-close" class="notification-close-btn">&times;</button>
                    </div>
                    <div class="notification-modal-toolbar">
                        <div class="notification-tabs">
                            <button class="notification-tab active" data-cat="all">すべて</button>
                            <button class="notification-tab" data-cat="schedule">予定</button>
                            <button class="notification-tab" data-cat="kadai">課題</button>
                            <button class="notification-tab" data-cat="habit">習慣</button>
                            <button class="notification-tab" data-cat="birthday">誕生日</button>
                        </div>
                        <div class="notification-actions">
                            <button id="notification-mark-all" class="btn-sub-sm">すべて既読</button>
                        </div>
                    </div>
                    <div class="notification-settings-bar">
                        <label class="toggle-label">
                            <input type="checkbox" id="desktop-notify-toggle" ${getDesktopNotifySetting() ? "checked" : ""}>
                            デスクトップ通知を有効にする
                        </label>
                    </div>
                    <div id="notification-list-container" class="notification-list-container"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // イベントリスナー
            document.getElementById("notification-modal-close").addEventListener("click", toggleModal);
            modal.addEventListener("click", (e) => {
                if (e.target === modal) toggleModal();
            });

            // タブ切り替え
            const tabs = modal.querySelectorAll(".notification-tab");
            tabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    tabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");
                    renderNotificationList(tab.dataset.cat);
                });
            });

            // すべて既読
            document.getElementById("notification-mark-all").addEventListener("click", () => {
                const notifications = calculateNotifications();
                const allIds = notifications.map(n => n.id);
                saveReadNotificationIds(allIds);
                updateNotificationBadge();
                renderNotificationList(document.querySelector(".notification-tab.active").dataset.cat);
            });

            // デスクトップ通知トグル
            const desktopToggle = document.getElementById("desktop-notify-toggle");
            desktopToggle.addEventListener("change", (e) => {
                if (e.target.checked) {
                    if ("Notification" in window) {
                        Notification.requestPermission().then(permission => {
                            if (permission === "granted") {
                                setDesktopNotifySetting(true);
                                triggerDesktopNotifications();
                            } else {
                                alert("ブラウザの通知権限が拒否されています。ブラウザ設定から許可してください。");
                                e.target.checked = false;
                                setDesktopNotifySetting(false);
                            }
                        });
                    } else {
                        alert("お使いのブラウザはデスクトップ通知に対応していません。");
                        e.target.checked = false;
                    }
                } else {
                    setDesktopNotifySetting(false);
                }
            });
        }

        if (bellBtn) {
            bellBtn.addEventListener("click", toggleModal);
        }

        updateNotificationBadge();
        triggerDesktopNotifications();
    }

    function toggleModal() {
        const modal = document.getElementById("notification-modal");
        if (!modal) return;
        const isOpen = modal.classList.contains("open");
        if (isOpen) {
            modal.classList.remove("open");
        } else {
            modal.classList.add("open");
            const activeTab = document.querySelector(".notification-tab.active");
            renderNotificationList(activeTab ? activeTab.dataset.cat : "all");
        }
    }

    function updateNotificationBadge() {
        const badge = document.getElementById("notification-badge");
        if (!badge) return;
        const notifications = calculateNotifications();
        const unreadCount = notifications.filter(n => !n.isRead).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
            badge.style.display = "inline-flex";
        } else {
            badge.style.display = "none";
        }
    }

    function renderNotificationList(categoryFilter = "all") {
        const container = document.getElementById("notification-list-container");
        if (!container) return;

        let notifications = calculateNotifications();

        if (categoryFilter !== "all") {
            notifications = notifications.filter(n => n.category === categoryFilter);
        }

        if (notifications.length === 0) {
            container.innerHTML = `<div class="notification-empty">通知はありません</div>`;
            return;
        }

        container.innerHTML = "";
        notifications.forEach(n => {
            const item = document.createElement("div");
            item.className = `notification-item ${n.isRead ? "read" : "unread"} priority-${n.priority}`;
            item.innerHTML = `
                <div class="notification-item-content">
                    <div class="notification-item-meta">
                        <span class="notification-badge-tag cat-${n.category}">${n.badge}</span>
                        <span class="notification-item-title">${escapeHtml(n.title)}</span>
                    </div>
                    <div class="notification-item-msg">${escapeHtml(n.message)}</div>
                </div>
                <div class="notification-item-actions">
                    <a href="${n.link}" class="notification-go-btn">確認</a>
                    ${!n.isRead ? `<button class="notification-read-btn" data-id="${n.id}">既読</button>` : ""}
                </div>
            `;

            // 個別既読ボタン
            const readBtn = item.querySelector(".notification-read-btn");
            if (readBtn) {
                readBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const readIds = getReadNotificationIds();
                    if (!readIds.includes(n.id)) {
                        readIds.push(n.id);
                        saveReadNotificationIds(readIds);
                    }
                    updateNotificationBadge();
                    renderNotificationList(categoryFilter);
                });
            }

            container.appendChild(item);
        });
    }

    function triggerDesktopNotifications() {
        if (!getDesktopNotifySetting() || !("Notification" in window) || Notification.permission !== "granted") {
            return;
        }

        const notifications = calculateNotifications();
        const highPriorityUnread = notifications.filter(n => n.priority === "high" && !n.isRead);

        const notifiedKeys = JSON.parse(localStorage.getItem("desktopNotifiedKeys") || "[]");
        const todayKey = getTodayKey();

        highPriorityUnread.forEach(n => {
            const notifyKey = `${n.id}-${todayKey}`;
            if (!notifiedKeys.includes(notifyKey)) {
                try {
                    new Notification(`MyNote: ${n.title}`, {
                        body: n.message,
                        icon: "./MyNote.png"
                    });
                    notifiedKeys.push(notifyKey);
                } catch (e) {
                    console.error("Desktop notify trigger error", e);
                }
            }
        });

        localStorage.setItem("desktopNotifiedKeys", JSON.stringify(notifiedKeys.slice(-100)));
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 初期化実行
    window.addEventListener("DOMContentLoaded", () => {
        setupNotificationUI();
    });

    // グローバル再計算関数
    window.refreshNotifications = function () {
        updateNotificationBadge();
        triggerDesktopNotifications();
    };

    window.setupNotificationUI = setupNotificationUI;
})();
