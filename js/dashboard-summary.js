/* =========================================================
   MyNote - 今日のサマリー・ダッシュボード (dashboard-summary.js)
   ---------------------------------------------------------
   ・今日の課題締切、習慣タスク達成状況、本日の予定・誕生日、
     重要タスクを一目で確認できるダッシュボードコンポーネント。
   ========================================================= */

(function () {
    "use strict";

    function getTodayKey() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function getFutureDateKey(daysAhead) {
        const target = new Date();
        target.setDate(target.getDate() + daysAhead);
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, "0");
        const d = String(target.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function safeParse(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            return [];
        }
    }

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // ── レンダリング関数 ────────────────────────────────────
    function renderTodayDashboard() {
        const container = document.getElementById("today-summary-container");
        if (!container) return;

        const todayKey = getTodayKey();
        const in3DaysKey = getFutureDateKey(3);
        const in7DaysKey = getFutureDateKey(7);

        // 1. 課題締切（tasks）
        const allTasks = safeParse("tasks");
        const urgentKadais = [];
        let expiredCount = 0;
        let todayCount = 0;

        allTasks.forEach(k => {
            if (!k || !k.deadline) return;
            if (k.deadline < todayKey) {
                expiredCount++;
                urgentKadais.push({ ...k, status: "expired", label: "期限切" });
            } else if (k.deadline === todayKey) {
                todayCount++;
                urgentKadais.push({ ...k, status: "today", label: "本日締切" });
            } else if (k.deadline <= in3DaysKey) {
                const diffDays = Math.ceil((new Date(k.deadline) - new Date(todayKey)) / (1000 * 60 * 60 * 24));
                urgentKadais.push({ ...k, status: "soon", label: `あと${diffDays}日` });
            }
        });

        // 締切昇順でソート
        urgentKadais.sort((a, b) => (a.deadline > b.deadline ? 1 : -1));

        // 2. 毎日習慣タスク（habitTasks, habitCompleted）
        const habitTasks = safeParse("habitTasks");
        const habitCompleted = safeParse("habitCompleted");
        const completedHabitsCount = habitCompleted.length;
        const totalHabits = habitTasks.length + completedHabitsCount;
        const habitPercent = totalHabits > 0 ? Math.round((completedHabitsCount / totalHabits) * 100) : 0;
        const completedIds = new Set(habitCompleted.map(t => t && t.id));
        const remainingHabits = habitTasks.filter(t => t && !completedIds.has(t.id));

        // 3. 今日の予定 ＆ 近日誕生日
        const schedules = safeParse("schedules");
        const todaySchedules = schedules.filter(s => s && s.startDate && s.startDate <= todayKey && s.endDate >= todayKey);

        const birthdays = safeParse("birthdays");
        const upcomingBirthdays = [];
        const todayMonth = new Date().getMonth() + 1;
        const todayDate = new Date().getDate();

        birthdays.forEach(b => {
            if (!b || !b.month || !b.day) return;
            const bMonth = parseInt(b.month, 10);
            const bDay = parseInt(b.day, 10);
            const thisYear = new Date().getFullYear();
            let bDate = new Date(thisYear, bMonth - 1, bDay);
            if (bDate < new Date(thisYear, todayMonth - 1, todayDate)) {
                bDate = new Date(thisYear + 1, bMonth - 1, bDay);
            }
            const diffDays = Math.ceil((bDate - new Date(thisYear, todayMonth - 1, todayDate)) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 7) {
                upcomingBirthdays.push({
                    name: b.name,
                    diffDays: diffDays,
                    isToday: diffDays === 0
                });
            }
        });
        upcomingBirthdays.sort((a, b) => a.diffDays - b.diffDays);

        // 4. 未完了Todo（todoTasks）
        const todoTasks = safeParse("todoTasks");
        const highPriorityTodos = todoTasks.filter(t => t.priority === "高" || t.priority === 3);

        // ── HTML組み立て ────────────────────────────────────
        let kadaiBodyHTML = "";
        if (urgentKadais.length > 0) {
            kadaiBodyHTML = `
                <div class="kadai-urgent-list">
                    ${urgentKadais.slice(0, 3).map(k => `
                        <div class="kadai-urgent-item">
                            <span class="kadai-name" title="${escapeHtml(k.title)}">${escapeHtml(k.title)}</span>
                            <span class="kadai-tag ${k.status}">${k.label}</span>
                        </div>
                    `).join("")}
                    ${urgentKadais.length > 3 ? `<div style="font-size:0.72rem; color:#64748b; text-align:right;">他 ${urgentKadais.length - 3} 件</div>` : ""}
                </div>
            `;
        } else {
            kadaiBodyHTML = `<div class="dash-empty-state">直近の締切課題はありません</div>`;
        }

        let habitBodyHTML = "";
        if (totalHabits > 0) {
            habitBodyHTML = `
                <div class="habit-progress-wrap">
                    <div class="habit-progress-info">
                        <span class="habit-progress-text">${completedHabitsCount} / ${totalHabits} 完了</span>
                        <span class="habit-progress-percent">${habitPercent}%</span>
                    </div>
                    <div class="habit-progress-bar">
                        <div class="habit-progress-fill" style="width: ${habitPercent}%;"></div>
                    </div>
                    <div class="habit-remaining-names" title="${remainingHabits.map(t => escapeHtml(t.title)).join(', ')}">
                        ${remainingHabits.length > 0 ? `残り: ${remainingHabits.slice(0, 2).map(t => escapeHtml(t.title)).join(", ")}${remainingHabits.length > 2 ? ' 他' : ''}` : 'すべて達成しました'}
                    </div>
                </div>
            `;
        } else {
            habitBodyHTML = `<div class="dash-empty-state">習慣タスクが登録されていません</div>`;
        }

        let scheduleBodyHTML = "";
        const scheduleOrBirthdayItems = [];
        todaySchedules.slice(0, 2).forEach(s => {
            const time = s.allDay ? "終日" : (s.startTime ? s.startTime : "予定");
            scheduleOrBirthdayItems.push(`
                <div class="schedule-row">
                    <span class="schedule-tag">${escapeHtml(time)}</span>
                    <span title="${escapeHtml(s.title)}">${escapeHtml(s.title)}</span>
                </div>
            `);
        });
        upcomingBirthdays.slice(0, 2).forEach(b => {
            scheduleOrBirthdayItems.push(`
                <div class="schedule-row">
                    <span class="birthday-tag">${b.isToday ? "本日" : `あと${b.diffDays}日`}</span>
                    <span>${escapeHtml(b.name)}</span>
                </div>
            `);
        });

        if (scheduleOrBirthdayItems.length > 0) {
            scheduleBodyHTML = `
                <div class="schedule-item-list">
                    ${scheduleOrBirthdayItems.slice(0, 3).join("")}
                </div>
            `;
        } else {
            scheduleBodyHTML = `<div class="dash-empty-state">本日の予定や直近誕生日はありません</div>`;
        }

        let todoBodyHTML = "";
        if (todoTasks.length > 0) {
            todoBodyHTML = `
                <div class="todo-urgent-list">
                    ${highPriorityTodos.length > 0 ? highPriorityTodos.slice(0, 2).map(t => `
                        <div class="todo-row">
                            <span style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;" title="${escapeHtml(t.title || t.content)}">${escapeHtml(t.title || t.content)}</span>
                            <span class="todo-priority-high">優先: 高</span>
                        </div>
                    `).join("") : `
                        <div class="todo-row" style="color:#64748b;">
                            <span>未完了タスク</span>
                            <span style="font-weight:700;">${todoTasks.length} 件</span>
                        </div>
                    `}
                    ${highPriorityTodos.length > 2 ? `<div style="font-size:0.72rem; color:#64748b; text-align:right;">他高優先 ${highPriorityTodos.length - 2} 件</div>` : ""}
                </div>
            `;
        } else {
            todoBodyHTML = `<div class="dash-empty-state">未完了のタスクはありません</div>`;
        }

        // 全体コンテナを描画
        container.innerHTML = `
            <div class="dashboard-header">
                <div class="dashboard-title-wrap">
                    <h2>今日のサマリー</h2>
                    <span class="dashboard-badge-live">LIVE</span>
                </div>
                <div class="dashboard-actions">
                    <button class="dashboard-btn-icon" id="dash-backup-btn" title="データのエクスポート・復元">
                        データバックアップ
                    </button>
                    <button class="dashboard-btn-icon" id="dash-refresh-btn" title="サマリーを再計算">
                        更新
                    </button>
                </div>
            </div>

            <div class="dashboard-grid">
                <!-- 1. 課題締切 -->
                <div class="dash-card card-kadai" onclick="location.href='kadai.html'">
                    <div class="dash-card-header">
                        <span class="dash-card-title">課題締切</span>
                        <span class="dash-card-count" style="${expiredCount > 0 ? 'background:#fee2e2; color:#dc2626; font-weight:800;' : ''}">
                            ${expiredCount > 0 ? `警告 ${expiredCount}` : `${urgentKadais.length}件`}
                        </span>
                    </div>
                    <div class="dash-card-body">
                        ${kadaiBodyHTML}
                    </div>
                    <div class="dash-card-footer">
                        課題一覧へ →
                    </div>
                </div>

                <!-- 2. 毎日習慣 -->
                <div class="dash-card card-habit" onclick="location.href='everydayTask.html'">
                    <div class="dash-card-header">
                        <span class="dash-card-title">毎日習慣</span>
                        <span class="dash-card-count">${completedHabitsCount}/${totalHabits}</span>
                    </div>
                    <div class="dash-card-body">
                        ${habitBodyHTML}
                    </div>
                    <div class="dash-card-footer">
                        習慣の記録へ →
                    </div>
                </div>

                <!-- 3. 今日の予定 ＆ 近日誕生日 -->
                <div class="dash-card card-schedule" onclick="location.href='calendar.html'">
                    <div class="dash-card-header">
                        <span class="dash-card-title">予定 & 記念日</span>
                        <span class="dash-card-count">${todaySchedules.length}件</span>
                    </div>
                    <div class="dash-card-body">
                        ${scheduleBodyHTML}
                    </div>
                    <div class="dash-card-footer">
                        カレンダーへ →
                    </div>
                </div>

                <!-- 4. タスク管理 -->
                <div class="dash-card card-todo" onclick="location.href='tasks.html'">
                    <div class="dash-card-header">
                        <span class="dash-card-title">タスク (ToDo)</span>
                        <span class="dash-card-count">${todoTasks.length}件</span>
                    </div>
                    <div class="dash-card-body">
                        ${todoBodyHTML}
                    </div>
                    <div class="dash-card-footer">
                        タスク管理へ →
                    </div>
                </div>
            </div>
        `;

        // イベント設定
        const refreshBtn = document.getElementById("dash-refresh-btn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                refreshBtn.style.transform = "rotate(180deg)";
                refreshBtn.style.transition = "transform 0.4s ease";
                setTimeout(() => {
                    refreshBtn.style.transform = "none";
                    renderTodayDashboard();
                }, 400);
            });
        }

        const backupBtn = document.getElementById("dash-backup-btn");
        if (backupBtn) {
            backupBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (window.MyNoteBackup && typeof window.MyNoteBackup.openModal === "function") {
                    window.MyNoteBackup.openModal();
                } else {
                    alert("バックアップモジュールを読み込み中です。");
                }
            });
        }
    }

    // ── 初期化 & イベント登録 ────────────────────────────────
    window.renderTodayDashboard = renderTodayDashboard;

    document.addEventListener("DOMContentLoaded", renderTodayDashboard);
    window.addEventListener("storage", renderTodayDashboard);
    window.addEventListener("myNoteDataSynced", renderTodayDashboard);
})();
