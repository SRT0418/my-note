/**
 * MyNote Report Generator (js/report.js)
 * 過去の予定履歴から月別（1か月/3か月選択）で選択しテンプレート報告書を作成
 */

(function () {
    // 状態管理
    let selectedScheduleIds = new Set();
    let currentSchedules = [];

    // localStorageから予定一覧を取得
    function getSchedules() {
        try {
            return JSON.parse(localStorage.getItem("schedules")) || [];
        } catch (e) {
            return [];
        }
    }

    // Dateオブジェクトから "YYYY-MM"
    function toYearMonthKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
    }

    // Dateオブジェクトから "YYYY-MM-DD"
    function toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    // 今日の日付 (YYYY-MM-DD)
    function getTodayKey() {
        return toDateKey(new Date());
    }

    // HTMLエスケープ
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 初期化処理
    window.addEventListener("load", () => {
        const today = new Date();
        const monthInput = document.getElementById("report-target-month");
        const dateInput = document.getElementById("report-date");

        // URLパラメータからの月数指定の初期チェック（?period=3month 等）
        const urlParams = new URLSearchParams(window.location.search);
        const periodParam = urlParams.get("period");
        if (periodParam === "3month") {
            const rad = document.querySelector('input[name="period-type"][value="3month"]');
            if (rad) rad.checked = true;
        }

        if (monthInput) monthInput.value = toYearMonthKey(today);
        if (dateInput) dateInput.value = toDateKey(today);

        setupEventListeners();
        updateScheduleListAndPreview();
    });

    // イベントリスナーの登録
    function setupEventListeners() {
        // 期間タイプラジオ
        document.querySelectorAll('input[name="period-type"]').forEach(radio => {
            radio.addEventListener("change", updateScheduleListAndPreview);
        });

        // 基準年月
        const monthInput = document.getElementById("report-target-month");
        if (monthInput) {
            monthInput.addEventListener("change", updateScheduleListAndPreview);
        }

        // 全選択・全解除ボタン
        document.getElementById("btn-select-all").addEventListener("click", () => {
            currentSchedules.forEach(s => selectedScheduleIds.add(String(s.id)));
            renderChecklist();
            renderPreview();
        });

        document.getElementById("btn-deselect-all").addEventListener("click", () => {
            selectedScheduleIds.clear();
            renderChecklist();
            renderPreview();
        });

        // フォーム変更時プレビュー更新
        const formInputs = [
            "report-template", "report-title", "report-author",
            "report-dept", "report-date", "report-notes"
        ];
        formInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("input", renderPreview);
                el.addEventListener("change", renderPreview);
            }
        });

        // アクションボタン
        document.getElementById("btn-copy-report").addEventListener("click", copyReportToClipboard);
        document.getElementById("btn-download-txt").addEventListener("click", () => downloadReportFile("txt"));
        document.getElementById("btn-download-md").addEventListener("click", () => downloadReportFile("md"));
        document.getElementById("btn-print-report").addEventListener("click", () => window.print());
    }

    // 選択された期間の範囲計算 (開始日, 終了日)
    function calculatePeriodRange() {
        const periodType = document.querySelector('input[name="period-type"]:checked').value;
        const monthVal = document.getElementById("report-target-month").value || toYearMonthKey(new Date());

        const [yStr, mStr] = monthVal.split("-");
        const year = Number(yStr);
        const month = Number(mStr); // 1-12

        let startDateStr = "";
        let endDateStr = "";

        if (periodType === "1month") {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0); // 月末
            startDateStr = toDateKey(start);
            endDateStr = toDateKey(end);
        } else {
            // 3か月間 (対象年月の2か月前から対象月末まで)
            const start = new Date(year, month - 3, 1);
            const end = new Date(year, month, 0);
            startDateStr = toDateKey(start);
            endDateStr = toDateKey(end);
        }

        return {
            type: periodType,
            start: startDateStr,
            end: endDateStr,
            monthLabel: periodType === "1month" ? `${year}年${month}月` : `${startDateStr} ～ ${endDateStr}`
        };
    }

    // 予定一覧の更新＆描画
    function updateScheduleListAndPreview() {
        const range = calculatePeriodRange();

        // 期間表示バッジ
        const badge = document.getElementById("selected-period-display");
        if (badge) {
            badge.textContent = `対象期間: ${range.start} ～ ${range.end} (${range.type === "1month" ? "1か月" : "3か月"})`;
        }

        const allSchedules = getSchedules();
        const todayKey = getTodayKey();

        // フィルタリング: 終了日が今日より前の「過去の予定」で、指定期間内に重複するもの
        currentSchedules = allSchedules.filter(s => {
            if (!s || !s.startDate || !s.endDate) return false;
            const isPast = s.endDate < todayKey;
            const overlaps = s.startDate <= range.end && s.endDate >= range.start;
            return isPast && overlaps;
        });

        // 日付順ソート
        currentSchedules.sort((a, b) => a.startDate.localeCompare(b.startDate));

        // 初期状態ではすべて選択状態にする
        selectedScheduleIds = new Set(currentSchedules.map(s => String(s.id)));

        renderChecklist();
        renderPreview();
    }

    // チェックリスト描画
    function renderChecklist() {
        const container = document.getElementById("past-schedule-checklist");
        const badge = document.getElementById("selected-count-badge");

        if (!container) return;
        container.innerHTML = "";

        if (badge) {
            badge.textContent = `${selectedScheduleIds.size} / ${currentSchedules.length}件 選択中`;
        }

        if (currentSchedules.length === 0) {
            container.innerHTML = `<div class="no-schedules-msg">指定期間に該当する過去の予定履歴はありません。</div>`;
            return;
        }

        currentSchedules.forEach(s => {
            const isChecked = selectedScheduleIds.has(String(s.id));
            const item = document.createElement("label");
            item.className = `schedule-check-item ${isChecked ? "checked" : ""}`;

            const timeStr = s.allDay ? " (終日)" : (s.startTime ? ` (${s.startTime}～${s.endTime || ""})` : "");
            const dateDisplay = s.startDate === s.endDate ? s.startDate : `${s.startDate} ～ ${s.endDate}`;

            item.innerHTML = `
                <input type="checkbox" value="${s.id}" ${isChecked ? "checked" : ""}>
                <div class="check-item-info">
                    <span class="check-item-title">${escapeHtml(s.title)}</span>
                    <span class="check-item-meta">📅 ${dateDisplay}${timeStr} ${s.partner ? `| 👤 ${escapeHtml(s.partner)}` : ""} ${s.location ? `| 📍 ${escapeHtml(s.location)}` : ""}</span>
                    ${s.description ? `<span class="check-item-desc">${escapeHtml(s.description)}</span>` : ""}
                </div>
            `;

            const chk = item.querySelector('input[type="checkbox"]');
            chk.addEventListener("change", (e) => {
                if (e.target.checked) {
                    selectedScheduleIds.add(String(s.id));
                    item.classList.add("checked");
                } else {
                    selectedScheduleIds.delete(String(s.id));
                    item.classList.remove("checked");
                }
                if (badge) {
                    badge.textContent = `${selectedScheduleIds.size} / ${currentSchedules.length}件 選択中`;
                }
                renderPreview();
            });

            container.appendChild(item);
        });
    }

    // 選択された予定のオブジェクト配列取得
    function getSelectedScheduleObjects() {
        return currentSchedules.filter(s => selectedScheduleIds.has(String(s.id)));
    }

    // 報告書テキスト（Markdown形式）の生成
    function buildReportText() {
        const template = document.getElementById("report-template").value;
        const title = document.getElementById("report-title").value.trim() || "業務活動報告書";
        const author = document.getElementById("report-author").value.trim() || "未設定";
        const dept = document.getElementById("report-dept").value.trim() || "未設定";
        const date = document.getElementById("report-date").value || getTodayKey();
        const notes = document.getElementById("report-notes").value.trim();
        const range = calculatePeriodRange();

        const selectedItems = getSelectedScheduleObjects();

        let lines = [];

        if (template === "business") {
            lines.push(`# ${title}`);
            lines.push(``);
            lines.push(`- **作成日**: ${date}`);
            lines.push(`- **報告者**: ${author} (${dept})`);
            lines.push(`- **対象期間**: ${range.start} ～ ${range.end}`);
            lines.push(`- **対象予定件数**: ${selectedItems.length}件`);
            lines.push(``);
            lines.push(`---`);
            lines.push(``);
            lines.push(`## 1. 業務活動・実施予定一覧`);
            lines.push(``);

            if (selectedItems.length === 0) {
                lines.push(`*選択された予定はありません。*`);
            } else {
                selectedItems.forEach((s, i) => {
                    const timeStr = s.allDay ? "終日" : (s.startTime ? `${s.startTime}～${s.endTime || ""}` : "");
                    const dateDisplay = s.startDate === s.endDate ? s.startDate : `${s.startDate} ～ ${s.endDate}`;
                    lines.push(`### ${i + 1}. ${s.title}`);
                    lines.push(`- **日時**: ${dateDisplay} ${timeStr}`);
                    if (s.partner) lines.push(`- **相手・対象**: ${s.partner}`);
                    if (s.location) lines.push(`- **場所**: ${s.location}`);
                    if (s.description) lines.push(`- **内容詳細**: ${s.description}`);
                    lines.push(``);
                });
            }

            lines.push(`## 2. 総評・所感・今後の課題`);
            lines.push(notes ? notes : `*特記事項なし*`);

        } else if (template === "worklog") {
            lines.push(`# 【作業実績書】${title}`);
            lines.push(`作成日: ${date} | 報告者: ${author} (${dept}) | 期間: ${range.start} ～ ${range.end}`);
            lines.push(``);
            lines.push(`| 日付 | 予定・作業タイトル | 時間/終日 | 相手/場所 | 詳細ノート |`);
            lines.push(`|---|---|---|---|---|`);

            if (selectedItems.length === 0) {
                lines.push(`| - | 選択された予定なし | - | - | - |`);
            } else {
                selectedItems.forEach(s => {
                    const timeStr = s.allDay ? "終日" : `${s.startTime || ""}-${s.endTime || ""}`;
                    const dateDisplay = s.startDate === s.endDate ? s.startDate : `${s.startDate}～${s.endDate}`;
                    const meta = [s.partner ? `相手:${s.partner}` : "", s.location ? `場所:${s.location}` : ""].filter(Boolean).join(" ");
                    const desc = (s.description || "-").replace(/\n/g, " ");
                    lines.push(`| ${dateDisplay} | ${s.title} | ${timeStr} | ${meta || "-"} | ${desc} |`);
                });
            }

            lines.push(``);
            lines.push(`### 【特記事項・所感】`);
            lines.push(notes ? notes : `特記事項なし`);

        } else if (template === "summary") {
            lines.push(`# 報告書サマリー: ${title}`);
            lines.push(`【基本情報】 報告者: ${author} | 日付: ${date} | 期間: ${range.start} ～ ${range.end}`);
            lines.push(``);
            lines.push(`### ■ 実施実績要約 (${selectedItems.length}件)`);

            if (selectedItems.length === 0) {
                lines.push(`- 該当項目なし`);
            } else {
                selectedItems.forEach(s => {
                    const dateDisplay = s.startDate === s.endDate ? s.startDate : `${s.startDate}～${s.endDate}`;
                    lines.push(`- **[${dateDisplay}]** ${s.title} ${s.partner ? `(相手: ${s.partner})` : ""}`);
                });
            }

            lines.push(``);
            lines.push(`### ■ 成果・まとめ`);
            lines.push(notes ? notes : `記載なし`);

        } else {
            // カスタム
            lines.push(`# ${title}`);
            lines.push(`日付: ${date} / 報告者: ${author}`);
            lines.push(`期間: ${range.start} ～ ${range.end}`);
            lines.push(``);
            lines.push(`【選択項目】`);
            selectedItems.forEach(s => {
                lines.push(`・${s.startDate} ${s.title}`);
            });
            lines.push(``);
            lines.push(`【備考・所感】`);
            lines.push(notes || "なし");
        }

        return lines.join("\n");
    }

    // プレビュー表示の更新
    function renderPreview() {
        const container = document.getElementById("report-preview-container");
        if (!container) return;

        const reportText = buildReportText();
        const lines = reportText.split("\n");
        let previewHtml = "";
        let inTable = false;
        let inList = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // テーブル区切り行はスキップ
            if (/^\|[-\s|]+\|$/.test(line)) continue;

            // テーブル行
            if (/^\|(.+)\|$/.test(line)) {
                if (!inTable) {
                    if (inList) { previewHtml += "</ul>"; inList = false; }
                    previewHtml += '<div class="preview-table-wrap"><table class="preview-table">';
                    inTable = true;
                    // ヘッダー行
                    const cells = line.split("|").filter(c => c.trim() !== "");
                    previewHtml += "<thead><tr>" + cells.map(c => `<th>${escapeHtml(c.trim())}</th>`).join("") + "</tr></thead><tbody>";
                    continue;
                }
                const cells = line.split("|").filter(c => c.trim() !== "");
                previewHtml += "<tr>" + cells.map(c => `<td>${formatInline(escapeHtml(c.trim()))}</td>`).join("") + "</tr>";
                continue;
            } else if (inTable) {
                previewHtml += "</tbody></table></div>";
                inTable = false;
            }

            // 見出し
            if (/^### (.+)$/.test(line)) {
                if (inList) { previewHtml += "</ul>"; inList = false; }
                previewHtml += `<h3 class="preview-h3">${formatInline(escapeHtml(line.replace(/^### /, "")))}</h3>`;
                continue;
            }
            if (/^## (.+)$/.test(line)) {
                if (inList) { previewHtml += "</ul>"; inList = false; }
                previewHtml += `<h2 class="preview-h2">${formatInline(escapeHtml(line.replace(/^## /, "")))}</h2>`;
                continue;
            }
            if (/^# (.+)$/.test(line)) {
                if (inList) { previewHtml += "</ul>"; inList = false; }
                previewHtml += `<h1 class="preview-h1">${formatInline(escapeHtml(line.replace(/^# /, "")))}</h1>`;
                continue;
            }

            // 水平線
            if (/^---+$/.test(line.trim())) {
                if (inList) { previewHtml += "</ul>"; inList = false; }
                previewHtml += '<hr class="preview-hr">';
                continue;
            }

            // リスト項目
            if (/^[\-・] (.+)$/.test(line)) {
                if (!inList) { previewHtml += '<ul class="preview-ul">'; inList = true; }
                const content = line.replace(/^[\-・] /, "");
                previewHtml += `<li class="preview-li">${formatInline(escapeHtml(content))}</li>`;
                continue;
            } else if (inList) {
                previewHtml += "</ul>";
                inList = false;
            }

            // 空行
            if (line.trim() === "") {
                continue;
            }

            // 通常テキスト
            previewHtml += `<p class="preview-p">${formatInline(escapeHtml(line))}</p>`;
        }

        if (inTable) previewHtml += "</tbody></table></div>";
        if (inList) previewHtml += "</ul>";

        container.innerHTML = `<div class="report-paper">${previewHtml}</div>`;
    }

    // インラインフォーマット（太字, イタリック）
    function formatInline(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>');
    }

    // クリップボードへコピー
    function copyReportToClipboard() {
        const text = buildReportText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert("報告書の内容をクリップボードにコピーしました！");
            }).catch(err => {
                console.error("Copy failed", err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert("報告書の内容をクリップボードにコピーしました！");
        } catch (err) {
            alert("コピーに失敗しました。手動でコピーしてください。");
        }
        document.body.removeChild(textArea);
    }

    // ファイルダウンロード (.txt または .md)
    function downloadReportFile(extension) {
        const text = buildReportText();
        const title = document.getElementById("report-title").value.trim() || "報告書";
        const date = document.getElementById("report-date").value || getTodayKey();
        const filename = `${title}_${date}.${extension}`;

        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
})();
