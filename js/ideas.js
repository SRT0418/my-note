document.getElementById("add-button").addEventListener("click", () => {
    window.location.href = "./add-idea.html";
});

window.addEventListener("load", () => {
    purgeOldDeletedIdeas();
    renderIdeas();
    renderAchievedIdeas();
    renderDeletedIdeas();
});

function getIdeas() {
    return JSON.parse(localStorage.getItem("ideaItems")) || [];
}

function saveIdeas(items) {
    localStorage.setItem("ideaItems", JSON.stringify(items));
}

function getIdeaDeleted() {
    return JSON.parse(localStorage.getItem("ideaDeleted")) || [];
}

function saveIdeaDeleted(items) {
    localStorage.setItem("ideaDeleted", JSON.stringify(items));
}

// 保存済みアイデア（未達成）を表示する
function renderIdeas() {

    const items = getIdeas().filter(i => !i.achieved);

    const list = document.getElementById("idea-list");
    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = "<p>保存されたアイデアはありません</p>";
        return;
    }

    items.forEach(item => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p><strong>${item.title}</strong></p>
            <p>${item.content}</p>
            ${item.detail ? `<p>${item.detail}</p>` : ""}
            <p>作成日：${new Date(item.createdAt).toLocaleString("ja-JP")}</p>

            <button class="idea-achieve-btn" data-id="${item.id}">達成にする</button>
            <button class="idea-edit-btn" data-id="${item.id}">編集</button>
            <button class="idea-delete-btn" data-id="${item.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// 達成済みアイデアを表示する
function renderAchievedIdeas() {

    const items = getIdeas().filter(i => i.achieved);

    const list = document.getElementById("idea-achieved-list");
    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = "<p>達成済みのアイデアはありません</p>";
        return;
    }

    items.forEach(item => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p><strong>${item.title}</strong></p>
            <p>${item.content}</p>
            ${item.detail ? `<p>${item.detail}</p>` : ""}
            <p>作成日：${new Date(item.createdAt).toLocaleString("ja-JP")}</p>
            <p>達成：${new Date(item.achievedAt).toLocaleString("ja-JP")}</p>

            <button class="idea-unachieve-btn" data-id="${item.id}">未達成に戻す</button>
            <button class="idea-delete-btn" data-id="${item.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

document.addEventListener("click", e => {

    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("idea-achieve-btn")) {
        setIdeaAchieved(id, true);
    }

    if (btn.classList.contains("idea-unachieve-btn")) {
        setIdeaAchieved(id, false);
    }

    if (btn.classList.contains("idea-delete-btn")) {
        deleteIdea(id);
    }

    if (btn.classList.contains("idea-edit-btn")) {
        window.location.href = `add-idea.html?id=${id}`;
    }

    if (btn.classList.contains("idea-restore-btn")) {
        restoreIdea(id);
    }

    if (btn.classList.contains("idea-delete-forever-btn")) {
        deleteIdeaForever(id);
    }
});

// 達成／未達成を切り替える
function setIdeaAchieved(id, achieved) {

    let items = getIdeas();
    const item = items.find(i => i.id == id);
    if (!item) return;

    item.achieved = achieved;
    item.achievedAt = achieved ? new Date().toISOString() : null;

    saveIdeas(items);
    renderIdeas();
    renderAchievedIdeas();
}

// アイデアを削除（一時保存）する
function deleteIdea(id) {

    let items = getIdeas();
    let deleted = getIdeaDeleted();

    const idx = items.findIndex(i => i.id == id);
    if (idx === -1) return;

    const item = items.splice(idx, 1)[0];
    item.deletedAt = new Date().toISOString();

    deleted.push(item);

    saveIdeas(items);
    saveIdeaDeleted(deleted);

    renderIdeas();
    renderAchievedIdeas();
    renderDeletedIdeas();
}

// 削除されたアイデアを元に戻す
function restoreIdea(id) {

    let deleted = getIdeaDeleted();
    let items = getIdeas();

    const idx = deleted.findIndex(i => i.id == id);
    if (idx === -1) return;

    const item = deleted.splice(idx, 1)[0];
    delete item.deletedAt;

    items.push(item);

    saveIdeas(items);
    saveIdeaDeleted(deleted);

    renderIdeas();
    renderAchievedIdeas();
    renderDeletedIdeas();
}

// 削除から3ヶ月経過したアイデアを自動的に完全削除する
function purgeOldDeletedIdeas() {

    let deleted = getIdeaDeleted();
    const now = new Date();
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - 3);

    const remaining = deleted.filter(i => new Date(i.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveIdeaDeleted(remaining);
    }
}

// アイデアを完全に削除する
function deleteIdeaForever(id) {

    if (!confirm("このアイデアを完全に削除します。元に戻せませんがよろしいですか？")) return;

    let deleted = getIdeaDeleted();
    deleted = deleted.filter(i => i.id != id);

    saveIdeaDeleted(deleted);
    renderDeletedIdeas();
}

// 削除済みアイデアを表示する
function renderDeletedIdeas() {

    const items = getIdeaDeleted();
    const list = document.getElementById("idea-deleted-list");

    // 削除が新しい順にソート
    items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = "<p>削除済みのアイデアはありません</p>";
        return;
    }

    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "card";

        // 自動完全削除までの残り日数を計算
        const purgeDate = new Date(item.deletedAt);
        purgeDate.setMonth(purgeDate.getMonth() + 3);
        const remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));

        div.innerHTML = `
            <p><strong>${item.title}</strong></p>
            <p>${item.content}</p>
            ${item.detail ? `<p>${item.detail}</p>` : ""}
            <p>作成日：${new Date(item.createdAt).toLocaleString("ja-JP")}</p>
            <p>削除：${new Date(item.deletedAt).toLocaleString("ja-JP")}</p>
            <p>あと${remainingDays}日で自動的に完全削除されます</p>

            <button class="idea-restore-btn" data-id="${item.id}">元に戻す</button>
            <button class="idea-delete-forever-btn" data-id="${item.id}">完全に削除</button>
        `;

        list.appendChild(div);
    });
}
