// ページ読み込み時に編集モードかどうかを判定する
window.addEventListener("load", () => {

    const params = new URLSearchParams(location.search);
    const editId = params.get("id");

    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

    // 編集モードの場合、該当データをフォームに表示する
    if (editId) {

        const task = tasks.find(t => t.id == editId);

        if (task) {
            document.getElementById("subject").value = task.subject || "";
            document.getElementById("title").value = task.title || "";
            document.getElementById("deadline").value = task.deadline || "";
            const detailEl = document.getElementById("detail");
            if (detailEl) detailEl.value = task.detail || "";

            document.getElementById("save-button").textContent = "更新";
            document.getElementById("save-button").dataset.editId = editId;
        }
    }

    // 保存ボタン：新規追加 or 編集更新を切り替える
    document.getElementById("save-button").addEventListener("click", () => {

        let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        const editId = document.getElementById("save-button").dataset.editId;

        const subject = document.getElementById("subject").value.trim();
        const title = document.getElementById("title").value.trim();
        const deadline = document.getElementById("deadline").value;
        const detailEl = document.getElementById("detail");
        const detail = detailEl ? detailEl.value : "";

        // 入力チェック：未入力や不正な日時があれば保存せず知らせる
        if (!subject || !title || !deadline) {
            alert("科目名・課題名・締切をすべて入力してください。");
            return;
        }

        if (isNaN(new Date(deadline).getTime())) {
            alert("締切の日時が正しくありません。");
            return;
        }

        // 入力内容から課題データを作成
        const taskData = {
            id: editId ? Number(editId) : Date.now(),
            subject: subject,
            title: title,
            deadline: deadline,
            detail: detail
        };

        // 編集か新規かで処理を分岐
        if (editId) {
            const kadai = tasks.findIndex(t => t.id == editId);
            if (kadai !== -1) tasks[kadai] = taskData;
        } else {
            tasks.push(taskData);
        }

        // localStorageに保存して一覧画面へ戻る
        localStorage.setItem("tasks", JSON.stringify(tasks));
        location.href = "kadai.html";
    });

    // キャンセルボタン：一覧画面へ戻る
    document.getElementById("cancel-button").addEventListener("click", () => {
        location.href = "kadai.html";
    });
});