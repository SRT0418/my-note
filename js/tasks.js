// ===================================================
// tasks.js
// タスク管理（締切なし・優先度付き）のメインロジック
// ===================================================

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : d.toLocaleString("ja-JP");
}

// 優先度を並び替え用の数値に変換する（高いほど小さい数字＝先頭）
function priorityOrder(p) {
    if (p === "高") return 0;
    if (p === "中") return 1;
    return 2;
}

// 優先度に応じたバッジのCSSクラスを返す
function priorityClass(p) {
    if (p === "高") return "high";
    if (p === "中") return "mid";
    return "low";
}

// localStorageから未完了タスクを取得する
function getTodoTasks() {
    try {
        const raw = JSON.parse(localStorage.getItem("todoTasks"));
        return Array.isArray(raw) ? raw.filter(t => t && typeof t === "object") : [];
    } catch (e) {
        return [];
    }
}

// localStorageから完了済みタスクを取得する
function getTodoCompleted() {
    try {
        const raw = JSON.parse(localStorage.getItem("todoCompleted"));
        return Array.isArray(raw) ? raw.filter(t => t && typeof t === "object") : [];
    } catch (e) {
        return [];
    }
}

// localStorageから削除済みタスクを取得する
function getTodoDeleted() {
    try {
        const raw = JSON.parse(localStorage.getItem("todoDeleted"));
        return Array.isArray(raw) ? raw.filter(t => t && typeof t === "object") : [];
    } catch (e) {
        return [];
    }
}

// 未完了タスクをlocalStorageに保存する
function saveTodoTasks(tasks) {
    localStorage.setItem("todoTasks", JSON.stringify(tasks));
}

// 完了済みタスクをlocalStorageに保存する
function saveTodoCompleted(tasks) {
    localStorage.setItem("todoCompleted", JSON.stringify(tasks));
}

// 削除済みタスクをlocalStorageに保存する
function saveTodoDeleted(tasks) {
    localStorage.setItem("todoDeleted", JSON.stringify(tasks));
}

// 「追加」ボタンのイベント初期化
function initAddButton() {
    const btn = document.getElementById("add-button");
    if (btn && !btn.dataset.initialized) {
        btn.dataset.initialized = "true";
        btn.addEventListener("click", () => {
            window.location.href = "./add-task.html";
        });
    }
}

// ページ読み込み時に一覧を表示する
window.addEventListener("load", () => {
    initAddButton();
    purgeOldDeletedTodoTasks();
    renderTasks();
    renderCompletedTasks();
    renderDeletedTasks();
});

document.addEventListener("DOMContentLoaded", () => {
    initAddButton();
});

// クラウド同期後に db-sync.js から呼び出されるグローバル再描画関数
window.renderTodoAll = function () {
    renderTasks();
    renderCompletedTasks();
    renderDeletedTasks();
};

// 未完了タスクを画面に表示する
function renderTasks() {
    const tasks = getTodoTasks();
    const list = document.getElementById("task-list");
    if (!list) return;

    // 優先度が高い順に並び替える
    tasks.sort((a, b) => priorityOrder(a ? a.priority : "") - priorityOrder(b ? b.priority : ""));

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>未完了のタスクはありません</p>";
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        const div = document.createElement("div");
        div.className = "card";

        const contentStr = escapeHtml(task.content || "");
        const prioStr = task.priority || "中";
        const createdStr = formatDate(task.createdAt);

        div.innerHTML = `
            <p>${contentStr}
                <span class="priority-badge ${priorityClass(prioStr)}">優先度：${prioStr}</span>
            </p>
            ${createdStr ? `<p>作成日：${createdStr}</p>` : ""}
            ${task.detail ? `<p>詳細：${escapeHtml(task.detail).replace(/\n/g, "<br>")}</p>` : ""}

            <button class="task-complete-btn" data-id="${task.id}">達成</button>
            <button class="task-edit-btn" data-id="${task.id}">編集</button>
            <button class="task-delete-btn" data-id="${task.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// 完了済みタスクを画面に表示する
function renderCompletedTasks() {
    const tasks = getTodoCompleted();
    const list = document.getElementById("task-completed-list");
    if (!list) return;

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>完了済みのタスクはありません</p>";
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        const div = document.createElement("div");
        div.className = "card";

        const contentStr = escapeHtml(task.content || "");
        const prioStr = task.priority || "中";
        const createdStr = formatDate(task.createdAt);
        const completedStr = formatDate(task.completedAt);

        div.innerHTML = `
            <p>${contentStr}
                <span class="priority-badge ${priorityClass(prioStr)}">優先度：${prioStr}</span>
            </p>
            ${createdStr ? `<p>作成日：${createdStr}</p>` : ""}
            ${completedStr ? `<p>完了：${completedStr}</p>` : ""}
            ${task.detail ? `<p>詳細：${escapeHtml(task.detail).replace(/\n/g, "<br>")}</p>` : ""}

            <button class="task-delete-completed-btn" data-id="${task.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// 削除済みタスクを表示する
function renderDeletedTasks() {
    const tasks = getTodoDeleted();
    const list = document.getElementById("task-deleted-list");
    if (!list) return;

    // 削除が新しい順にソート
    tasks.sort((a, b) => {
        const da = a && a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const db = b && b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return db - da;
    });

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>削除済みのタスクはありません</p>";
        return;
    }

    tasks.forEach(task => {
        if (!task) return;
        const div = document.createElement("div");
        div.className = "card";

        // 自動完全削除までの残り日数を計算
        let remainingDays = 90;
        if (task.deletedAt) {
            const purgeDate = new Date(task.deletedAt);
            if (!isNaN(purgeDate.getTime())) {
                purgeDate.setMonth(purgeDate.getMonth() + 3);
                remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));
            }
        }

        const contentStr = escapeHtml(task.content || "");
        const prioStr = task.priority || "中";
        const createdStr = formatDate(task.createdAt);
        const completedStr = formatDate(task.completedAt);
        const deletedStr = formatDate(task.deletedAt);

        div.innerHTML = `
            <p>${contentStr}
                <span class="priority-badge ${priorityClass(prioStr)}">優先度：${prioStr}</span>
            </p>
            ${createdStr ? `<p>作成日：${createdStr}</p>` : ""}
            ${completedStr ? `<p>完了日：${completedStr}</p>` : ""}
            ${deletedStr ? `<p>削除：${deletedStr}</p>` : ""}
            <p>あと${remainingDays}日で自動的に完全削除されます</p>
            ${task.detail ? `<p>詳細：${escapeHtml(task.detail).replace(/\n/g, "<br>")}</p>` : ""}

            <button class="task-restore-btn" data-id="${task.id}">元に戻す</button>
            <button class="task-delete-forever-btn" data-id="${task.id}">完全に削除</button>
        `;

        list.appendChild(div);
    });
}

// ボタン操作（編集・削除・完了）をまとめて処理する
document.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("task-delete-btn")) {
        deleteTodoTask(id);
    }

    if (btn.classList.contains("task-edit-btn")) {
        window.location.href = `add-task.html?id=${id}`;
    }

    if (btn.classList.contains("task-complete-btn")) {
        completeTodoTask(id);
    }

    if (btn.classList.contains("task-delete-completed-btn")) {
        deleteTodoCompleted(id);
    }

    if (btn.classList.contains("task-restore-btn")) {
        restoreTodoTask(id);
    }

    if (btn.classList.contains("task-delete-forever-btn")) {
        deleteTodoForever(id);
    }
});

// タスクを完了扱いにする
function completeTodoTask(id) {
    let tasks = getTodoTasks();
    let completed = getTodoCompleted();

    const kadai = tasks.findIndex(t => t && t.id == id);
    if (kadai === -1) return;

    const task = tasks.splice(kadai, 1)[0];
    task.completedAt = new Date().toISOString();

    completed.push(task);

    saveTodoTasks(tasks);
    saveTodoCompleted(completed);

    renderTasks();
    renderCompletedTasks();
}

// 未完了タスクを削除（一時保存）する
function deleteTodoTask(id) {
    let tasks = getTodoTasks();
    let deleted = getTodoDeleted();

    const idx = tasks.findIndex(t => t && t.id == id);
    if (idx === -1) return;

    const task = tasks.splice(idx, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "todoTasks";

    deleted.push(task);

    saveTodoTasks(tasks);
    saveTodoDeleted(deleted);

    renderTasks();
    renderDeletedTasks();
}

// 完了済みタスクを削除（一時保存）する
function deleteTodoCompleted(id) {
    let tasks = getTodoCompleted();
    let deleted = getTodoDeleted();

    const idx = tasks.findIndex(t => t && t.id == id);
    if (idx === -1) return;

    const task = tasks.splice(idx, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "todoCompleted";

    deleted.push(task);

    saveTodoCompleted(tasks);
    saveTodoDeleted(deleted);

    renderCompletedTasks();
    renderDeletedTasks();
}

// 削除済みタスクを元に戻す
function restoreTodoTask(id) {
    let deleted = getTodoDeleted();

    const idx = deleted.findIndex(t => t && t.id == id);
    if (idx === -1) return;

    const task = deleted.splice(idx, 1)[0];
    const from = task.from;
    delete task.deletedAt;
    delete task.from;

    if (from === "todoCompleted") {
        let completed = getTodoCompleted();
        completed.push(task);
        saveTodoCompleted(completed);
        renderCompletedTasks();
    } else {
        let tasks = getTodoTasks();
        tasks.push(task);
        saveTodoTasks(tasks);
        renderTasks();
    }

    saveTodoDeleted(deleted);
    renderDeletedTasks();
}

// 削除から3ヶ月経過したタスクを自動的に完全削除する
function purgeOldDeletedTodoTasks() {
    let deleted = getTodoDeleted();
    const now = new Date();
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - 3);

    const remaining = deleted.filter(t => t && t.deletedAt && new Date(t.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveTodoDeleted(remaining);
    }
}

// 削除済みタスクを完全に削除する
function deleteTodoForever(id) {
    if (!confirm("このタスクを完全に削除します。元に戻せませんがよろしいですか？")) return;

    let deleted = getTodoDeleted();
    deleted = deleted.filter(t => t && t.id != id);

    saveTodoDeleted(deleted);
    renderDeletedTasks();
}
