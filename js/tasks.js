// 「追加」ボタンを押したときにタスク追加画面へ遷移する
document.getElementById("add-button").addEventListener("click", () => {
    window.location.href = "./add-task.html";
});

// ページ読み込み時に一覧を表示する
window.addEventListener("load", () => {
    purgeOldDeletedTodoTasks();
    renderTasks();
    renderCompletedTasks();
    renderDeletedTasks();
});

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
    return JSON.parse(localStorage.getItem("todoTasks")) || [];
}

// localStorageから完了済みタスクを取得する
function getTodoCompleted() {
    return JSON.parse(localStorage.getItem("todoCompleted")) || [];
}

// 未完了タスクをlocalStorageに保存する
function saveTodoTasks(tasks) {
    localStorage.setItem("todoTasks", JSON.stringify(tasks));
}

// 完了済みタスクをlocalStorageに保存する
function saveTodoCompleted(tasks) {
    localStorage.setItem("todoCompleted", JSON.stringify(tasks));
}

// localStorageから削除済みタスクを取得する
function getTodoDeleted() {
    return JSON.parse(localStorage.getItem("todoDeleted")) || [];
}

// 削除済みタスクをlocalStorageに保存する
function saveTodoDeleted(tasks) {
    localStorage.setItem("todoDeleted", JSON.stringify(tasks));
}

// 未完了タスクを画面に表示する
function renderTasks() {

    const tasks = getTodoTasks();
    const list = document.getElementById("task-list");

    // 優先度が高い順に並び替える
    tasks.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>未完了のタスクはありません</p>";
        return;
    }

    tasks.forEach(task => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p>${task.content}
                <span class="priority-badge ${priorityClass(task.priority)}">優先度：${task.priority}</span>
            </p>
            <p>作成日：${new Date(task.createdAt).toLocaleString("ja-JP")}</p>

            <button class="task-edit-btn" data-id="${task.id}">編集</button>
            <button class="task-delete-btn" data-id="${task.id}">削除</button>
            <button class="task-complete-btn" data-id="${task.id}">完了</button>
        `;

        list.appendChild(div);
    });
}

// 完了済みタスクを画面に表示する
function renderCompletedTasks() {

    const tasks = getTodoCompleted();
    const list = document.getElementById("task-completed-list");

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>完了済みのタスクはありません</p>";
        return;
    }

    tasks.forEach(task => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p>${task.content}
                <span class="priority-badge ${priorityClass(task.priority)}">優先度：${task.priority}</span>
            </p>
            <p>作成日：${new Date(task.createdAt).toLocaleString("ja-JP")}</p>
            <p>完了：${new Date(task.completedAt).toLocaleString("ja-JP")}</p>

            <button class="task-delete-completed-btn" data-id="${task.id}">削除</button>
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

    const kadai = tasks.findIndex(t => t.id == id);
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

    const idx = tasks.findIndex(t => t.id == id);
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

    const idx = tasks.findIndex(t => t.id == id);
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

    const idx = deleted.findIndex(t => t.id == id);
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

    const remaining = deleted.filter(t => new Date(t.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveTodoDeleted(remaining);
    }
}

// 削除済みタスクを完全に削除する
function deleteTodoForever(id) {

    if (!confirm("このタスクを完全に削除します。元に戻せませんがよろしいですか？")) return;

    let deleted = getTodoDeleted();
    deleted = deleted.filter(t => t.id != id);

    saveTodoDeleted(deleted);
    renderDeletedTasks();
}

// 削除済みタスクを表示する
function renderDeletedTasks() {

    const tasks = getTodoDeleted();
    const list = document.getElementById("task-deleted-list");

    // 削除が新しい順にソート
    tasks.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>削除済みのタスクはありません</p>";
        return;
    }

    tasks.forEach(task => {
        const div = document.createElement("div");
        div.className = "card";

        // 自動完全削除までの残り日数を計算
        const purgeDate = new Date(task.deletedAt);
        purgeDate.setMonth(purgeDate.getMonth() + 3);
        const remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));

        div.innerHTML = `
            <p>${task.content}
                <span class="priority-badge ${priorityClass(task.priority)}">優先度：${task.priority}</span>
            </p>
            <p>作成日：${new Date(task.createdAt).toLocaleString("ja-JP")}</p>
            ${task.completedAt ? `<p>完了日：${new Date(task.completedAt).toLocaleString("ja-JP")}</p>` : ""}
            <p>削除：${new Date(task.deletedAt).toLocaleString("ja-JP")}</p>
            <p>あと${remainingDays}日で自動的に完全削除されます</p>

            <button class="task-restore-btn" data-id="${task.id}">元に戻す</button>
            <button class="task-delete-forever-btn" data-id="${task.id}">完全に削除</button>
        `;

        list.appendChild(div);
    });
}
