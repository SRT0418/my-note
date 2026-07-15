document.getElementById("add-button").addEventListener("click", () => {
    window.location.href = "./add-wish.html";
});

window.addEventListener("load", () => {
    purgeOldDeletedWishes();
    setupPartnerFilter();
    renderWishes();
    renderDeletedWishes();
});

// 項目の「相手」を取得する（未設定の場合は自分扱い）
function getPartnerLabel(item) {
    const p = (item && item.partner) ? String(item.partner).trim() : "";
    return p === "" ? "自分" : p;
}

// 相手フィルターのプルダウンを、現在のデータから組み立てる
function setupPartnerFilter() {

    const select = document.getElementById("partner-filter");
    if (!select) return;

    const items = getWishes();
    const deleted = getWishDeleted();

    // 未達成・達成済み・削除済みすべてから相手の一覧を集める（重複なし）
    const partners = Array.from(new Set(
        items.concat(deleted).map(i => getPartnerLabel(i))
    )).sort((a, b) => a.localeCompare(b, "ja"));

    // 前回選択していたフィルターを復元
    const savedFilter = localStorage.getItem("wishPartnerFilter") || "__all__";

    select.innerHTML = `<option value="__all__">全体表示</option>` +
        partners.map(p => `<option value="${p}">${p}</option>`).join("");

    // 保存されていた相手がもう存在しない場合は全体表示に戻す
    select.value = partners.includes(savedFilter) || savedFilter === "__all__" ? savedFilter : "__all__";

    select.addEventListener("change", () => {
        localStorage.setItem("wishPartnerFilter", select.value);
        renderWishes();
        renderDeletedWishes();
    });
}

// 選択中の相手フィルターに応じて配列を絞り込む
function filterByPartner(items) {
    const select = document.getElementById("partner-filter");
    const filter = select ? select.value : "__all__";

    if (!filter || filter === "__all__") return items;

    return items.filter(i => getPartnerLabel(i) === filter);
}

function getWishes() {
    return JSON.parse(localStorage.getItem("wishItems")) || [];
}

function saveWishes(items) {
    localStorage.setItem("wishItems", JSON.stringify(items));
}

function getWishDeleted() {
    return JSON.parse(localStorage.getItem("wishDeleted")) || [];
}

function saveWishDeleted(items) {
    localStorage.setItem("wishDeleted", JSON.stringify(items));
}

// 未達成・達成済みに分けて表示する（相手フィルターを適用）
function renderWishes() {

    const items = filterByPartner(getWishes());
    const unachieved = items.filter(i => !i.achieved);
    const achieved = items.filter(i => i.achieved);

    const list = document.getElementById("wish-list");
    const achievedList = document.getElementById("wish-achieved-list");

    list.innerHTML = unachieved.length === 0 ? "<p>未達成のしたいことはありません</p>" : "";
    achievedList.innerHTML = achieved.length === 0 ? "<p>達成済みのしたいことはありません</p>" : "";

    unachieved.forEach(item => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p><strong>${item.title}</strong>　<span class="wish-partner">相手：${getPartnerLabel(item)}</span></p>
            ${item.content ? `<p>${item.content}</p>` : ""}
            ${item.detail ? `<p>${item.detail}</p>` : ""}
            <p>作成日：${new Date(item.createdAt).toLocaleString("ja-JP")}</p>

            <button class="wish-achieve-btn" data-id="${item.id}">達成</button>
            <button class="wish-edit-btn" data-id="${item.id}">編集</button>
            <button class="wish-delete-btn" data-id="${item.id}">削除</button>
        `;

        list.appendChild(div);
    });

    achieved.forEach(item => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
            <p><strong>${item.title}</strong>　<span class="wish-partner">相手：${getPartnerLabel(item)}</span></p>
            ${item.content ? `<p>${item.content}</p>` : ""}
            ${item.detail ? `<p>${item.detail}</p>` : ""}
            <p>作成日：${new Date(item.createdAt).toLocaleString("ja-JP")}</p>
            <p>達成：${new Date(item.achievedAt).toLocaleString("ja-JP")}</p>

            <button class="wish-unachieve-btn" data-id="${item.id}">未達成に戻す</button>
            <button class="wish-delete-btn" data-id="${item.id}">削除</button>
        `;

        achievedList.appendChild(div);
    });
}

document.addEventListener("click", e => {

    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("wish-achieve-btn")) {
        setAchieved(id, true);
    }

    if (btn.classList.contains("wish-unachieve-btn")) {
        setAchieved(id, false);
    }

    if (btn.classList.contains("wish-delete-btn")) {
        deleteWish(id);
    }

    if (btn.classList.contains("wish-edit-btn")) {
        window.location.href = `add-wish.html?id=${id}`;
    }

    if (btn.classList.contains("wish-restore-btn")) {
        restoreWish(id);
    }

    if (btn.classList.contains("wish-delete-forever-btn")) {
        deleteWishForever(id);
    }
});

// 達成／未達成を切り替える
function setAchieved(id, achieved) {

    let items = getWishes();
    const item = items.find(i => i.id == id);
    if (!item) return;

    item.achieved = achieved;
    item.achievedAt = achieved ? new Date().toISOString() : null;

    saveWishes(items);
    renderWishes();
}

// したいことを削除（一時保存）する
function deleteWish(id) {

    let items = getWishes();
    let deleted = getWishDeleted();

    const idx = items.findIndex(i => i.id == id);
    if (idx === -1) return;

    const item = items.splice(idx, 1)[0];
    item.deletedAt = new Date().toISOString();

    deleted.push(item);

    saveWishes(items);
    saveWishDeleted(deleted);

    renderWishes();
    renderDeletedWishes();
}

// 削除されたしたいことを元に戻す
function restoreWish(id) {

    let deleted = getWishDeleted();
    let items = getWishes();

    const idx = deleted.findIndex(i => i.id == id);
    if (idx === -1) return;

    const item = deleted.splice(idx, 1)[0];
    delete item.deletedAt;

    items.push(item);

    saveWishes(items);
    saveWishDeleted(deleted);

    renderWishes();
    renderDeletedWishes();
}

// 削除から3ヶ月経過したしたいことを自動的に完全削除する
function purgeOldDeletedWishes() {

    let deleted = getWishDeleted();
    const now = new Date();
    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - 3);

    const remaining = deleted.filter(i => new Date(i.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveWishDeleted(remaining);
    }
}

// 完全に削除する
function deleteWishForever(id) {

    if (!confirm("このしたいことを完全に削除します。元に戻せませんがよろしいですか？")) return;

    let deleted = getWishDeleted();
    deleted = deleted.filter(i => i.id != id);

    saveWishDeleted(deleted);
    renderDeletedWishes();
}

// 削除済みしたいことを表示する（相手フィルターを適用）
function renderDeletedWishes() {

    const items = filterByPartner(getWishDeleted());
    const list = document.getElementById("wish-deleted-list");

    // 削除が新しい順にソート
    items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    list.innerHTML = "";

    if (items.length === 0) {
        list.innerHTML = "<p>削除済みのしたいことはありません</p>";
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
            <p><strong>${item.title}</strong>　<span class="wish-partner">相手：${getPartnerLabel(item)}</span></p>
            ${item.content ? `<p>${item.content}</p>` : ""}
            ${item.detail ? `<p>${item.detail}</p>` : ""}
            <p>作成日：${new Date(item.createdAt).toLocaleString("ja-JP")}</p>
            ${item.achievedAt ? `<p>達成：${new Date(item.achievedAt).toLocaleString("ja-JP")}</p>` : ""}
            <p>削除：${new Date(item.deletedAt).toLocaleString("ja-JP")}</p>
            <p>あと${remainingDays}日で自動的に完全削除されます</p>

            <button class="wish-restore-btn" data-id="${item.id}">元に戻す</button>
            <button class="wish-delete-forever-btn" data-id="${item.id}">完全に削除</button>
        `;

        list.appendChild(div);
    });
}
