function initAddTaskForm() {
    const saveBtn = document.getElementById("save-button");
    const cancelBtn = document.getElementById("cancel-button");

    if (!saveBtn || saveBtn.dataset.initialized) return;
    saveBtn.dataset.initialized = "true";

    const params = new URLSearchParams(location.search);
    const editId = params.get("id");

    let tasks = [];
    try {
        const raw = JSON.parse(localStorage.getItem("todoTasks"));
        tasks = Array.isArray(raw) ? raw.filter(t => t && typeof t === "object") : [];
    } catch (e) {
        tasks = [];
    }

    // 編集モードの場合、該当データをフォームに表示する
    if (editId) {
        const task = tasks.find(t => t && t.id == editId);

        if (task) {
            const contentEl = document.getElementById("content");
            const priorityEl = document.getElementById("priority");
            const detailEl = document.getElementById("detail");

            if (contentEl) contentEl.value = task.content || "";
            if (priorityEl) priorityEl.value = task.priority || "中";
            if (detailEl) detailEl.value = task.detail || "";

            saveBtn.textContent = "更新";
            saveBtn.dataset.editId = editId;
        }
    }

    // 保存ボタン：新規追加 or 編集更新を切り替える
    saveBtn.addEventListener("click", async () => {
        let currentTasks = [];
        try {
            const raw = JSON.parse(localStorage.getItem("todoTasks"));
            currentTasks = Array.isArray(raw) ? raw.filter(t => t && typeof t === "object") : [];
        } catch (e) {
            currentTasks = [];
        }

        const currentEditId = saveBtn.dataset.editId;
        const contentEl = document.getElementById("content");
        const priorityEl = document.getElementById("priority");
        const detailEl = document.getElementById("detail");

        const content = contentEl ? contentEl.value.trim() : "";
        const priority = priorityEl ? priorityEl.value : "中";
        const detail = detailEl ? detailEl.value : "";

        // 入力チェック：内容が未入力なら保存しない
        if (!content) {
            alert("内容を入力してください。");
            return;
        }

        const existingTask = currentEditId ? currentTasks.find(t => t && t.id == currentEditId) : null;

        const taskData = {
            id: currentEditId ? (isNaN(currentEditId) ? currentEditId : Number(currentEditId)) : Date.now(),
            content: content,
            priority: priority,
            detail: detail,
            createdAt: (existingTask && existingTask.createdAt) || new Date().toISOString()
        };

        if (currentEditId) {
            const idx = currentTasks.findIndex(t => t && t.id == currentEditId);
            if (idx !== -1) {
                currentTasks[idx] = taskData;
            } else {
                currentTasks.push(taskData);
            }
        } else {
            currentTasks.push(taskData);
        }

        localStorage.setItem("todoTasks", JSON.stringify(currentTasks));
        if (window.MyNoteDBSync && typeof window.MyNoteDBSync.flushSync === "function") {
            await window.MyNoteDBSync.flushSync("todoTasks");
        }
        location.href = "tasks.html";
    });

    // キャンセルボタン：一覧画面へ戻る
    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            location.href = "tasks.html";
        });
    }
}

document.addEventListener("DOMContentLoaded", initAddTaskForm);
window.addEventListener("load", initAddTaskForm);
