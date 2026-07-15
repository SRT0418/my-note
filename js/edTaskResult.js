// ===================================================
// edTaskResult.js
// 習慣タスク達成結果・履歴画面のロジック
// ===================================================

window.addEventListener("load", () => {
    renderTodaySummary();
    renderDailyHistory();
});

// ===================================================
// 今日の状況を集計・表示する
// ===================================================
function renderTodaySummary() {

    const tasks = JSON.parse(localStorage.getItem("habitTasks")) || [];
    const completed = JSON.parse(localStorage.getItem("habitCompleted")) || [];

    const unfinishedCount = tasks.length;
    const completedCount = completed.length;
    const total = unfinishedCount + completedCount;
    const rate = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    // 件数表示
    const todayUnfinishedEl = document.getElementById("today-unfinished-count");
    const todayCompletedEl = document.getElementById("today-completed-count");
    if (todayUnfinishedEl) todayUnfinishedEl.textContent = unfinishedCount;
    if (todayCompletedEl) todayCompletedEl.textContent = completedCount;

    // 達成率バー
    const rateTextEl = document.getElementById("rate-text");
    const progressEl = document.getElementById("progress");
    if (rateTextEl) rateTextEl.textContent = `${rate}%`;
    if (progressEl) progressEl.style.width = `${rate}%`;

    // 円グラフ
    drawPieChart(completedCount, unfinishedCount, rate);

    // 未達成タスク一覧
    const unfinishedListEl = document.getElementById("today-unfinished-list");
    if (unfinishedListEl) {
        if (tasks.length === 0) {
            unfinishedListEl.innerHTML = "<p>未達成のタスクはありません 🎉</p>";
        } else {
            unfinishedListEl.innerHTML = tasks.map(t => `
                <div class="card">
                    <p><strong>${t.title}</strong></p>
                    ${t.detail ? `<p style="color:#666;font-size:0.92em">${t.detail}</p>` : ""}
                </div>
            `).join("");
        }
    }

    // 達成タスク一覧
    const completedListEl = document.getElementById("today-completed-list");
    if (completedListEl) {
        if (completed.length === 0) {
            completedListEl.innerHTML = "<p>達成したタスクがありません</p>";
        } else {
            completedListEl.innerHTML = completed.map(t => `
                <div class="card">
                    <p><strong>${t.title}</strong> <span style="color:#2ecc71">✅</span></p>
                    ${t.detail ? `<p style="color:#666;font-size:0.92em">${t.detail}</p>` : ""}
                    <p style="font-size:0.85em;color:#aaa">達成：${new Date(t.completedAt).toLocaleString("ja-JP")}</p>
                </div>
            `).join("");
        }
    }
}

// ===================================================
// 円グラフを描画する（Canvas）
// ===================================================
function drawPieChart(completedCount, unfinishedCount, rate) {
    const canvas = document.getElementById("pieChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    const total = completedCount + unfinishedCount;

    // データが0件のとき：グレーの円を描画する
    if (total === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#eee";
        ctx.fill();

        ctx.fillStyle = "#aaa";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("タスクなし", centerX, centerY);
        return;
    }

    const parts = [
        { label: "達成", value: (completedCount / total) * 100, color: "#2ecc71" },
        { label: "未達成", value: (unfinishedCount / total) * 100, color: "#f1c40f" }
    ];

    let startAngle = -Math.PI / 2; // 12時の位置から開始

    parts.forEach(part => {
        const sliceAngle = (part.value / 100) * 2 * Math.PI;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        // ドーナツ型にする
        ctx.arc(centerX, centerY, radius - 40, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();

        ctx.fillStyle = part.color;
        ctx.fill();

        startAngle += sliceAngle;
    });

    // 中央テキスト
    ctx.fillStyle = "#333";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("達成率", centerX, centerY - 8);

    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`${rate}%`, centerX, centerY + 18);
}

// ===================================================
// 日ごとの達成履歴を表示する
// ===================================================
function renderDailyHistory() {
    const container = document.getElementById("daily-history-list");
    if (!container) return;

    const history = JSON.parse(localStorage.getItem("habitDailyHistory")) || [];

    if (history.length === 0) {
        container.innerHTML = "<p class='history-empty'>まだ履歴がありません。<br>翌日0:00になると自動的に記録されます。</p>";
        return;
    }

    container.innerHTML = history.map((h, index) => {
        const rateColor = h.rate >= 80 ? "#2ecc71" : h.rate >= 50 ? "#f39c12" : "#e74c3c";
        const total = (h.completedCount || 0) + (h.unfinishedCount || 0);
        const completedWidth = total === 0 ? 0 : (h.completedCount / total) * 100;
        const unfinishedWidth = total === 0 ? 0 : (h.unfinishedCount / total) * 100;

        const completedItems = (h.completedList || []).map(t =>
            `<li>✅ ${t.title}</li>`
        ).join("");
        const unfinishedItems = (h.unfinishedList || []).map(t =>
            `<li>⬜ ${t.title}</li>`
        ).join("");

        return `
        <details class="history-card" id="daily-history-${index}">
            <summary class="history-summary">
                <span class="history-week-label">📅 ${h.dateLabel}</span>
                <span class="history-rate-badge" style="background:${rateColor}">${h.rate}%</span>
            </summary>
            <div class="history-detail">
                <div class="history-counts">
                    <span>🟢 達成：${h.completedCount || 0}件</span>
                    <span>🟡 未達成：${h.unfinishedCount || 0}件</span>
                    <span>📊 合計：${total}件</span>
                </div>
                <div class="bar-container" style="margin-top:8px">
                    <div class="bar completed" style="width:${completedWidth}%"></div>
                    <div class="bar unfinished" style="width:${unfinishedWidth}%"></div>
                </div>

                <div class="history-task-lists">
                    <div>
                        <p class="history-list-heading">🟢 達成済み</p>
                        <ul class="history-task-list">${completedItems || "<li>なし</li>"}</ul>
                    </div>
                    <div>
                        <p class="history-list-heading">🟡 未達成</p>
                        <ul class="history-task-list">${unfinishedItems || "<li>なし</li>"}</ul>
                    </div>
                </div>

                <button class="delete-daily-history-btn" data-date-key="${h.dateKey}">この日の履歴を削除</button>
            </div>
        </details>
        `;
    }).join("");

    // 日次履歴の削除ボタンにイベントを設定する
    container.querySelectorAll(".delete-daily-history-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const dateKey = btn.dataset.dateKey;
            let history = JSON.parse(localStorage.getItem("habitDailyHistory")) || [];
            history = history.filter(h => h.dateKey !== dateKey);
            localStorage.setItem("habitDailyHistory", JSON.stringify(history));
            renderDailyHistory();
        });
    });
}
