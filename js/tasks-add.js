window.addEventListener("load", () => {

    const params = new URLSearchParams(location.search);
    const editId = params.get("id");

    let tasks = JSON.parse(localStorage.getItem("todoTasks")) || [];

    // 編集モードの場合、該当データをフォームに表示する
    if (editId) {

        const task = tasks.find(t => t.id == editId);

        if (task) {
            document.getElementById("content").value = task.content || "";
            document.getElementById("priority").value = task.priority || "中";
            const detailEl = document.getElementById("detail");
            if (detailEl) detailEl.value = task.detail || "";

            document.getElementById("save-button").textContent = "更新";
            document.getElementById("save-button").dataset.editId = editId;
        }
    }

    // 保存ボタン：新規追加 or 編集更新を切り替える
    document.getElementById("save-button").addEventListener("click", () => {

        let tasks = JSON.parse(localStorage.getItem("todoTasks")) || [];
        const editId = document.getElementById("save-button").dataset.editId;

        const content = document.getElementById("content").value.trim();
        const priority = document.getElementById("priority").value;
        const detailEl = document.getElementById("detail");
        const detail = detailEl ? detailEl.value : "";

        // 入力チェック：内容が未入力なら保存しない
        if (!content) {
            alert("内容を入力してください。");
            return;
        }

        const existingTask = editId ? tasks.find(t => t.id == editId) : null;

        const taskData = {
            id: editId ? Number(editId) : Date.now(),
            content: content,
            priority: priority,
            detail: detail,
            createdAt: (existingTask && existingTask.createdAt) || new Date().toISOString()
        };

        if (editId) {
            const kadai = tasks.findIndex(t => t.id == editId);
            if (kadai !== -1) tasks[kadai] = taskData;
        } else {
            tasks.push(taskData);
        }

        localStorage.setItem("todoTasks", JSON.stringify(tasks));
        location.href = "tasks.html";
    });

    // キャンセルボタン：一覧画面へ戻る
    document.getElementById("cancel-button").addEventListener("click", () => {
        location.href = "tasks.html";
    });
});
