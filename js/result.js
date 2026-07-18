// 週の月曜日0時を返す（週の識別キーとして使用。kadai.js内の同名関数と同じロジック）
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
    return `${y}-${m}-${day2}`;
}

// ページ読み込み時に課題データを集計し、達成率やグラフを表示する
window.addEventListener("load", function () {

    const tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    const completedTasks = JSON.parse(localStorage.getItem("completedTasks")) || [];

    const now = new Date();

    // 無効データを除外（deadlineが不正なものを削除）
    const validTasks = tasks.filter(t => {
        if (!t || !t.deadline) return false;
        const d = new Date(t.deadline);
        return !isNaN(d.getTime());
    });

    // 未達成・期限切れタスクを分類
    const unfinishedTasks = validTasks.filter(t => new Date(t.deadline) >= now);
    const overdueTasks = validTasks.filter(t => new Date(t.deadline) < now);

    // 各タスク数を取得
    const unfinished = unfinishedTasks.length;
    const overdue = overdueTasks.length;
    const completed = completedTasks.length;

    // 全体数を計算（未達成＋達成）
    const totalAll = validTasks.length + completed;

    // 各割合（達成率・未達成率・期限切れ率）を計算
    const completedRate = totalAll === 0 ? 0 : (completed / totalAll) * 100;
    const unfinishedRate = totalAll === 0 ? 0 : (unfinished / totalAll) * 100;
    const overdueRate = totalAll === 0 ? 0 : (overdue / totalAll) * 100;

    // 表示用に整数へ変換
    const completedRateFix = Math.round(completedRate);
    const unfinishedRateFix = Math.round(unfinishedRate);
    const overdueRateFix = Math.round(overdueRate);

    // DOM要素取得
    const unfinishedCountEl = document.getElementById("unfinished-count");
    const completedCountEl = document.getElementById("completed-count");
    const overdueCountEl = document.getElementById("overdue-count");
    const rateTextEl = document.getElementById("rate-text");
    const progressEl = document.getElementById("progress");
    // const chartEl = document.getElementById("chart");

    // 数値を画面に反映
    if (unfinishedCountEl) unfinishedCountEl.textContent = unfinished;
    if (completedCountEl) completedCountEl.textContent = completed;
    if (overdueCountEl) overdueCountEl.textContent = overdue;

    // 達成率テキスト表示
    if (rateTextEl) {
        rateTextEl.textContent = `${completedRateFix}%`;
    }

    // プログレスバー更新
    if (progressEl) {
        progressEl.style.width = `${completedRate}%`;
    }

    // 円グラフ（canvas）描画
    const canvas = document.getElementById("pieChart");

    if (canvas) {
        const ctx = canvas.getContext("2d");

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 100;

        // 各カテゴリの割合と色
        const rates = [
            { label: "未達成", value: unfinishedRate, color: "#f1c40f" },
            { label: "達成", value: completedRate, color: "#2ecc71" },
            { label: "期限切れ", value: overdueRate, color: "#e74c3c" }
        ];

        let startAngle = 0;

        // 円グラフを描画
        rates.forEach(part => {
            const sliceAngle = (part.value / 100) * 2 * Math.PI;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.arc(centerX, centerY, radius - 40, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();

            ctx.fillStyle = part.color;
            ctx.fill();

            startAngle += sliceAngle;
        });

        // 中央の文字表示
        ctx.fillStyle = "#333";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("達成率", centerX, centerY - 10);

        ctx.font = "bold 22px sans-serif";
        ctx.fillText(`${completedRateFix}%`, centerX, centerY + 20);
    }

    // // 棒グラフ（HTML）表示
    // if (chartEl) {
    //     chartEl.innerHTML = `
    //         <div class="bar-container">
    //             <div class="bar unfinished" style="width:${unfinishedRate}%"></div>
    //             <div class="bar completed" style="width:${completedRate}%"></div>
    //             <div class="bar overdue" style="width:${overdueRate}%"></div>
    //         </div>

    //         <p>
    //             🟡 未達成：${unfinishedRateFix}%　
    //             🟢 達成：${completedRateFix}%　
    //             🔴 期限切れ：${overdueRateFix}%
    //         </p>
    //     `;
    // }

    // 週次履歴を表示
    renderWeeklyHistory();

    // 締切で「今週」「来週」に分けた一覧を表示
    renderUpcomingByWeek(validTasks);

});

// 現在進行中の未完了課題を、締切に応じて「今週締切」「来週締切」「それ以降」に分けて表示する
function renderUpcomingByWeek(validTasks) {

    const thisWeekEl = document.getElementById("this-week-list");
    const nextWeekEl = document.getElementById("next-week-list");
    const laterEl = document.getElementById("later-list");

    if (!thisWeekEl && !nextWeekEl && !laterEl) return;

    const now = new Date();
    const currentWeekKey = getWeekKey(now);

    const nextWeekDate = new Date(currentWeekKey);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekKey = getWeekKey(nextWeekDate);

    const thisWeek = [];
    const nextWeek = [];
    const later = [];

    validTasks.forEach(t => {
        const wk = getWeekKey(t.deadline);
        if (wk === currentWeekKey) {
            thisWeek.push(t);
        } else if (wk === nextWeekKey) {
            nextWeek.push(t);
        } else if (wk > currentWeekKey) {
            later.push(t);
        }
        // 締切週が現在より前（本来はarchiveされているはず）のものは表示しない
    });

    // 締切が近い順に並び替え
    [thisWeek, nextWeek, later].forEach(list =>
        list.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    );

    function renderList(el, list, emptyText) {
        if (!el) return;
        if (list.length === 0) {
            el.innerHTML = `<p>${emptyText}</p>`;
            return;
        }
        el.innerHTML = list.map(t => `
            <div class="card">
                <p>科目：${t.subject}</p>
                <p>課題：${t.title}</p>
                <p>締切：${new Date(t.deadline).toLocaleString("ja-JP")}</p>
            </div>
        `).join("");
    }

    renderList(thisWeekEl, thisWeek, "今週締切の課題はありません");
    renderList(nextWeekEl, nextWeek, "来週締切の課題はありません");
    renderList(laterEl, later, "再来週以降の課題はありません");
}

// 週次履歴を折りたたみパネルで表示する
function renderWeeklyHistory() {

    const container = document.getElementById("weekly-history-list");
    if (!container) return;

    const history = JSON.parse(localStorage.getItem("weeklyHistory")) || [];

    if (history.length === 0) {
        container.innerHTML = "<p class='history-empty'>まだ履歴がありません。<br>課題の締切の週が終わると自動的に記録されます。</p>";
        return;
    }

    container.innerHTML = history.map((h, index) => {
        const rateColor = h.rate >= 80 ? "#2ecc71" : h.rate >= 50 ? "#f39c12" : "#e74c3c";
        const total = (h.unfinishedCount || 0) + (h.completedCount || 0);
        const unfinishedWidth = total === 0 ? 0 : (h.unfinishedCount / total) * 100;
        const completedWidth = total === 0 ? 0 : (h.completedCount / total) * 100;

        const unfinishedItems = (h.unfinishedList || []).map(t =>
            `<li>${t.subject}　${t.title}</li>`
        ).join("");
        const completedItems = (h.completedList || []).map(t =>
            `<li>${t.subject}　${t.title}</li>`
        ).join("");

        return `
        <details class="history-card" id="history-${index}">
            <summary class="history-summary">
                <span class="history-week-label">📅 ${h.weekLabel}</span>
                <span class="history-rate-badge" style="background:${rateColor}">${h.rate}%</span>
            </summary>
            <div class="history-detail">
                <div class="history-counts">
                    <span>🟡 未達成：${h.unfinishedCount || 0}件</span>
                    <span>🟢 達成：${h.completedCount || 0}件</span>
                    <span>📊 合計：${total}件</span>
                </div>
                <div class="bar-container" style="margin-top:8px">
                    <div class="bar unfinished" style="width:${unfinishedWidth}%"></div>
                    <div class="bar completed" style="width:${completedWidth}%"></div>
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

                <button class="delete-history-btn" data-week-key="${h.weekKey}">この週の履歴を削除</button>
            </div>
        </details>
        `;
    }).join("");

    // 各履歴の削除ボタンにイベントを設定
    container.querySelectorAll(".delete-history-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation(); // <details> の開閉を防ぐ
            const weekKey = btn.dataset.weekKey;
            let history = JSON.parse(localStorage.getItem("weeklyHistory")) || [];
            history = history.filter(h => h.weekKey !== weekKey);
            localStorage.setItem("weeklyHistory", JSON.stringify(history));
            renderWeeklyHistory();
        });
    });
}