// ===================================================
// everydayTask.js
// 毎日習慣タスク管理のメインロジック
// ===================================================

// 「追加」ボタンを押したときに習慣タスク追加画面へ遷移する
document.getElementById("add-button").addEventListener("click", () => {
    window.location.href = "./add-everydayTask.html";
});

// ページ読み込み時に一覧・件数を表示し、日付が変わっていれば履歴に保存する
window.addEventListener("load", () => {
    checkDailyReset();
    purgeOldDeletedHabitTasks();
    renderHabitTasks();
    renderCompletedHabitTasks();
    renderDeletedHabitTasks();
    updateHabitCounts();
    scheduleMidnightReset();
});

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
// 日付リセット処理（0:00になったら前日の結果を履歴に保存）
// ===================================================

// 今日の日付キー（YYYY-MM-DD）を返す
function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// ページを開いたとき、前回保存した日付と今日が異なれば日次リセットを実行する
function checkDailyReset() {
    const lastDate = localStorage.getItem("habitLastDate");
    const today = getTodayKey();

    if (lastDate && lastDate !== today) {
        // 前日の結果を履歴に保存する
        archivePreviousDay(lastDate);
        // 達成済みを未達成リストへ戻す（毎朝リセット）
        resetDailyCompletion();
    }

    // 今日の日付を記録する
    localStorage.setItem("habitLastDate", today);
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

    // ストリーク更新：達成済みは +1、未達成は 0 にリセット
    const completedIds = new Set(getHabitCompleted().map(t => t.id));

    let tasks2 = getHabitTasks();
    let completed2 = getHabitCompleted();

    // 達成済みタスク：streak を +1
    completed2.forEach(t => {
        t.streak = (t.streak || 0) + 1;
    });

    // 未達成タスク：streak を 0 にリセット
    tasks2.forEach(t => {
        t.streak = 0;
    });

    saveHabitTasks(tasks2);
    saveHabitCompleted(completed2);
}

// 毎日0:00にリセット：達成済みを全て「未達成」に戻す
function resetDailyCompletion() {
    const completed = getHabitCompleted();
    const tasks = getHabitTasks();

    // 達成済みを未達成に戻す（completedAtを削除、streakは保持）
    completed.forEach(t => {
        delete t.completedAt;
    });

    const merged = tasks.concat(completed);
    saveHabitTasks(merged);
    saveHabitCompleted([]);
}

// 日付キー（YYYY-MM-DD）を日本語ラベルに変換する
function formatDateLabel(dateKey) {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

// ===================================================
// 0:00 になったら自動でリセットするタイマーをセットする
// ===================================================
function scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;

    setTimeout(() => {
        const today = getTodayKey();
        const lastDate = localStorage.getItem("habitLastDate");
        if (lastDate && lastDate !== today) {
            archivePreviousDay(lastDate);
            resetDailyCompletion();
            localStorage.setItem("habitLastDate", today);
        }
        renderHabitTasks();
        renderCompletedHabitTasks();
        updateHabitCounts();
        // 次の日も続けてタイマーをセット
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
        const div = document.createElement("div");
        div.className = "card";

        const streak = task.streak || 0;
        const streakBadge = streak > 0
            ? `<span class="streak-badge">${streak}日継続中</span>`
            : `<span class="streak-badge streak-zero">─ 未継続</span>`;
        const completedCount = task.completedCount || 0;
        const countBadge = `<span class="count-badge" style="font-size:0.85em;color:#888">達成回数：${completedCount}回</span>`;

        div.innerHTML = `
            <p><strong>${task.title}</strong> ${streakBadge}</p>
            ${task.detail ? `<p style="color:#666;font-size:0.92em">${task.detail}</p>` : ""}
            <p>${countBadge}</p>
            <p style="font-size:0.85em;color:#aaa">追加日：${new Date(task.createdAt).toLocaleDateString("ja-JP")}</p>
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
        const div = document.createElement("div");
        div.className = "card";

        const streak = task.streak || 0;
        const nextStreak = streak + 1;
        const streakBadge = `<span class="streak-badge streak-completed">${streak}日継続 → 達成で${nextStreak}日目</span>`;
        const completedCount = task.completedCount || 0;
        const countBadge = `<span class="count-badge" style="font-size:0.85em;color:#888">達成回数：${completedCount}回</span>`;

        div.innerHTML = `
            <p><strong>${task.title}</strong> <span style="color:#2ecc71"></span> ${streakBadge}</p>
            ${task.detail ? `<p style="color:#666;font-size:0.92em">${task.detail}</p>` : ""}
            <p>${countBadge}</p>
            <p style="font-size:0.85em;color:#aaa">達成：${new Date(task.completedAt).toLocaleString("ja-JP")}</p>
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
        const purgeDate = new Date(task.deletedAt);
        purgeDate.setMonth(purgeDate.getMonth() + 3);
        const remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p><strong>${task.title}</strong></p>
            ${task.detail ? `<p style="color:#666;font-size:0.92em">${task.detail}</p>` : ""}
            <p style="font-size:0.85em;color:#aaa">削除：${new Date(task.deletedAt).toLocaleString("ja-JP")}</p>
            <p style="font-size:0.85em;color:#aaa">あと${remainingDays}日で自動的に完全削除されます</p>
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

    renderHabitTasks();
    renderCompletedHabitTasks();
    updateHabitCounts();
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

    renderHabitTasks();
    renderCompletedHabitTasks();
    updateHabitCounts();
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

    renderHabitTasks();
    renderDeletedHabitTasks();
    updateHabitCounts();
}

// 達成済みタスクを削除（一時保存）する
function deleteHabitCompleted(id) {
    let tasks = getHabitCompleted();
    let deleted = getHabitDeleted();

    const idx = tasks.findIndex(t => t.id == id);
    if (idx === -1) return;

    const task = tasks.splice(idx, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "habitCompleted";

    deleted.push(task);

    saveHabitCompleted(tasks);
    saveHabitDeleted(deleted);

    renderCompletedHabitTasks();
    renderDeletedHabitTasks();
    updateHabitCounts();
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

    if (from === "habitCompleted") {
        let completed = getHabitCompleted();
        // 復元する場合、達成時刻がなければ未達成として戻す
        if (!task.completedAt) {
            let tasks = getHabitTasks();
            tasks.push(task);
            saveHabitTasks(tasks);
            renderHabitTasks();
        } else {
            completed.push(task);
            saveHabitCompleted(completed);
            renderCompletedHabitTasks();
        }
    } else {
        let tasks = getHabitTasks();
        tasks.push(task);
        saveHabitTasks(tasks);
        renderHabitTasks();
    }

    saveHabitDeleted(deleted);
    renderDeletedHabitTasks();
    updateHabitCounts();
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