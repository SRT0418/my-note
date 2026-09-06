// ===== 誕生日データ管理 =====

function getBirthdays() {
    return JSON.parse(localStorage.getItem("birthdays")) || [];
}

function saveBirthdays(list) {
    localStorage.setItem("birthdays", JSON.stringify(list));
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ===== 月の日数を返す（うるう年対応） =====
function getDaysInMonth(month) {
    return new Date(2000, month, 0).getDate();
}

// ===== 状態 =====
let editingId = null;

// ===== 初期化 =====
window.addEventListener("load", () => {
    buildMonthOptions();
    buildDayOptions(1);
    renderBirthdayList();
    setupTypeRadio();

    document.getElementById("bd-month").addEventListener("change", () => {
        buildDayOptions(parseInt(document.getElementById("bd-month").value));
    });

    document.getElementById("bd-save-btn").addEventListener("click", saveBirthday);
    document.getElementById("bd-cancel-btn").addEventListener("click", resetForm);
    document.getElementById("bd-back-btn").addEventListener("click", () => {
        history.back();
    });
});

// ===== 月のselectを構築 =====
function buildMonthOptions() {
    const sel = document.getElementById("bd-month");
    sel.innerHTML = "";
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m + "月";
        sel.appendChild(opt);
    }
}

// ===== 日のselectを構築（月に応じて日数が変わる） =====
function buildDayOptions(month) {
    const sel = document.getElementById("bd-day");
    const currentVal = parseInt(sel.value) || 1;
    const days = getDaysInMonth(month);
    sel.innerHTML = "";
    for (let d = 1; d <= days; d++) {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d + "日";
        sel.appendChild(opt);
    }
    sel.value = currentVal <= days ? currentVal : 1;
}

// ===== タイプ切り替えラジオのUI更新 =====
function setupTypeRadio() {
    const labels = document.querySelectorAll(".birthday-type-label");
    labels.forEach(function(label) {
        label.addEventListener("click", function() {
            updateTypeLabels();
        });
    });
    updateTypeLabels();
}

function updateTypeLabels() {
    const mineRadio = document.getElementById("bd-type-mine");
    const otherRadio = document.getElementById("bd-type-other");
    const mineLabel = mineRadio.closest(".birthday-type-label");
    const otherLabel = otherRadio.closest(".birthday-type-label");

    mineLabel.classList.remove("selected-mine", "selected-other");
    otherLabel.classList.remove("selected-mine", "selected-other");

    if (mineRadio.checked) {
        mineLabel.classList.add("selected-mine");
        document.getElementById("bd-name-row").style.display = "none";
    } else {
        otherLabel.classList.add("selected-other");
        document.getElementById("bd-name-row").style.display = "flex";
    }
}

// ===== 誕生日を保存 =====
function saveBirthday() {
    const isMine = document.getElementById("bd-type-mine").checked;
    const name = isMine ? "自分" : document.getElementById("bd-name").value.trim();
    const month = parseInt(document.getElementById("bd-month").value);
    const day = parseInt(document.getElementById("bd-day").value);
    const note = document.getElementById("bd-note").value.trim();

    if (!isMine && !name) {
        alert("名前を入力してください。");
        return;
    }

    const list = getBirthdays();

    if (editingId !== null) {
        const idx = list.findIndex(function(b) { return b.id === editingId; });
        if (idx !== -1) {
            list[idx] = { id: editingId, isMine: isMine, name: name, month: month, day: day, note: note };
        }
    } else {
        list.push({ id: Date.now(), isMine: isMine, name: name, month: month, day: day, note: note });
    }

    saveBirthdays(list);
    resetForm();
    renderBirthdayList();
}

// ===== フォームをリセット =====
function resetForm() {
    editingId = null;
    document.getElementById("bd-type-mine").checked = true;
    document.getElementById("bd-name").value = "";
    document.getElementById("bd-month").value = 1;
    buildDayOptions(1);
    document.getElementById("bd-day").value = 1;
    document.getElementById("bd-note").value = "";
    document.getElementById("bd-save-btn").textContent = "追加";
    document.getElementById("bd-form-heading").textContent = "誕生日を追加";
    document.getElementById("bd-cancel-btn").style.display = "none";
    updateTypeLabels();
}

// ===== 編集モードに切り替え =====
function startEdit(id) {
    const list = getBirthdays();
    const b = list.find(function(x) { return x.id === id; });
    if (!b) return;

    editingId = id;

    if (b.isMine) {
        document.getElementById("bd-type-mine").checked = true;
    } else {
        document.getElementById("bd-type-other").checked = true;
    }
    updateTypeLabels();

    document.getElementById("bd-name").value = b.isMine ? "" : b.name;
    document.getElementById("bd-month").value = b.month;
    buildDayOptions(b.month);
    document.getElementById("bd-day").value = b.day;
    document.getElementById("bd-note").value = b.note || "";
    document.getElementById("bd-save-btn").textContent = "更新";
    document.getElementById("bd-form-heading").textContent = "誕生日を編集";
    document.getElementById("bd-cancel-btn").style.display = "";

    document.getElementById("bd-form-card").scrollIntoView({ behavior: "smooth" });
}

// ===== 削除 =====
function deleteBirthday(id) {
    if (!confirm("この誕生日を削除しますか？")) return;
    var list = getBirthdays().filter(function(b) { return b.id !== id; });
    saveBirthdays(list);
    if (editingId === id) resetForm();
    renderBirthdayList();
}

// ===== 誕生日一覧の描画 =====
function renderBirthdayList() {
    const list = getBirthdays();
    const container = document.getElementById("bd-list");
    container.innerHTML = "";

    if (list.length === 0) {
        container.innerHTML = "<p>登録された誕生日はありません</p>";
        return;
    }

    const sorted = list.slice().sort(function(a, b) {
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
    });

    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    sorted.forEach(function(b) {
        const isToday = b.month === todayMonth && b.day === todayDay;
        const icon = b.isMine ? "🎂" : "🎁";

        const card = document.createElement("div");
        card.className = "birthday-card";

        card.innerHTML =
            '<div class="birthday-card-icon">' + icon + '</div>' +
            '<div class="birthday-card-info">' +
                '<div class="birthday-card-name">' +
                    escapeHtml(b.name) +
                    (isToday ? ' <span class="birthday-today-badge">🎉 今日！</span>' : "") +
                '</div>' +
                '<div class="birthday-card-date">' + b.month + '月' + b.day + '日' + (b.isMine ? '（自分）' : '') + '</div>' +
                (b.note ? '<div class="birthday-card-note">' + escapeHtml(b.note) + '</div>' : '') +
            '</div>' +
            '<div class="birthday-card-actions">' +
                '<button class="birthday-edit-btn" data-id="' + b.id + '">編集</button>' +
                '<button class="birthday-delete-btn" data-id="' + b.id + '">削除</button>' +
            '</div>';

        card.querySelector(".birthday-edit-btn").addEventListener("click", function() { startEdit(b.id); });
        card.querySelector(".birthday-delete-btn").addEventListener("click", function() { deleteBirthday(b.id); });

        container.appendChild(card);
    });
}
