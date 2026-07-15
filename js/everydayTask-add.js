// ===================================================
// everydayTask-add.js
// 習慣タスクの追加・編集フォームのロジック
// ===================================================

// URLパラメータから編集対象のIDを取得する
const params = new URLSearchParams(window.location.search);
const editId = params.get("id");

// 編集モードの場合は既存データをフォームに読み込む
if (editId) {
    document.querySelector("h1").textContent = "習慣タスク編集";
    const tasks = JSON.parse(localStorage.getItem("habitTasks")) || [];
    const task = tasks.find(t => t.id == editId);
    if (task) {
        document.getElementById("habit-title").value = task.title || "";
        document.getElementById("habit-detail").value = task.detail || "";
    }
}

// 「保存」ボタン
document.getElementById("save-button").addEventListener("click", () => {
    const title = document.getElementById("habit-title").value.trim();
    const detail = document.getElementById("habit-detail").value.trim();

    if (!title) {
        alert("タイトルを入力してください。");
        return;
    }

    if (editId) {
        // 編集モード：未達成リスト内のタスクを更新する
        let tasks = JSON.parse(localStorage.getItem("habitTasks")) || [];
        const idx = tasks.findIndex(t => t.id == editId);
        if (idx !== -1) {
            tasks[idx].title = title;
            tasks[idx].detail = detail;
            localStorage.setItem("habitTasks", JSON.stringify(tasks));
        }
    } else {
        // 新規追加モード
        const tasks = JSON.parse(localStorage.getItem("habitTasks")) || [];

        const newTask = {
            id: Date.now(),
            title,
            detail,
            createdAt: new Date().toISOString()
        };

        tasks.push(newTask);
        localStorage.setItem("habitTasks", JSON.stringify(tasks));
    }

    window.location.href = "everydayTask.html";
});

// 「キャンセル」ボタン
document.getElementById("cancel-button").addEventListener("click", () => {
    window.location.href = "everydayTask.html";
});
