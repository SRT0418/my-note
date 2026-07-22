// ===== 予定データの読み書き =====

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// localStorageから予定一覧を取得する
function getSchedules() {
    return JSON.parse(localStorage.getItem("schedules")) || [];
}

// 予定一覧をlocalStorageに保存する
function saveSchedules(schedules) {
    localStorage.setItem("schedules", JSON.stringify(schedules));
}

// localStorageから削除済み予定を取得する
function getDeletedSchedules() {
    return JSON.parse(localStorage.getItem("deletedSchedules")) || [];
}

// 削除済み予定をlocalStorageに保存する
function saveDeletedSchedules(schedules) {
    localStorage.setItem("deletedSchedules", JSON.stringify(schedules));
}

// Dateオブジェクトを "YYYY-MM-DD" 形式の文字列に変換する
function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// 指定した日付(YYYY-MM-DD)にかかっている予定の一覧を返す
function getSchedulesOnDate(schedules, dateKey) {
    return schedules.filter(s => s.startDate <= dateKey && s.endDate >= dateKey);
}

// 予定の日時を表示用の文字列に整形する
function formatScheduleDateTime(schedule) {
    const startDateLabel = formatDateLabel(schedule.startDate);
    const endDateLabel = formatDateLabel(schedule.endDate);

    const dateRange = schedule.startDate === schedule.endDate
        ? startDateLabel
        : `${startDateLabel} ～ ${endDateLabel}`;

    const hasStartTime = !!schedule.startTime;
    const hasEndTime = !!schedule.endTime;

    let timeRange = "";
    if (hasStartTime && hasEndTime) {
        timeRange = `${schedule.startTime} ～ ${schedule.endTime}`;
    } else if (hasStartTime) {
        timeRange = `${schedule.startTime} ～`;
    } else if (hasEndTime) {
        timeRange = `～ ${schedule.endTime}`;
    }

    return timeRange ? `${dateRange} ： ${timeRange}` : dateRange;
}

// "YYYY-MM-DD" を "M/D" 形式に変換する
function formatDateLabel(dateKey) {
    const [y, m, d] = dateKey.split("-");
    return `${Number(m)}/${Number(d)}`;
}

// ===== カレンダーの状態 =====

const today = new Date();
let calendarYear = today.getFullYear();
let calendarMonth = today.getMonth(); // 0〜11
let selectedDateKey = null; // nullの場合は「すべての予定」を表示

// ===== 初期化 =====

window.addEventListener("load", () => {
    purgeOldDeletedSchedules(); // 3ヶ月経過した削除済み予定の全削除処理
    renderCalendar();
    renderEventList();
    renderHistoryList();
    renderDeletedList();

    document.getElementById("add-button").addEventListener("click", () => {
        window.location.href = "./add-schedule.html";
    });

    document.getElementById("prev-month-btn").addEventListener("click", () => {
        calendarMonth--;
        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear--;
        }
        renderCalendar();
    });

    document.getElementById("next-month-btn").addEventListener("click", () => {
        calendarMonth++;
        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear++;
        }
        renderCalendar();
    });

    document.getElementById("show-all-btn").addEventListener("click", () => {
        selectedDateKey = null;
        renderCalendar();
        renderEventList();
    });
});

// ===== カレンダー描画 =====

function renderCalendar() {
    const schedules = getSchedules();
    const grid = document.getElementById("calendar-grid");
    const label = document.getElementById("calendar-month-label");

    label.textContent = `${calendarYear}年${calendarMonth + 1}月`;
    grid.innerHTML = "";

    // 曜日ヘッダー
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    weekdays.forEach((w, i) => {
        const cell = document.createElement("div");
        cell.className = "calendar-weekday";
        if (i === 0) cell.classList.add("sunday");
        if (i === 6) cell.classList.add("saturday");
        cell.textContent = w;
        grid.appendChild(cell);
    });

    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const todayKey = toDateKey(today);

    // 前月分の空白セル
    for (let i = 0; i < startOffset; i++) {
        const cell = document.createElement("div");
        cell.className = "calendar-day empty";
        grid.appendChild(cell);
    }

    // 日付セル
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(calendarYear, calendarMonth, day);
        const dateKey = toDateKey(dateObj);
        const weekdayIndex = dateObj.getDay();

        const cell = document.createElement("div");
        cell.className = "calendar-day";
        cell.dataset.date = dateKey;

        if (weekdayIndex === 0) cell.classList.add("sunday");
        if (weekdayIndex === 6) cell.classList.add("saturday");
        if (dateKey === todayKey) cell.classList.add("today");
        if (dateKey === selectedDateKey) cell.classList.add("selected");

        const dayNumber = document.createElement("div");
        dayNumber.className = "calendar-day-number";
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        // 印の表示
        const dotsOnDay = getSchedulesOnDate(schedules, dateKey);
        if (dotsOnDay.length > 0) {
            const dotsWrap = document.createElement("div");
            dotsWrap.className = "calendar-dots";

            const maxDots = 4;
            const visibleCount = Math.min(dotsOnDay.length, maxDots);

            for (let i = 0; i < visibleCount; i++) {
                const dot = document.createElement("span");
                dot.className = "calendar-dot";
                dotsWrap.appendChild(dot);
            }

            if (dotsOnDay.length > maxDots) {
                const more = document.createElement("span");
                more.className = "calendar-dot-more";
                more.textContent = `+${dotsOnDay.length - maxDots}`;
                dotsWrap.appendChild(more);
            }

            cell.appendChild(dotsWrap);
        }

        cell.addEventListener("click", () => {
            selectedDateKey = dateKey;
            renderCalendar();
            renderEventList();
        });

        grid.appendChild(cell);
    }
}

// ===== 今後の予定カード一覧の描画 =====

function renderEventList() {
    const schedules = getSchedules();
    const list = document.getElementById("event-list");
    const heading = document.getElementById("event-list-heading");
    const showAllBtn = document.getElementById("show-all-btn");

    const todayKey = toDateKey(today);

    // 今日以降の予定（期限が過ぎていないもの）を抽出
    let upcomingSchedules = schedules.filter(s => s.endDate >= todayKey);

    let targetSchedules;

    if (selectedDateKey) {
        targetSchedules = getSchedulesOnDate(upcomingSchedules, selectedDateKey);
        heading.textContent = `${formatDateLabel(selectedDateKey)}の予定`;
        showAllBtn.style.display = "inline-block";
    } else {
        targetSchedules = upcomingSchedules.slice();
        heading.textContent = "すべての予定（今後）";
        showAllBtn.style.display = "none";
    }

    targetSchedules.sort((a, b) => {
        if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
        return (a.startTime || "").localeCompare(b.startTime || "");
    });

    list.innerHTML = "";

    if (targetSchedules.length === 0) {
        list.innerHTML = "<p>該当する予定はありません</p>";
        return;
    }

    targetSchedules.forEach(schedule => {
        const div = document.createElement("div");
        div.className = "card schedule-card";

        div.innerHTML = `
            <p class="schedule-title">${escapeHtml(schedule.title)}</p>
            ${schedule.partner ? `<p>相手：${escapeHtml(schedule.partner)}</p>` : ""}
            ${schedule.location ? `<p>場所：${escapeHtml(schedule.location)}</p>` : ""}
            <p>日時：${formatScheduleDateTime(schedule)}</p>
            ${schedule.description ? `<p>詳細：${escapeHtml(schedule.description).replace(/\n/g, "<br>")}</p>` : ""}

            <button class="schedule-edit-btn" data-id="${schedule.id}">編集</button>
            <button class="schedule-delete-btn" data-id="${schedule.id}">削除</button>
        `;

        list.appendChild(div);
    });
}

// ===== 過去の予定（履歴）一覧の描画（月ごとにグループ化・折りたたみ表示） =====

function renderHistoryList() {
    const list = document.getElementById("history-list");
    if (!list) return;

    const schedules = getSchedules();
    const todayKey = toDateKey(today);

    // 終了日が今日より前の予定（期限切れ）を取得
    const pastSchedules = schedules.filter(s => s.endDate < todayKey);

    // 新しい予定順（終了日が新しい順）にソート
    pastSchedules.sort((a, b) => b.endDate.localeCompare(a.endDate));

    list.innerHTML = "";

    if (pastSchedules.length === 0) {
        list.innerHTML = "<p>過去の予定はありません</p>";
        return;
    }

    // YYYY-MM ごとにグループ化
    const groups = {};
    pastSchedules.forEach(s => {
        const monthKey = s.endDate.substring(0, 7); // "YYYY-MM"
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(s);
    });

    // 月ごとに details / summary タグで最小化（折りたたみ）表示
    Object.keys(groups).forEach(monthKey => {
        const [year, month] = monthKey.split("-");
        const monthSchedules = groups[monthKey];

        const details = document.createElement("details");
        details.className = "history-month-group";

        const summary = document.createElement("summary");
        summary.textContent = `${year}年${Number(month)}月 (${monthSchedules.length}件)`;
        details.appendChild(summary);

        const container = document.createElement("div");
        container.className = "history-month-content";

        monthSchedules.forEach(schedule => {
            const div = document.createElement("div");
            div.className = "card schedule-card";
            div.innerHTML = `
                <p class="schedule-title">${escapeHtml(schedule.title)}</p>
                ${schedule.partner ? `<p>相手：${escapeHtml(schedule.partner)}</p>` : ""}
                ${schedule.location ? `<p>場所：${escapeHtml(schedule.location)}</p>` : ""}
                <p>日時：${formatScheduleDateTime(schedule)}</p>
                ${schedule.description ? `<p>詳細：${escapeHtml(schedule.description).replace(/\n/g, "<br>")}</p>` : ""}

                <button class="schedule-edit-btn" data-id="${schedule.id}">編集</button>
                <button class="schedule-delete-btn" data-id="${schedule.id}">削除</button>
            `;
            container.appendChild(div);
        });

        details.appendChild(container);
        list.appendChild(details);
    });
}

// ===== 削除済み予定一覧の描画 =====

function renderDeletedList() {
    const list = document.getElementById("deleted-schedule-list");
    if (!list) return;

    const deleted = getDeletedSchedules();
    deleted.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    list.innerHTML = "";

    if (deleted.length === 0) {
        list.innerHTML = "<p>削除済みの予定はありません</p>";
        return;
    }

    deleted.forEach(schedule => {
        const div = document.createElement("div");
        div.className = "card schedule-card";

        // 3ヶ月後自動削除までの残り日数
        const purgeDate = new Date(schedule.deletedAt);
        purgeDate.setMonth(purgeDate.getMonth() + 3);
        const remainingDays = Math.max(0, Math.ceil((purgeDate - new Date()) / (1000 * 60 * 60 * 24)));

        div.innerHTML = `
            <p class="schedule-title">${escapeHtml(schedule.title)}</p>
            ${schedule.partner ? `<p>相手：${escapeHtml(schedule.partner)}</p>` : ""}
            ${schedule.location ? `<p>場所：${escapeHtml(schedule.location)}</p>` : ""}
            <p>日時：${formatScheduleDateTime(schedule)}</p>
            ${schedule.description ? `<p>詳細：${escapeHtml(schedule.description).replace(/\n/g, "<br>")}</p>` : ""}
            <p>削除：${new Date(schedule.deletedAt).toLocaleString("ja-JP")}</p>
            <p>あと${remainingDays}日で自動的に完全削除されます</p>

            <button class="restore-schedule-btn" data-id="${schedule.id}">元に戻す</button>
            <button class="delete-forever-schedule-btn" data-id="${schedule.id}">完全に削除</button>
        `;

        list.appendChild(div);
    });
}

// ===== 操作イベント（編集・一時削除・復元・完全削除） =====

document.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    // 編集画面へ移動
    if (btn.classList.contains("schedule-edit-btn")) {
        window.location.href = `add-schedule.html?id=${id}`;
    }

    // 一時削除（削除済み一覧に退避）
    if (btn.classList.contains("schedule-delete-btn")) {
        let schedules = getSchedules();
        let deleted = getDeletedSchedules();

        const index = schedules.findIndex(s => s.id == id);
        if (index === -1) return;

        const target = schedules.splice(index, 1)[0];
        target.deletedAt = new Date().toISOString();

        deleted.push(target);

        saveSchedules(schedules);
        saveDeletedSchedules(deleted);

        refreshAllViews();
    }

    // 元に戻す
    if (btn.classList.contains("restore-schedule-btn")) {
        let deleted = getDeletedSchedules();

        const index = deleted.findIndex(s => s.id == id);
        if (index === -1) return;

        const target = deleted.splice(index, 1)[0];
        delete target.deletedAt;

        let schedules = getSchedules();
        schedules.push(target);

        saveSchedules(schedules);
        saveDeletedSchedules(deleted);

        refreshAllViews();
    }

    // 完全に削除
    if (btn.classList.contains("delete-forever-schedule-btn")) {
        if (!confirm("この予定を完全に削除します。元に戻せませんがよろしいですか？")) return;

        let deleted = getDeletedSchedules();
        deleted = deleted.filter(s => s.id != id);

        saveDeletedSchedules(deleted);
        renderDeletedList();
    }
});

// 画面全体の一括再描画
function refreshAllViews() {
    renderCalendar();
    renderEventList();
    renderHistoryList();
    renderDeletedList();
}

// 削除から3ヶ月経過した予定を自動的に完全削除する
function purgeOldDeletedSchedules() {
    let deleted = getDeletedSchedules();
    const now = new Date();

    const threshold = new Date(now);
    threshold.setMonth(threshold.getMonth() - 3);

    const remaining = deleted.filter(s => new Date(s.deletedAt) >= threshold);

    if (remaining.length !== deleted.length) {
        saveDeletedSchedules(remaining);
    }
}

// --- カードエレメントの共通生成関数 ---
function createScheduleCard(s, isTrash) {
    const card = document.createElement("div");
    card.className = "schedule-card";

    const timeStr = (s.startTime || s.endTime) ? ` ${s.startTime || ""}～${s.endTime || ""}` : "";
    const dateDisplay = (s.startDate === s.endDate) ? `${s.startDate}${timeStr}` : `${s.startDate} ～ ${s.endDate}`;

    // ★場所と相手を表示用テキストに構築★
    let metaText = `📅 ${dateDisplay}`;
    if (s.partner) metaText += ` | 👤 ${escapeHtml(s.partner)}`;
    if (s.location) metaText += ` | 📍 ${escapeHtml(s.location)}`;

    let actionButtons = "";

    if (isTrash) {
        actionButtons = `
                <div class="card-actions">
                    <button class="btn-restore" data-id="${s.id}">復元</button>
                    <button class="btn-delete-perm" data-id="${s.id}">完全に削除</button>
                </div>
            `;
    } else {
        actionButtons = `
                <div class="card-actions">
                    <button class="btn-edit" data-id="${s.id}">編集</button>
                    <button class="btn-delete" data-id="${s.id}">削除</button>
                </div>
            `;
    }

    card.innerHTML = `
            <div class="card-info">
                <div class="card-title">${escapeHtml(s.title)}</div>
                <div class="card-meta">${metaText}</div>
                ${s.description ? `<div class="card-desc">${escapeHtml(s.description)}</div>` : ""}
            </div>
            ${actionButtons}
        `;

    if (!isTrash) {
        card.querySelector(".btn-edit").addEventListener("click", () => {
            location.href = `add-schedule.html?id=${s.id}`;
        });
        card.querySelector(".btn-delete").addEventListener("click", () => {
            moveToTrash(s.id);
        });
    } else {
        card.querySelector(".btn-restore").addEventListener("click", () => {
            restoreFromTrash(s.id);
        });
        card.querySelector(".btn-delete-perm").addEventListener("click", () => {
            deletePermanently(s.id);
        });
    }

    return card;
}