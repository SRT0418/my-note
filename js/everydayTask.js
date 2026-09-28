// ===================================================
// everydayTask.js
// 毎日習慣タスク管理のメインロジック
// ===================================================

// HTMLエスケープヘルパー
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 「追加」ボタンを押したときに習慣タスク追加画面へ遷移する
const addBtn = document.getElementById("add-button");
if (addBtn) {
    addBtn.addEventListener("click", () => {
        window.location.href = "./add-everydayTask.html";
    });
}

// ===================================================
// localStorage ヘルパー
// ===================================================

// 未達成（アクティブ）の習慣タスクを取得する
function getHabitTasks() {
    return JSON.parse(localStorage.getItem("habitTasks")) || [];
}

// 今日達成済みの習慣タスクを取得する
function getHabitCompleted() {
    return JSON.parse(localStorage.getItem("habitCompleted")) || [];
}

// 削除済み習慣タスクを取得する
function getHabitDeleted() {
    return JSON.parse(localStorage.getItem("habitDeleted")) || [];
}

// 未達成習慣タスクを保存する
function saveHabitTasks(tasks) {
    localStorage.setItem("habitTasks", JSON.stringify(tasks));
}

// 達成済み習慣タスクを保存する
function saveHabitCompleted(tasks) {
    localStorage.setItem("habitCompleted", JSON.stringify(tasks));
}

// 削除済み習慣タスクを保存する
function saveHabitDeleted(tasks) {
    localStorage.setItem("habitDeleted", JSON.stringify(tasks));
}

// 日次履歴の配列を取得する
function getDailyHistory() {
    return JSON.parse(localStorage.getItem("habitDailyHistory")) || [];
}

// 日次履歴を保存する
function saveDailyHistory(history) {
    localStorage.setItem("habitDailyHistory", JSON.stringify(history));
}

// ===================================================
// 日付計算・日次リセット処理
// ===================================================

// 今日の日付キー（YYYY-MM-DD）を返す
function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// 日付差（日数）を計算する (date2 - date1)
function getDaysDiff(dateKey1, dateKey2) {
    if (!dateKey1 || !dateKey2) return 0;
    const d1 = new Date(dateKey1 + "T00:00:00");
    const d2 = new Date(dateKey2 + "T00:00:00");
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// 日付キー（YYYY-MM-DD）を日本語ラベルに変換する
function formatDateLabel(dateKey) {
    const d = new Date(dateKey + "T00:00:00");
    if (isNaN(d.getTime())) return dateKey;
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

// ページを開いたとき、前回保存した日付と今日が異なれば日次リセットを実行する
function checkDailyReset() {
    const lastDate = localStorage.getItem("habitLastDate");
    const today = getTodayKey();

    // 初回アクセス時
    if (!lastDate) {
        localStorage.setItem("habitLastDate", today);
        return false;
    }

    // すでに今日リセット済み
    if (lastDate === today) {
        return false;
    }

    const diffDays = getDaysDiff(lastDate, today);
    if (diffDays <= 0) {
        localStorage.setItem("habitLastDate", today);
        return false;
    }

    // 1. 最後にアクセスした日の実績を履歴に保存
    archivePreviousDay(lastDate);

    // 2. タスクデータの取得
    let tasks = getHabitTasks();
    let completed = getHabitCompleted();

    // 3. ストリーク（継続日数）の更新
    if (diffDays === 1) {
        // 昨日利用していた場合：
        // 達成済みタスクはストリーク +1
        completed.forEach(t => {
            t.streak = (t.streak || 0) + 1;
        });
        // 未達成タスクはストリーク 0（途切れ）
        tasks.forEach(t => {
            t.streak = 0;
        });
    } else {
        // 2日以上空いた場合：昨日達成していないため、すべてのタスクのストリークは途切れ(0にリセット)
        completed.forEach(t => {
            t.streak = 0;
        });
        tasks.forEach(t => {
            t.streak = 0;
        });
    }

    // 4. 達成済みタスクを「未達成」へリセット（completedAtを削除）
    completed.forEach(t => {
        delete t.completedAt;
    });

    // ID重複を排除してマージ
    const taskMap = new Map();
    tasks.forEach(t => {
        if (t && t.id) taskMap.set(t.id, t);
    });
    completed.forEach(t => {
        if (t && t.id) taskMap.set(t.id, t);
    });
    const merged = Array.from(taskMap.values());

    saveHabitTasks(merged);
    saveHabitCompleted([]);
    localStorage.setItem("habitLastDate", today);

    // 5. クラウド（Supabase）へ即時プッシュ（古いクラウドデータによる巻き戻りを防止）
    if (window.MyNoteDBSync && typeof window.MyNoteDBSync.flushSync === "function") {
        window.MyNoteDBSync.flushSync("habitTasks");
        window.MyNoteDBSync.flushSync("habitCompleted");
        window.MyNoteDBSync.flushSync("habitDailyHistory");
        window.MyNoteDBSync.flushSync("habitLastDate");
    }

    return true;
}

// 前日の達成・未達成を日次履歴に保存する
function archivePreviousDay(dateKey) {
    const tasks = getHabitTasks();
    const completed = getHabitCompleted();
    const history = getDailyHistory();

    // 既にこの日の記録がなければ追加する
    const exists = history.some(h => h.dateKey === dateKey);
    if (!exists) {
        const total = tasks.length + completed.length;
        const completedCount = completed.length;
        const unfinishedCount = tasks.length;
        const rate = total === 0 ? 0 : Math.round((completedCount / total) * 100);

        const entry = {
            dateKey,
            dateLabel: formatDateLabel(dateKey),
            completedCount,
            unfinishedCount,
            rate,
            completedList: completed.map(t => ({ title: t.title })),
            unfinishedList: tasks.map(t => ({ title: t.title })),
            savedAt: new Date().toISOString()
        };

        history.unshift(entry); // 新しい日が先頭
        saveDailyHistory(history);
    }
}

// ===================================================
// 0:00 自動リセットタイマー
// ===================================================
function scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 1, 0); // 0:00:01 にセット
    const msUntilMidnight = Math.max(1000, tomorrow - now);

    setTimeout(() => {
        refreshAll();
        scheduleMidnightReset();
    }, msUntilMidnight);
}

// ===================================================
// 表示処理
// ===================================================

// 未達成の習慣タスクを画面に表示する
function renderHabitTasks() {
    const tasks = getHabitTasks();
    const list = document.getElementById("habit-unfinished-list");
    if (!list) return;

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>未達成の習慣タスクはありません</p>";
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        const div = document.createElement("div");
        div.className = "card";

        const streak = task.streak || 0;
        const streakBadge = streak > 0
            ? `<span class="streak-badge">${streak}日継続中</span>`
            : `<span class="streak-badge streak-zero">─ 未継続</span>`;
        const completedCount = task.completedCount || 0;
        const countBadge = `<span class="count-badge" style="font-size:0.85em;color:#000000">達成回数：${completedCount}回</span>`;

        const titleEscaped = escapeHtml(task.title);
        const detailEscaped = task.detail ? escapeHtml(task.detail).replace(/\n/g, "<br>") : "";
        const createdDate = task.createdAt ? new Date(task.createdAt).toLocaleDateString("ja-JP") : "─";

        div.innerHTML = `
            <p><strong>${titleEscaped}</strong> ${streakBadge}</p>
            ${detailEscaped ? `<p style="color:#666;font-size:0.92em">${detailEscaped}</p>` : ""}
            <p>${countBadge}</p>
            <p style="font-size:0.85em;color:#aaa">追加日：${createdDate}</p>
            <button class="habit-complete-btn" data-id="${task.id}">達成</button>
            <button class="habit-edit-btn" data-id="${task.id}">編集</button>
            <button class="habit-delete-btn" data-id="${task.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// 達成済みの習慣タスクを画面に表示する
function renderCompletedHabitTasks() {
    const tasks = getHabitCompleted();
    const list = document.getElementById("habit-completed-list");
    if (!list) return;

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>今日はまだ達成したタスクがありません</p>";
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        const div = document.createElement("div");
        div.className = "card";

        const streak = task.streak || 0;
        const nextStreak = streak + 1;
        const streakBadge = `<span class="streak-badge streak-completed">${streak}日継続 → 達成で${nextStreak}日目</span>`;
        const completedCount = task.completedCount || 0;
        const countBadge = `<span class="count-badge" style="font-size:0.85em;color:#000000">達成回数：${completedCount}回</span>`;

        const titleEscaped = escapeHtml(task.title);
        const detailEscaped = task.detail ? escapeHtml(task.detail).replace(/\n/g, "<br>") : "";
        const completedDate = task.completedAt ? new Date(task.completedAt).toLocaleString("ja-JP") : "─";

        div.innerHTML = `
            <p><strong>${titleEscaped}</strong> <span style="color:#2ecc71"></span> ${streakBadge}</p>
            ${detailEscaped ? `<p style="color:#666;font-size:0.92em">${detailEscaped}</p>` : ""}
            <p>${countBadge}</p>
            <p style="font-size:0.85em;color:#aaa">達成：${completedDate}</p>
            <button class="habit-undo-btn" data-id="${task.id}">取り消し</button>
            <button class="habit-delete-completed-btn" data-id="${task.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// 削除済みの習慣タスクを画面に表示する
function renderDeletedHabitTasks() {
    const tasks = getHabitDeleted();
    const list = document.getElementById("habit-deleted-list");
    if (!list) return;

    tasks.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>削除済みの習慣タスクはありません</p>";
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        const purgeDate = new Date(task.deletedAt);
        purgeDate.setMonth(purgeDate.getMonth() + 3);
        const remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));

        const div = document.createElement("div");
        div.className = "card";

        const titleEscaped = escapeHtml(task.title);
        const detailEscaped = task.detail ? escapeHtml(task.detail).replace(/\n/g, "<br>") : "";
        const deletedDate = task.deletedAt ? new Date(task.deletedAt).toLocaleString("ja-JP") : "─";

        div.innerHTML = `
            <p><strong>${titleEscaped}</strong></p>
            ${detailEscaped ? `<p style="color:#666;font-size:0.92em">${detailEscaped}</p>` : ""}
            <p style="font-size:0.85em;color:#aaa">削除：${deletedDate}</p>
            <p style="font-size:0.85em;color:#000000">あと${remainingDays}日で自動的に完全削除されます</p>
            <button class="habit-restore-btn" data-id="${task.id}">元に戻す</button>
            <button class="habit-delete-forever-btn" data-id="${task.id}">完全に削除</button>
        `;

        list.appendChild(div);
    });
}

// 件数を更新する
function updateHabitCounts() {
    const tasks = getHabitTasks();
    const completed = getHabitCompleted();

    const unfinishedEl = document.getElementById("unfinished-count");
    const completedEl = document.getElementById("completed-count");

    if (unfinishedEl) unfinishedEl.textContent = tasks.length;
    if (completedEl) completedEl.textContent = completed.length;
}

// 全描画・更新の一元化
function refreshAll() {
    checkDailyReset();
    purgeOldDeletedHabitTasks();
    renderHabitTasks();
    renderCompletedHabitTasks();
    renderDeletedHabitTasks();
    updateHabitCounts();
}

// クラウド同期後に db-sync.js から呼び出されるグローバル再描画関数
window.renderAll = function () {
    refreshAll();
};

// ===================================================
// ボタン操作
// ===================================================

document.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("habit-complete-btn")) {
        completeHabitTask(id);
    }
    if (btn.classList.contains("habit-undo-btn")) {
        undoHabitTask(id);
    }
    if (btn.classList.contains("habit-edit-btn")) {
        window.location.href = `add-everydayTask.html?id=${id}`;
    }
    if (btn.classList.contains("habit-delete-btn")) {
        deleteHabitTask(id);
    }
    if (btn.classList.contains("habit-delete-completed-btn")) {
        deleteHabitCompleted(id);
    }
    if (btn.classList.contains("habit-restore-btn")) {
        restoreHabitTask(id);
    }
    if (btn.classList.contains("habit-delete-forever-btn")) {
        deleteHabitForever(id);
    }
});

// タスクを達成済みにする
function completeHabitTask(id) {
    let tasks = getHabitTasks();
    let completed = getHabitCompleted();

    const idx = tasks.findIndex(t => t.id == id);
    if (idx === -1) return;

    const task = tasks.splice(idx, 1)[0];
    task.completedAt = new Date().toISOString();
    task.completedCount = (task.completedCount || 0) + 1;

    completed.push(task);

    saveHabitTasks(tasks);
    saveHabitCompleted(completed);

    refreshAll();
}

// 達成済みを未達成に戻す（取り消し）
function undoHabitTask(id) {
    let tasks = getHabitTasks();
    let completed = getHabitCompleted();

    const idx = completed.findIndex(t => t.id == id);
    if (idx === -1) return;

    const task = completed.splice(idx, 1)[0];
    delete task.completedAt;
    task.completedCount = Math.max(0, (task.completedCount || 0) - 1);

    tasks.push(task);

    saveHabitTasks(tasks);
    saveHabitCompleted(completed);

    refreshAll();
}

// 未達成タスクを削除（一時保存）する
function deleteHabitTask(id) {
    let tasks = getHabitTasks();
    let deleted = getHabitDeleted();

    const idx = tasks.findIndex(t => t.id == id);
    if (idx === -1) return;

    const task = tasks.splice(idx, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "habitTasks";

    deleted.push(task);

    saveHabitTasks(tasks);
    saveHabitDeleted(deleted);

    refreshAll();
}

// 達成済みタスクを削除（一時保存）する
function deleteHabitCompleted(id) {
    let completedTasks = getHabitCompleted();
    let deleted = getHabitDeleted();

    const idx = completedTasks.findIndex(t => t.id == id);
    if (idx === -1) return;

    const task = completedTasks.splice(idx, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "habitCompleted";

    deleted.push(task);

    saveHabitCompleted(completedTasks);
    saveHabitDeleted(deleted);

    refreshAll();
}

// 削除済みタスクを元に戻す
function restoreHabitTask(id) {
    let deleted = getHabitDeleted();

    const idx = deleted.findIndex(t => t.id == id);
    if (idx === -1) return;

    const task = deleted.splice(idx, 1)[0];
    const from = task.from;
    delete task.deletedAt;
    delete task.from;

    const today = getTodayKey();
    let isTodayCompleted = false;
    if (task.completedAt) {
        const completedDateKey = task.completedAt.split("T")[0];
        if (completedDateKey === today) {
            isTodayCompleted = true;
        }
    }

    if (from === "habitCompleted" && isTodayCompleted) {
        let completed = getHabitCompleted();
        completed.push(task);
        saveHabitCompleted(completed);
    } else {
        delete task.completedAt;
        let tasks = getHabitTasks();
        tasks.push(task);
        saveHabitTasks(tasks);
    }

    saveHabitDeleted(deleted);
    refreshAll();
}

// 削除済みタスクを完全に削除する
function deleteHabitForever(id) {
    if (!confirm("このタスクを完全に削除します。元に戻せませんがよろしいですか？")) return;

    let deleted = getHabitDeleted();
    deleted = deleted.filter(t => t.id != id);

    saveHabitDeleted(deleted);
    renderDeletedHabitTasks();
}

// 削除から3ヶ月経過した習慣タスクを自動的に完全削除する
function purgeOldDeletedHabitTasks() {
    let deleted = getHabitDeleted();
    const now = new Date();
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - 3);

    const remaining = deleted.filter(t => new Date(t.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveHabitDeleted(remaining);
    }
}

// ===================================================
// イベントリスナー（多角的な日付変更監視・リセット実行）
// ===================================================

window.addEventListener("load", () => {
    refreshAll();
    scheduleMidnightReset();
});

document.addEventListener("DOMContentLoaded", () => {
    refreshAll();
});

// タブ復帰時（PCスリープ解除・別タブ切り替え時）に日付変更を即時反映
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        refreshAll();
    }
});

// ウィンドウフォーカス時にも日付変更をチェック
window.addEventListener("focus", () => {
    refreshAll();
});

// 30秒ごとの定期ポーリングで日付跨ぎを自動検出
setInterval(() => {
    const today = getTodayKey();
    const lastDate = localStorage.getItem("habitLastDate");
    if (lastDate && lastDate !== today) {
        refreshAll();
    }
}, 30000);