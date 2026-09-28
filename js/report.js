/**
 * MyNote Report Generator (js/report.js)
 * カレンダー予定・課題締切管理・タスク管理からの実績報告書作成
 * クラシックブルーなど複数のデザインテーマ（見出し・下線・文字数カウント）対応
 * 自由なセクション追加・書き込み・プレビュー直接編集・Word(.doc)/TXT/MD出力対応
 */

(function () {
    // 状態管理
    let currentSource = "schedules"; // "schedules" | "kadai" | "tasks" | "custom"
    let selectedItemIds = new Set();
    let currentItems = [];
    let isDirectEditMode = true; // プレビュー直接編集モード（デフォルトON）

    // 自由記述セクションリスト（ユーザーが自由に追加・編集可能）
    // 各要素: { id, title, content }
    let customSections = [];

    // タイトル・サブタイトルの例文（placeholder表示用）
    let exampleTitle = "報告書";
    let exampleSubtitle = "";

    // ==========================================
    // データ取得ヘルパー
    // ==========================================
    function getSchedules() {
        try { return JSON.parse(localStorage.getItem("schedules")) || []; } catch (e) { return []; }
    }

    function getKadaiTasks() {
        try {
            const active = JSON.parse(localStorage.getItem("tasks")) || [];
            const completed = JSON.parse(localStorage.getItem("completedTasks")) || [];
            return { active, completed };
        } catch (e) {
            return { active: [], completed: [] };
        }
    }

    function getTodoTasks() {
        try {
            const active = JSON.parse(localStorage.getItem("todoTasks")) || [];
            const completed = JSON.parse(localStorage.getItem("todoCompleted")) || [];
            return { active, completed };
        } catch (e) {
            return { active: [], completed: [] };
        }
    }

    // ==========================================
    // 日付・文字ユーティリティ
    // ==========================================
    function toYearMonthKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`;
    }

    function toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function getTodayKey() {
        return toDateKey(new Date());
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

    // 空白や改行を除外した本文文字数カウント
    function countCharacters(text) {
        if (!text) return 0;
        return text.replace(/\r?\n/g, "").length;
    }

    // ==========================================
    // デザインテーマ定義
    // ==========================================
    // classic-blue は既存デザイン（既存CSSのまま）。追加テーマだけ上書きします。
    const REPORT_THEMES = {
        "classic-blue": { label: "クラシックブルー" },
        "minimal-mono": { label: "ミニマル（モノトーン）" },
        "note-paper": { label: "ノート風（罫線・マーカー）" },
        "pop-badge": { label: "ポップ（バイオレット×アンバー）" },
        "editorial": { label: "エディトリアル（雑誌風・明朝）" },
        "midnight": { label: "ミッドナイト（ダーク×ネオン）" }
    };

    // プレビュー用CSS（既存デザインより詳細度を高くして上書き）
    const THEME_PREVIEW_CSS = `
    /* ---- ミニマル（モノトーン） ---- */
    .report-paper.rt-minimal-mono .es-paper-title { color:#111; font-weight:700; letter-spacing:0.02em; }
    .report-paper.rt-minimal-mono .es-paper-subtitle { color:#666; }
    .report-paper.rt-minimal-mono .es-section-h2 { color:#111; border-bottom:1px solid #333; }
    .report-paper.rt-minimal-mono .es-item-h3 { color:#333; }
    .report-paper.rt-minimal-mono .es-word-count { color:#666; }

    /* ---- ノート風（罫線・マーカー） ---- */
    .report-paper.rt-note-paper {
        background-color:#fffdf5;
        border-left:4px double #f87171;
        font-family:'Hiragino Maru Gothic ProN','Yu Gothic','Meiryo',sans-serif;
    }
    .report-paper.rt-note-paper .es-paper-title { color:#7c2d12; letter-spacing:0.06em; }
    .report-paper.rt-note-paper .es-paper-subtitle { color:#a16207; }
    .report-paper.rt-note-paper .es-section-h2 { color:#78350f; border-bottom:1px dashed #b45309; }
    .report-paper.rt-note-paper .es-section-h2 > span:first-child {
        background:linear-gradient(transparent 55%, #fde68a 55%);
        padding:0 6px;
    }
    .report-paper.rt-note-paper .es-item-h3 { color:#92400e; }
    .report-paper.rt-note-paper .es-word-count { color:#a16207; }
    .report-paper.rt-note-paper p.es-item-p {
        line-height:1.85;
        background-image:repeating-linear-gradient(transparent, transparent calc(1.85em - 1px), #e7dcc0 calc(1.85em - 1px), #e7dcc0 1.85em);
    }

    /* ---- ポップ（バイオレット×アンバー） ---- */
    .report-paper.rt-pop-badge .es-paper-title { color:#6d28d9; font-weight:800; }
    .report-paper.rt-pop-badge .es-paper-subtitle { color:#a78bfa; }
    .report-paper.rt-pop-badge .es-section-h2 {
        color:#fff; background:#7c3aed; border-bottom:none;
        padding:6px 16px; border-radius:999px;
    }
    .report-paper.rt-pop-badge .es-item-h3 {
        color:#6d28d9; border-left:4px solid #f59e0b; padding-left:8px;
    }
    .report-paper.rt-pop-badge .es-word-count { color:#ede9fe; }

    /* ---- エディトリアル（雑誌風・明朝） ---- */
    .report-paper.rt-editorial {
        background-color:#fbf9f4;
        font-family:'Yu Mincho','Hiragino Mincho ProN','Noto Serif JP','MS Mincho',serif;
    }
    .report-paper.rt-editorial .es-paper-header {
        border-top:3px solid #1a1a1a; border-bottom:1px solid #1a1a1a;
        padding:26px 0 14px 0; margin-bottom:36px;
    }
    .report-paper.rt-editorial .es-paper-title {
        color:#1a1a1a; font-weight:400; font-size:30px; letter-spacing:0.22em;
    }
    .report-paper.rt-editorial .es-paper-subtitle {
        color:#8a7f72; font-size:12px; letter-spacing:0.34em;
    }
    .report-paper.rt-editorial .es-section-h2 {
        color:#1a1a1a; font-weight:500; font-size:16px; letter-spacing:0.16em;
        border-bottom:1px solid #1a1a1a;
    }
    .report-paper.rt-editorial .es-section-h2 > span:first-child::before {
        content:"■"; color:#b45309; font-size:0.55em; margin-right:0.9em; vertical-align:middle;
    }
    .report-paper.rt-editorial .es-item-h3 { color:#9a3412; font-weight:600; letter-spacing:0.06em; }
    .report-paper.rt-editorial .es-word-count { color:#8a7f72; letter-spacing:0.08em; }
    .report-paper.rt-editorial p.es-item-p { color:#2b2b2b; line-height:2.05; }

    /* ---- ミッドナイト（ダーク×ネオン） ---- */
    .report-paper.rt-midnight {
        background-color:#0b1220; color:#cbd5e1; caret-color:#22d3ee;
        border-radius:10px;
        -webkit-print-color-adjust:exact; print-color-adjust:exact;
    }
    .report-paper.rt-midnight .es-paper-title {
        font-weight:800; letter-spacing:0.06em;
        background:linear-gradient(90deg,#67e8f9,#a78bfa);
        -webkit-background-clip:text; background-clip:text;
        color:transparent; -webkit-text-fill-color:transparent;
    }
    .report-paper.rt-midnight .es-paper-subtitle { color:#94a3b8; letter-spacing:0.22em; }
    .report-paper.rt-midnight .es-section-h2 {
        color:#f1f5f9; border-bottom:2px solid transparent;
        border-image:linear-gradient(90deg,#22d3ee,#a78bfa,transparent) 1;
    }
    .report-paper.rt-midnight .es-section-h2 > span:first-child { text-shadow:0 0 14px rgba(34,211,238,0.45); }
    .report-paper.rt-midnight .es-item-h3 { color:#67e8f9; }
    .report-paper.rt-midnight .es-word-count { color:#22d3ee; }
    .report-paper.rt-midnight p.es-item-p { color:#cbd5e1; }
    .report-paper.rt-midnight [style*="color:#64748b"] { color:#94a3b8 !important; }
    `;

    // Word出力用CSS（Wordは flex 等が使えないため単純な指定のみ）
    const THEME_WORD_CSS = {
        "classic-blue": "",
        "minimal-mono": `
            h1.es-paper-title { color:#111111; }
            p.es-paper-subtitle { color:#666666; }
            h2.es-section-h2 { color:#111111; border-bottom:1pt solid #333333; }
            h3.es-item-h3 { color:#333333; }
            .es-word-count { color:#666666; }`,
        "note-paper": `
            h1.es-paper-title { color:#7c2d12; }
            p.es-paper-subtitle { color:#a16207; }
            h2.es-section-h2 { color:#78350f; background:#fef3c7; border-bottom:1pt dashed #b45309; padding:2pt 6pt; }
            h3.es-item-h3 { color:#92400e; }
            .es-word-count { color:#a16207; }`,
        "pop-badge": `
            h1.es-paper-title { color:#6d28d9; }
            p.es-paper-subtitle { color:#a78bfa; }
            h2.es-section-h2 { color:#ffffff; background:#7c3aed; border-bottom:none; padding:3pt 10pt; }
            h3.es-item-h3 { color:#6d28d9; border-left:3pt solid #f59e0b; padding-left:6pt; }
            .es-word-count { color:#ede9fe; }`,
        "editorial": `
            body { font-family:'Yu Mincho','Hiragino Mincho ProN','MS Mincho',serif; }
            .es-paper-header { border-top:2.5pt solid #1a1a1a; border-bottom:0.75pt solid #1a1a1a; padding:14pt 0 8pt 0; }
            h1.es-paper-title { color:#1a1a1a; font-weight:normal; letter-spacing:0.15em; }
            p.es-paper-subtitle { color:#8a7f72; letter-spacing:0.25em; }
            h2.es-section-h2 { color:#1a1a1a; border-bottom:0.75pt solid #1a1a1a; }
            h3.es-item-h3 { color:#9a3412; }
            .es-word-count { color:#8a7f72; }`,
        "midnight": `
            h1.es-paper-title { color:#0f172a; }
            p.es-paper-subtitle { color:#64748b; letter-spacing:0.2em; }
            h2.es-section-h2 { color:#ffffff; background:#0f172a; border-bottom:none; border-left:4pt solid #22d3ee; padding:3pt 10pt; }
            h3.es-item-h3 { color:#0e7490; }
            .es-word-count { color:#67e8f9; }`
    };

    function injectThemeStyles() {
        if (document.getElementById("report-theme-styles")) return;
        const st = document.createElement("style");
        st.id = "report-theme-styles";
        st.textContent = THEME_PREVIEW_CSS;
        document.head.appendChild(st);
    }

    // 選択中テーマ（旧値 "pdf-elegant" や不明な値は classic-blue 扱い）
    function getCurrentTheme() {
        const v = document.getElementById("report-design-theme")?.value;
        return REPORT_THEMES[v] ? v : "classic-blue";
    }

    // ==========================================
    // タイトル・サブタイトル（例文表示）
    // ==========================================
    function setTitleExamples(title, subtitle) {
        exampleTitle = title;
        exampleSubtitle = subtitle;
        const t = document.getElementById("report-title");
        const s = document.getElementById("report-subtitle");
        if (t) { t.value = ""; t.placeholder = `例：${title}`; }
        if (s) { s.value = ""; s.placeholder = `例：${subtitle}`; }
    }

    // 未入力なら例文をタイトルとして使う（ファイル名・プレビュー用）
    function getReportTitle(fallback) {
        const v = document.getElementById("report-title")?.value.trim();
        return v || exampleTitle || fallback || "報告書";
    }

    // ==========================================
    // デフォルトセクション構成の取得
    // ==========================================
    function getDefaultSectionsForSource(source) {
        if (source === "schedules") {
            return [
                { id: "sec-1", title: "総評・成果" },
                { id: "sec-2", title: "今後の課題・次月への引き継ぎ" }
            ];
        } else if (source === "kadai") {
            return [
                { id: "sec-1", title: "学習成果と身についたスキル" },
                { id: "sec-2", title: "振り返りと今後の計画" }
            ];
        } else if (source === "tasks") {
            return [
                { id: "sec-1", title: "実績・成果" },
                { id: "sec-2", title: "所感・次のアクション" }
            ];
        } else {
            // custom (自由作成・会社研究・資料作成用)
            return [
                { id: "sec-1", title: "報告概要" },
                { id: "sec-2", title: "結果" },
                { id: "sec-3", title: "詳細" },
                { id: "sec-4", title: "考察" },
                { id: "sec-5", title: "課題" },
                { id: "sec-6", title: "所感" },
                { id: "sec-7", title: "特記事項" }
            ];
        }
    }

    // ==========================================
    // 初期化処理
    // ==========================================
    window.addEventListener("load", () => {
        injectThemeStyles();

        const today = new Date();
        const monthInput = document.getElementById("report-target-month");
        const dateInput = document.getElementById("report-date");

        if (monthInput) monthInput.value = toYearMonthKey(today);
        if (dateInput) dateInput.value = toDateKey(today);

        // URLパラメータのチェック
        const urlParams = new URLSearchParams(window.location.search);
        const sourceParam = urlParams.get("source");
        const periodParam = urlParams.get("period");

        if (periodParam === "3month") {
            const rad = document.querySelector('input[name="period-type"][value="3month"]');
            if (rad) rad.checked = true;
        } else if (periodParam === "all") {
            const rad = document.querySelector('input[name="period-type"][value="all"]');
            if (rad) rad.checked = true;
        }

        // ソース初期指定
        if (sourceParam && ["schedules", "kadai", "tasks", "custom"].includes(sourceParam)) {
            switchSource(sourceParam);
        } else {
            switchSource("schedules");
        }

        setupEventListeners();
    });

    // ==========================================
    // イベントリスナー設定
    // ==========================================
    function setupEventListeners() {
        // データソースタブ切替
        document.querySelectorAll(".source-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const src = tab.dataset.source;
                switchSource(src);
            });
        });

        // 期間タイプラジオ
        document.querySelectorAll('input[name="period-type"]').forEach(radio => {
            radio.addEventListener("change", updateItemListAndPreview);
        });

        // 基準年月
        const monthInput = document.getElementById("report-target-month");
        if (monthInput) {
            monthInput.addEventListener("change", updateItemListAndPreview);
        }

        // デザインスタイル変更
        const themeSelect = document.getElementById("report-design-theme");
        if (themeSelect) {
            themeSelect.addEventListener("change", renderPreview);
        }

        // 全選択・全解除ボタン
        const btnSelectAll = document.getElementById("btn-select-all");
        if (btnSelectAll) {
            btnSelectAll.addEventListener("click", () => {
                currentItems.forEach(item => selectedItemIds.add(String(item.id)));
                renderChecklist();
                renderPreview();
            });
        }

        const btnDeselectAll = document.getElementById("btn-deselect-all");
        if (btnDeselectAll) {
            btnDeselectAll.addEventListener("click", () => {
                selectedItemIds.clear();
                renderChecklist();
                renderPreview();
            });
        }

        // 基本情報フォーム変更時プレビュー更新
        ["report-title", "report-subtitle", "report-author", "report-dept", "report-date"].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener("input", renderPreview);
                el.addEventListener("change", renderPreview);
            }
        });

        // セクション追加ボタン
        const btnAddSec = document.getElementById("btn-add-section");
        if (btnAddSec) {
            btnAddSec.addEventListener("click", () => {
                const newId = "sec-" + Date.now();
                customSections.push({
                    id: newId,
                    title: "新規セクション",
                    content: ""
                });
                renderSectionEditors();
                renderPreview();
            });
        }

        // セクション初期化ボタン
        const btnResetSec = document.getElementById("btn-reset-sections");
        if (btnResetSec) {
            btnResetSec.addEventListener("click", () => {
                if (confirm("セクションの構成を初期設定に戻しますか？")) {
                    customSections = getDefaultSectionsForSource(currentSource);
                    renderSectionEditors();
                    renderPreview();
                }
            });
        }

        // プレビュー直接編集ON/OFFトグル
        const btnToggleEdit = document.getElementById("btn-toggle-edit");
        if (btnToggleEdit) {
            btnToggleEdit.addEventListener("click", () => {
                isDirectEditMode = !isDirectEditMode;
                applyDirectEditMode();
            });
        }

        // アクションボタン
        document.getElementById("btn-copy-report").addEventListener("click", copyReportToClipboard);
        document.getElementById("btn-download-word").addEventListener("click", downloadWordReport);
        document.getElementById("btn-download-txt").addEventListener("click", () => downloadReportFile("txt"));
        document.getElementById("btn-download-md").addEventListener("click", () => downloadReportFile("md"));
        document.getElementById("btn-print-report").addEventListener("click", () => window.print());
    }

    // ==========================================
    // データソースの切り替え処理
    // ==========================================
    function switchSource(sourceKey) {
        currentSource = sourceKey;

        // タブボタンのアクティブ切替
        document.querySelectorAll(".source-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.source === sourceKey);
        });

        const sourceSection = document.getElementById("section-source-selection");
        const checklistHeading = document.getElementById("checklist-heading");

        // 初期セクションの準備
        customSections = getDefaultSectionsForSource(sourceKey);

        if (sourceKey === "custom") {
            if (sourceSection) sourceSection.style.display = "none";
            setTitleExamples("会社研究・資料作成", "エントリーシート・面接対策資料");
            renderSectionEditors();
            renderPreview();
        } else {
            if (sourceSection) sourceSection.style.display = "block";

            if (sourceKey === "schedules") {
                if (checklistHeading) checklistHeading.textContent = "2. 報告する予定（カレンダー）の選択";
                setTitleExamples("業務活動報告書", "月次活動実績報告");
            } else if (sourceKey === "kadai") {
                if (checklistHeading) checklistHeading.textContent = "2. 報告する課題の選択";
                setTitleExamples("課題・学習実績報告書", "課題締切・提出進捗状況");
            } else if (sourceKey === "tasks") {
                if (checklistHeading) checklistHeading.textContent = "2. 報告するタスクの選択";
                setTitleExamples("タスク進捗・完了報告書", "タスク対応実績と進捗所感");
            }

            renderSectionEditors();
            updateItemListAndPreview();
        }
    }

    // ==========================================
    // 動的セクションエディタの描画
    // ==========================================
    function renderSectionEditors() {
        const container = document.getElementById("dynamic-sections-container");
        if (!container) return;

        container.innerHTML = "";

        if (customSections.length === 0) {
            container.innerHTML = `<p style="color:#64748b; font-size:13px;">セクションがありません。「＋ セクションを追加」ボタンから追加できます。</p>`;
            return;
        }

        customSections.forEach((sec, index) => {
            const card = document.createElement("div");
            card.className = "dynamic-section-card";

            const count = countCharacters(sec.content);

            card.innerHTML = `
                <div class="section-header-row">
                    <input type="text" class="section-title-input" value="${escapeHtml(sec.title)}" placeholder="セクション見出しを入力 (例: 自己PR、課題、方針など)">
                    <div class="section-controls">
                        <span class="char-counter-badge ${count > 0 ? "has-count" : ""}">${count} 文字</span>
                        <button type="button" class="btn-sub-sm btn-move-up" title="上へ移動">↑</button>
                        <button type="button" class="btn-sub-sm btn-move-down" title="下へ移動">↓</button>
                        <button type="button" class="btn-sub-sm btn-del" style="color:#dc2626;" title="このセクションを削除">✕</button>
                    </div>
                </div>
                <textarea class="section-textarea" rows="4" placeholder="本文を入力してください">${escapeHtml(sec.content)}</textarea>
            `;

            // タイトル変更
            const titleInput = card.querySelector(".section-title-input");
            titleInput.addEventListener("input", (e) => {
                sec.title = e.target.value;
                renderPreview();
            });

            // 本文変更
            const contentArea = card.querySelector(".section-textarea");
            const badge = card.querySelector(".char-counter-badge");
            contentArea.addEventListener("input", (e) => {
                sec.content = e.target.value;
                const newCount = countCharacters(sec.content);
                badge.textContent = `${newCount} 文字`;
                if (newCount > 0) badge.classList.add("has-count");
                else badge.classList.remove("has-count");
                renderPreview();
            });

            // 上へ
            card.querySelector(".btn-move-up").addEventListener("click", () => {
                if (index > 0) {
                    const temp = customSections[index - 1];
                    customSections[index - 1] = customSections[index];
                    customSections[index] = temp;
                    renderSectionEditors();
                    renderPreview();
                }
            });

            // 下へ
            card.querySelector(".btn-move-down").addEventListener("click", () => {
                if (index < customSections.length - 1) {
                    const temp = customSections[index + 1];
                    customSections[index + 1] = customSections[index];
                    customSections[index] = temp;
                    renderSectionEditors();
                    renderPreview();
                }
            });

            // 削除
            card.querySelector(".btn-del").addEventListener("click", () => {
                if (confirm(`「${sec.title || "セクション"}」を削除しますか？`)) {
                    customSections.splice(index, 1);
                    renderSectionEditors();
                    renderPreview();
                }
            });

            container.appendChild(card);
        });
    }

    // ==========================================
    // 期間計算 (カレンダー / 課題 / タスク)
    // ==========================================
    function calculatePeriodRange() {
        const periodTypeEl = document.querySelector('input[name="period-type"]:checked');
        const periodType = periodTypeEl ? periodTypeEl.value : "1month";
        const monthVal = document.getElementById("report-target-month")?.value || toYearMonthKey(new Date());

        const [yStr, mStr] = monthVal.split("-");
        const year = Number(yStr);
        const month = Number(mStr);

        let startDateStr = "";
        let endDateStr = "";

        if (periodType === "1month") {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            startDateStr = toDateKey(start);
            endDateStr = toDateKey(end);
        } else if (periodType === "3month") {
            const start = new Date(year, month - 3, 1);
            const end = new Date(year, month, 0);
            startDateStr = toDateKey(start);
            endDateStr = toDateKey(end);
        } else {
            // all
            startDateStr = "2000-01-01";
            endDateStr = "2099-12-31";
        }

        return {
            type: periodType,
            start: startDateStr,
            end: endDateStr,
            monthLabel: periodType === "all" ? "全期間" : (periodType === "1month" ? `${year}年${month}月` : `${startDateStr} ～ ${endDateStr}`)
        };
    }

    // ==========================================
    // 項目一覧の更新・描画 (カレンダー・課題・タスク)
    // ==========================================
    function updateItemListAndPreview() {
        if (currentSource === "custom") {
            renderPreview();
            return;
        }

        const range = calculatePeriodRange();
        const badge = document.getElementById("selected-period-display");
        if (badge) {
            badge.textContent = `対象期間: ${range.type === "all" ? "全期間" : range.start + " ～ " + range.end} (${range.type === "1month" ? "1か月" : range.type === "3month" ? "3か月" : "全期間"})`;
        }

        if (currentSource === "schedules") {
            const all = getSchedules();
            const todayKey = getTodayKey();
            currentItems = all.filter(s => {
                if (!s || !s.startDate || !s.endDate) return false;
                if (range.type === "all") return true;
                const isPast = s.endDate <= todayKey;
                const overlaps = s.startDate <= range.end && s.endDate >= range.start;
                return isPast && overlaps;
            });
            currentItems.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));

        } else if (currentSource === "kadai") {
            const { active, completed } = getKadaiTasks();
            const allKadai = completed.concat(active);
            currentItems = allKadai.filter(k => {
                if (!k) return false;
                if (range.type === "all") return true;
                const dateKey = k.deadline || k.completedAt || k.createdAt;
                if (!dateKey) return true;
                const dateOnly = dateKey.split("T")[0];
                return dateOnly >= range.start && dateOnly <= range.end;
            });
            currentItems.sort((a, b) => {
                const da = a.completedAt || a.deadline || "";
                const db = b.completedAt || b.deadline || "";
                return db.localeCompare(da);
            });

        } else if (currentSource === "tasks") {
            const { active, completed } = getTodoTasks();
            const allTasks = completed.concat(active);
            currentItems = allTasks.filter(t => {
                if (!t) return false;
                if (range.type === "all") return true;
                const dateKey = t.completedAt || t.createdAt;
                if (!dateKey) return true;
                const dateOnly = dateKey.split("T")[0];
                return dateOnly >= range.start && dateOnly <= range.end;
            });
            currentItems.sort((a, b) => {
                const da = a.completedAt || a.createdAt || "";
                const db = b.completedAt || b.createdAt || "";
                return db.localeCompare(da);
            });
        }

        // 初期状態はすべて選択
        selectedItemIds = new Set(currentItems.map(item => String(item.id)));

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
            badge.textContent = `${selectedItemIds.size} / ${currentItems.length}件 選択中`;
        }

        if (currentItems.length === 0) {
            container.innerHTML = `<div class="no-schedules-msg">指定期間に該当するデータはありません。</div>`;
            return;
        }

        currentItems.forEach(item => {
            const isChecked = selectedItemIds.has(String(item.id));
            const label = document.createElement("label");
            label.className = `schedule-check-item ${isChecked ? "checked" : ""}`;

            let titleStr = "";
            let metaStr = "";
            let descStr = "";

            if (currentSource === "schedules") {
                titleStr = item.title || "無題の予定";
                const timeStr = item.allDay ? " (終日)" : (item.startTime ? ` (${item.startTime}～${item.endTime || ""})` : "");
                const dateDisplay = item.startDate === item.endDate ? item.startDate : `${item.startDate} ～ ${item.endDate}`;
                metaStr = `📅 ${dateDisplay}${timeStr} ${item.partner ? `| 👤 ${escapeHtml(item.partner)}` : ""} ${item.location ? `| 📍 ${escapeHtml(item.location)}` : ""}`;
                descStr = item.description || "";
            } else if (currentSource === "kadai") {
                titleStr = item.title || item.name || "無題の課題";
                const subject = item.subject ? `[${item.subject}] ` : "";
                const isDone = item.completedAt ? "🟢 完了済み" : "🟡 未完了";
                const dl = item.deadline ? `締切: ${item.deadline}` : "締切なし";
                metaStr = `📚 ${subject}${isDone} | 📅 ${dl}`;
                descStr = item.detail || "";
            } else if (currentSource === "tasks") {
                titleStr = item.content || item.title || "無題のタスク";
                const isDone = item.completedAt ? "🟢 完了" : "🟡 未完了";
                const prio = item.priority ? `優先度: ${item.priority}` : "";
                const compDate = item.completedAt ? `完了日: ${item.completedAt.split("T")[0]}` : "";
                metaStr = `✅ ${isDone} ${prio ? `| ${prio}` : ""} ${compDate ? `| ${compDate}` : ""}`;
                descStr = item.detail || "";
            }

            label.innerHTML = `
                <input type="checkbox" value="${item.id}" ${isChecked ? "checked" : ""}>
                <div class="check-item-info">
                    <span class="check-item-title">${escapeHtml(titleStr)}</span>
                    <span class="check-item-meta">${metaStr}</span>
                    ${descStr ? `<span class="check-item-desc">${escapeHtml(descStr)}</span>` : ""}
                </div>
            `;

            const chk = label.querySelector('input[type="checkbox"]');
            chk.addEventListener("change", (e) => {
                if (e.target.checked) {
                    selectedItemIds.add(String(item.id));
                    label.classList.add("checked");
                } else {
                    selectedItemIds.delete(String(item.id));
                    label.classList.remove("checked");
                }
                if (badge) {
                    badge.textContent = `${selectedItemIds.size} / ${currentItems.length}件 選択中`;
                }
                renderPreview();
            });

            container.appendChild(label);
        });
    }

    function getSelectedObjects() {
        return currentItems.filter(item => selectedItemIds.has(String(item.id)));
    }

    // ==========================================
    // 報告書HTMLの生成
    // ==========================================
    function buildReportHTML() {
        const title = getReportTitle("報告書");
        const subtitle = document.getElementById("report-subtitle")?.value.trim() || ""; // 空なら非表示
        const author = document.getElementById("report-author")?.value.trim() || "";
        const dept = document.getElementById("report-dept")?.value.trim() || "";
        const date = document.getElementById("report-date")?.value || getTodayKey();
        const range = calculatePeriodRange();

        const selected = getSelectedObjects();

        // 1. ヘッダー部（中央揃えタイトル、サブタイトル）
        let headerMeta = [];
        if (date) headerMeta.push(`作成日: ${date}`);
        if (author) headerMeta.push(`作成者: ${author}${dept ? ` (${dept})` : ""}`);
        if (currentSource !== "custom" && range.monthLabel) headerMeta.push(`対象期間: ${range.monthLabel}`);
        const metaLine = headerMeta.join("　|　");

        let html = `
            <div class="es-paper-header">
                <h1 class="es-paper-title">${escapeHtml(title)}</h1>
                ${subtitle ? `<p class="es-paper-subtitle">${escapeHtml(subtitle)}</p>` : ""}
                ${metaLine ? `<p style="text-align:center; font-size:12px; color:#64748b; margin:-18px 0 28px 0;">${escapeHtml(metaLine)}</p>` : ""}
            </div>
        `;

        // 2. カレンダー・課題・タスクの項目一覧セクション
        if (currentSource !== "custom") {
            let sectionTitle = "実施内容・実績一覧";
            if (currentSource === "schedules") sectionTitle = "予定・活動実施一覧";
            else if (currentSource === "kadai") sectionTitle = "課題・学習実績一覧";
            else if (currentSource === "tasks") sectionTitle = "タスク完了・進捗一覧";

            let itemsBodyHtml = "";
            if (selected.length === 0) {
                itemsBodyHtml = `<p class="es-item-p" style="color:#94a3b8;">選択された項目はありません。</p>`;
            } else {
                itemsBodyHtml = selected.map((item, idx) => {
                    if (currentSource === "schedules") {
                        const timeStr = item.allDay ? " (終日)" : (item.startTime ? ` (${item.startTime}～${item.endTime || ""})` : "");
                        const dateDisplay = item.startDate === item.endDate ? item.startDate : `${item.startDate} ～ ${item.endDate}`;
                        const meta = [item.partner ? `相手: ${item.partner}` : "", item.location ? `場所: ${item.location}` : ""].filter(Boolean).join(" | ");
                        return `
                            <h3 class="es-item-h3">${idx + 1}. ${escapeHtml(item.title || "予定")}</h3>
                            <p class="es-item-p" style="margin:2px 0 4px 0; color:#64748b; font-size:12.5px;">📅 ${dateDisplay}${timeStr} ${meta ? `| ${escapeHtml(meta)}` : ""}</p>
                            ${item.description ? `<p class="es-item-p">${escapeHtml(item.description)}</p>` : ""}
                        `;
                    } else if (currentSource === "kadai") {
                        const status = item.completedAt ? "🟢 完了済み" : "🟡 未完了";
                        const dl = item.deadline ? `締切: ${item.deadline}` : "締切なし";
                        const comp = item.completedAt ? `完了日: ${item.completedAt.split("T")[0]}` : "";
                        return `
                            <h3 class="es-item-h3">${idx + 1}. ${escapeHtml(item.subject ? `[${item.subject}] ` : "")}${escapeHtml(item.title || item.name || "課題")} (${status})</h3>
                            <p class="es-item-p" style="margin:2px 0 4px 0; color:#64748b; font-size:12.5px;">📅 ${dl} ${comp ? `| ${comp}` : ""}</p>
                            ${item.detail ? `<p class="es-item-p">${escapeHtml(item.detail)}</p>` : ""}
                        `;
                    } else {
                        // tasks
                        const status = item.completedAt ? "🟢 完了" : "🟡 未完了";
                        const prio = item.priority ? `優先度: ${item.priority}` : "";
                        const comp = item.completedAt ? `完了日: ${item.completedAt.split("T")[0]}` : "";
                        return `
                            <h3 class="es-item-h3">${idx + 1}. ${escapeHtml(item.content || item.title || "タスク")} (${status} ${prio})</h3>
                            ${comp ? `<p class="es-item-p" style="margin:2px 0 4px 0; color:#64748b; font-size:12.5px;">📅 ${comp}</p>` : ""}
                            ${item.detail ? `<p class="es-item-p">${escapeHtml(item.detail)}</p>` : ""}
                        `;
                    }
                }).join("");
            }

            html += `
                <div class="es-section-block">
                    <h2 class="es-section-h2">
                        <span>${escapeHtml(sectionTitle)}</span>
                        <span class="es-word-count">（ ${selected.length} 件 ）</span>
                    </h2>
                    ${itemsBodyHtml}
                </div>
            `;
        }

        // 3. ユーザーが書き込み・編集した動的セクション群
        // 見出し＋下線＋右端に「（ ○○ 文字 ）」
        customSections.forEach((sec, idx) => {
            const secTitle = sec.title ? sec.title.trim() : `セクション ${idx + 1}`;
            const count = countCharacters(sec.content);
            const contentHtml = sec.content
                ? escapeHtml(sec.content).replace(/\n/g, "<br>")
                : `<span style="color:#94a3b8;">（ここに直接クリックして書き込みできます）</span>`;

            html += `
                <div class="es-section-block">
                    <h2 class="es-section-h2">
                        <span>${escapeHtml(secTitle)}</span>
                        ${count > 0 ? `<span class="es-word-count">（ ${count} 文字 ）</span>` : ""}
                    </h2>
                    <p class="es-item-p">${contentHtml}</p>
                </div>
            `;
        });

        return html;
    }

    // ==========================================
    // プレビュー表示更新 & 直接編集設定
    // ==========================================
    function renderPreview() {
        const container = document.getElementById("report-preview-container");
        if (!container) return;

        const html = buildReportHTML();

        container.innerHTML = `
            <div id="editable-report-paper" class="report-paper es-theme rt-${getCurrentTheme()}" contenteditable="${isDirectEditMode ? "true" : "false"}" spellcheck="false">
                ${html}
            </div>
        `;

        applyDirectEditMode();
    }

    function applyDirectEditMode() {
        const paper = document.getElementById("editable-report-paper");
        const btn = document.getElementById("btn-toggle-edit");
        if (paper) {
            paper.setAttribute("contenteditable", isDirectEditMode ? "true" : "false");
        }
        if (btn) {
            if (isDirectEditMode) {
                btn.classList.add("active");
                btn.textContent = "✏️ 直接編集: ON";
                btn.title = "プレビュー内の文字を直接クリックして書き込み・修正できます";
            } else {
                btn.classList.remove("active");
                btn.textContent = "🔒 直接編集: OFF";
                btn.title = "プレビューを読み取り専用に固定します";
            }
        }
    }

    function getPreviewCurrentHTML() {
        const paper = document.getElementById("editable-report-paper");
        if (paper) {
            return paper.innerHTML;
        }
        return buildReportHTML();
    }

    function getPreviewCurrentText() {
        const paper = document.getElementById("editable-report-paper");
        if (paper) {
            return paper.innerText || paper.textContent || "";
        }
        return "";
    }

    // ==========================================
    // Word (.doc) ファイル出力（選択中デザインを反映）
    // ==========================================
    function downloadWordReport() {
        const innerContent = getPreviewCurrentHTML();
        const title = getReportTitle("資料");
        const date = document.getElementById("report-date")?.value || getTodayKey();
        const filename = `${title}_${date}.doc`;

        // Microsoft Word 互換 HTML / MHTML
        const wordHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset='utf-8'>
    <title>${escapeHtml(title)}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4 portrait;
            margin: 25mm 25mm 25mm 25mm;
            mso-page-orientation: portrait;
        }
        body {
            font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'MS Gothic', sans-serif;
            font-size: 11pt;
            line-height: 1.85;
            color: #2c3e50;
            margin: 0;
            padding: 0;
        }
        .es-paper-header {
            text-align: center;
            margin-bottom: 24pt;
        }
        h1.es-paper-title {
            font-size: 20pt;
            font-weight: bold;
            text-align: center;
            color: #1b2631;
            margin: 0 0 6pt 0;
            letter-spacing: 0.05em;
        }
        p.es-paper-subtitle {
            font-size: 11pt;
            text-align: center;
            color: #7f8c8d;
            margin: 0 0 16pt 0;
            letter-spacing: 0.08em;
        }
        .es-section-block {
            margin-bottom: 24pt;
            page-break-inside: avoid;
        }
        h2.es-section-h2 {
            font-size: 14pt;
            font-weight: bold;
            color: #1a5276;
            border-bottom: 2pt solid #2980b9;
            padding-bottom: 4pt;
            margin: 20pt 0 10pt 0;
            display: flex;
            justify-content: space-between;
        }
        .es-word-count {
            font-size: 11pt;
            font-weight: normal;
            color: #2c3e50;
            float: right;
        }
        h3.es-item-h3 {
            font-size: 11.5pt;
            font-weight: bold;
            color: #2471a3;
            margin: 12pt 0 4pt 0;
        }
        p.es-item-p {
            font-size: 10.5pt;
            color: #2c3e50;
            margin: 4pt 0 10pt 0;
            text-align: justify;
        }
        ${THEME_WORD_CSS[getCurrentTheme()] || ""}
    </style>
</head>
<body>
    ${innerContent}
</body>
</html>
`;

        const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // クリップボードへコピー
    // ==========================================
    function copyReportToClipboard() {
        const text = getPreviewCurrentText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                alert("資料の内容（直接編集分を含む）をクリップボードにコピーしました！");
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
            alert("資料の内容をクリップボードにコピーしました！");
        } catch (err) {
            alert("コピーに失敗しました。手動でコピーしてください。");
        }
        document.body.removeChild(textArea);
    }

    // ==========================================
    // ファイルダウンロード (.txt または .md)
    // ==========================================
    function downloadReportFile(extension) {
        const text = getPreviewCurrentText();
        const title = getReportTitle("資料");
        const date = document.getElementById("report-date")?.value || getTodayKey();
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