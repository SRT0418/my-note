// 「追加」ボタンを押したときに課題追加画面へ遷移する
document.getElementById("add-button").addEventListener("click", () => {
    window.location.href = "./add-kadai.html";
});

// ページ読み込み時に課題一覧・完了一覧・件数を表示する
window.addEventListener("load", () => {
    renderToday();
    purgeOldDeletedTasks();
    archiveFinishedDeadlineWeeks();
    renderTasks();
    renderCompletedTasks();
    renderDeletedTasks();
    updateCounts();
});

// 今日の日付を見出しに表示する
function renderToday() {
    const el = document.getElementById("today-date");
    if (!el) return;

    const today = new Date();
    el.textContent = today.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// localStorageから未完了課題を取得する
function getTasks() {
    return JSON.parse(localStorage.getItem("tasks")) || [];
}

// localStorageから完了課題を取得する
function getCompletedTasks() {
    return JSON.parse(localStorage.getItem("completedTasks")) || [];
}

// 未完了課題をlocalStorageに保存する
function saveTasks(tasks) {
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

// 完了課題をlocalStorageに保存する
function saveCompleted(tasks) {
    localStorage.setItem("completedTasks", JSON.stringify(tasks));
}

// localStorageから削除済み課題を取得する
function getDeletedTasks() {
    return JSON.parse(localStorage.getItem("deletedTasks")) || [];
}

// 削除済み課題をlocalStorageに保存する
function saveDeleted(tasks) {
    localStorage.setItem("deletedTasks", JSON.stringify(tasks));
}

// 未完了課題を画面に表示する
function renderTasks() {

    const tasks = getTasks();
    const list = document.getElementById("unfinished-list");

    // 締切が近い順に並び替える
    tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>未完了の課題はありません</p>";
        return;
    }

    tasks.forEach(task => {
        const now = new Date();
        const deadline = new Date(task.deadline);

        // 締切までの残り日数を計算
        const remainingDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

        const div = document.createElement("div");
        div.className = "card";

        // 期限切れの場合は赤色表示
        if (remainingDays < 0) div.style.color = "red";

        div.innerHTML = `
            <p>科目：${task.subject}</p>
            <p>課題：${task.title}</p>
            <p>締切：${deadline.toLocaleString("ja-JP")}</p>
            <p>残り：${remainingDays < 0 ? "期限切れ" : `残り${remainingDays}日`}</p>

            <button class="edit-btn" data-id="${task.id}">編集</button>
            <button class="delete-btn" data-id="${task.id}">削除</button>
            ${remainingDays >= 0 ? `<button class="complete-btn" data-id="${task.id}">完了</button>` : ""}
        `;

        list.appendChild(div);
    });
}

// 完了済み課題を画面に表示する
function renderCompletedTasks() {

    const tasks = getCompletedTasks();
    const list = document.getElementById("completed-list");

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>完了済みの課題はありません</p>";
        return;
    }

    tasks.forEach(task => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p>科目：${task.subject}</p>
            <p>課題：${task.title}</p>
            <p>締切：${new Date(task.deadline).toLocaleString("ja-JP")}</p>
            <p>完了：${new Date(task.completedAt).toLocaleString("ja-JP")}</p>

            <button class="delete-completed-btn" data-id="${task.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// 削除済み課題を画面に表示する
function renderDeletedTasks() {

    const tasks = getDeletedTasks();
    const list = document.getElementById("deleted-list");

    // 削除が新しい順に並び替える
    tasks.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    list.innerHTML = "";

    if (tasks.length === 0) {
        list.innerHTML = "<p>削除済みの課題はありません</p>";
        return;
    }

    tasks.forEach(task => {

        const div = document.createElement("div");
        div.className = "card";

        // 自動完全削除までの残り日数（削除から3ヶ月後）を計算
        const purgeDate = new Date(task.deletedAt);
        purgeDate.setMonth(purgeDate.getMonth() + 3);
        const remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));

        div.innerHTML = `
            <p>科目：${task.subject}</p>
            <p>課題：${task.title}</p>
            <p>締切：${new Date(task.deadline).toLocaleString("ja-JP")}</p>
            <p>削除：${new Date(task.deletedAt).toLocaleString("ja-JP")}</p>
            <p>あと${remainingDays}日で自動的に完全削除されます</p>

            <button class="restore-btn" data-id="${task.id}">元に戻す</button>
            <button class="delete-forever-btn" data-id="${task.id}">完全に削除</button>
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

    if (btn.classList.contains("delete-btn")) {
        deleteTask(id);
    }

    if (btn.classList.contains("edit-btn")) {
        editTask(id);
    }

    if (btn.classList.contains("complete-btn")) {
        completeTask(id);
    }

    if (btn.classList.contains("delete-completed-btn")) {
        deleteCompletedTask(id);
    }

    if (btn.classList.contains("restore-btn")) {
        restoreTask(id);
    }

    if (btn.classList.contains("delete-forever-btn")) {
        deleteForever(id);
    }
});

// 課題を完了扱いにして未完了から削除する
function completeTask(id) {

    let tasks = getTasks();
    let completed = getCompletedTasks();

    const kadai = tasks.findIndex(t => t.id == id);
    if (kadai === -1) return;

    const task = tasks.splice(kadai, 1)[0];
    task.completedAt = new Date().toISOString();

    completed.push(task);

    saveTasks(tasks);
    saveCompleted(completed);

    renderTasks();
    renderCompletedTasks();
    updateCounts();
}

// 未完了課題を削除し、削除済み一覧に退避する
function deleteTask(id) {

    let tasks = getTasks();
    let deleted = getDeletedTasks();

    const kadai = tasks.findIndex(t => t.id == id);
    if (kadai === -1) return;

    const task = tasks.splice(kadai, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "tasks";

    deleted.push(task);

    saveTasks(tasks);
    saveDeleted(deleted);

    renderTasks();
    renderDeletedTasks();
    updateCounts();
}


// 完了済み課題を削除し、削除済み一覧に退避する
function deleteCompletedTask(id) {

    let tasks = getCompletedTasks();
    let deleted = getDeletedTasks();

    const kadai = tasks.findIndex(t => t.id == id);
    if (kadai === -1) return;

    const task = tasks.splice(kadai, 1)[0];
    task.deletedAt = new Date().toISOString();
    task.from = "completed";

    deleted.push(task);

    saveCompleted(tasks);
    saveDeleted(deleted);

    renderCompletedTasks();
    renderDeletedTasks();
    updateCounts();
}

// 削除済み課題を元の一覧（未完了 or 完了済み）に戻す
function restoreTask(id) {

    let deleted = getDeletedTasks();

    const kadai = deleted.findIndex(t => t.id == id);
    if (kadai === -1) return;

    const task = deleted.splice(kadai, 1)[0];
    const from = task.from;
    delete task.deletedAt;
    delete task.from;

    if (from === "completed") {
        let completed = getCompletedTasks();
        completed.push(task);
        saveCompleted(completed);
        renderCompletedTasks();
    } else {
        let tasks = getTasks();
        tasks.push(task);
        saveTasks(tasks);
        renderTasks();
    }

    saveDeleted(deleted);
    renderDeletedTasks();
    updateCounts();
}

// 削除から3ヶ月経過した課題を自動的に完全削除する
function purgeOldDeletedTasks() {

    let deleted = getDeletedTasks();
    const now = new Date();

    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - 3);

    const remaining = deleted.filter(t => new Date(t.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveDeleted(remaining);
    }
}

// 週の月曜日0時を返す（週の識別キーとして使用）
function getWeekKey(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=日, 1=月 ...
    const diff = (day === 0) ? -6 : 1 - day; // 月曜日にそろえる
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);

    // toISOString()はUTCに変換されるため、日本時間の深夜0時が
    // 前日の日付になってしまう。ローカル日付をそのまま文字列化する。
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day2 = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day2}`; // 例: "2026-06-30"
}

// 締切の週（月曜〜日曜）が終わった課題を、未達成・達成済みを問わず
// 一覧から片付けて、週次履歴（weeklyHistory）にまとめる。
// ・週の判定は課題自身の締切日（deadline）基準。いつアプリを開いたかには左右されない
// ・締切が今週または未来の課題はそのまま一覧に残る
// ・履歴には「週の日付」「達成率」「未達成課題数」「達成済み課題数」に加えて
//   科目・課題名の一覧も保存する
function archiveFinishedDeadlineWeeks() {

    const now = new Date();
    const currentWeekKey = getWeekKey(now);

    const tasks = getTasks();
    const completed = getCompletedTasks();

    const remainingTasks = [];
    const remainingCompleted = [];

    // weekKey ごとに、今回新たに確定した課題をまとめるための入れ物
    const buckets = {};
    function getBucket(weekKey) {
        if (!buckets[weekKey]) buckets[weekKey] = { unfinished: [], completed: [] };
        return buckets[weekKey];
    }

    // 未完了課題：締切の週が終わっていれば「未達成」として確定
    tasks.forEach(t => {
        if (!t || !t.deadline || isNaN(new Date(t.deadline).getTime())) {
            remainingTasks.push(t);
            return;
        }
        const wk = getWeekKey(t.deadline);
        if (wk < currentWeekKey) {
            getBucket(wk).unfinished.push({ subject: t.subject, title: t.title });
        } else {
            remainingTasks.push(t);
        }
    });

    // 完了済み課題：締切の週が終わっていれば「達成済み」として確定
    completed.forEach(t => {
        if (!t || !t.deadline || isNaN(new Date(t.deadline).getTime())) {
            remainingCompleted.push(t);
            return;
        }
        const wk = getWeekKey(t.deadline);
        if (wk < currentWeekKey) {
            getBucket(wk).completed.push({ subject: t.subject, title: t.title });
        } else {
            remainingCompleted.push(t);
        }
    });

    const weekKeys = Object.keys(buckets);
    if (weekKeys.length === 0) return; // 確定すべき週が無ければ何もしない

    const history = JSON.parse(localStorage.getItem("weeklyHistory")) || [];

    weekKeys.forEach(wk => {
        const bucket = buckets[wk];

        const weekStart = new Date(wk);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} 〜 ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

        let entry = history.find(h => h.weekKey === wk);
        if (!entry) {
            entry = { weekKey: wk, weekLabel, unfinishedList: [], completedList: [] };
            history.push(entry);
        }

        entry.unfinishedList = (entry.unfinishedList || []).concat(bucket.unfinished);
        entry.completedList = (entry.completedList || []).concat(bucket.completed);

        entry.unfinishedCount = entry.unfinishedList.length;
        entry.completedCount = entry.completedList.length;

        const total = entry.unfinishedCount + entry.completedCount;
        entry.rate = total === 0 ? 0 : Math.round((entry.completedCount / total) * 100);
    });

    // 新しい週が上に来るように並び替え
    history.sort((a, b) => new Date(b.weekKey) - new Date(a.weekKey));

    localStorage.setItem("weeklyHistory", JSON.stringify(history));
    saveTasks(remainingTasks);
    saveCompleted(remainingCompleted);
}

// 削除済み課題を完全に削除する（復元不可）
function deleteForever(id) {

    if (!confirm("この課題を完全に削除します。元に戻せませんがよろしいですか？")) return;

    let deleted = getDeletedTasks();
    deleted = deleted.filter(t => t.id != id);

    saveDeleted(deleted);
    renderDeletedTasks();
}

// 課題数（未完了・完了・期限切れ）を更新する
function updateCounts() {

    const tasks = getTasks();
    const completed = getCompletedTasks();
    const now = new Date();

    const unfinished = tasks.filter(t => new Date(t.deadline) >= now);
    const overdue = tasks.filter(t => new Date(t.deadline) < now);

    document.getElementById("unfinished-count").textContent = unfinished.length;
    document.getElementById("completed-count").textContent = completed.length;
    document.getElementById("overdue-count").textContent = overdue.length;
}

// 編集画面へ移動する
function editTask(id) {
    window.location.href = `add-kadai.html?id=${id}`;
}