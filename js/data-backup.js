/* =========================================================
   MyNote - ワンクリック全データ・バックアップ & 復元 (data-backup.js)
   ---------------------------------------------------------
   ・全ローカルストレージデータのJSON一括エクスポート
   ・JSONファイルからの安全なインポート・復元
   ・Supabase クラウド同期への自動連携
   ========================================================= */

(function () {
    "use strict";

    const BACKUP_KEYS = [
        "tasks",
        "completedTasks",
        "deletedTasks",
        "todoTasks",
        "todoCompleted",
        "todoDeleted",
        "schedules",
        "deletedSchedules",
        "secret_base_schedules",
        "habitTasks",
        "habitCompleted",
        "habitDeleted",
        "habitDailyHistory",
        "habitLastDate",
        "birthdays",
        "deletedBirthdays",
        "ideaItems",
        "ideaDeleted",
        "wishItems",
        "wishDeleted",
        "wishPartnerFilter",
        "weeklyHistory",
        "custom_features",
        "mynote_user_theme"
    ];

    // 全データ収集
    function collectAllData() {
        const payload = {};
        BACKUP_KEYS.forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw !== null) {
                try {
                    payload[key] = JSON.parse(raw);
                } catch (e) {
                    payload[key] = raw;
                }
            } else {
                payload[key] = null;
            }
        });

        return {
            appName: "MyNote",
            version: "1.0.0",
            exportedAt: new Date().toISOString(),
            data: payload
        };
    }

    // データ件数サマリー
    function getDataSummary() {
        const parseLen = key => {
            try {
                const val = JSON.parse(localStorage.getItem(key));
                return Array.isArray(val) ? val.length : (val ? 1 : 0);
            } catch (e) {
                return 0;
            }
        };

        return {
            tasks: parseLen("tasks"),
            todo: parseLen("todoTasks"),
            habits: parseLen("habitTasks"),
            schedules: parseLen("schedules"),
            birthdays: parseLen("birthdays"),
            ideas: parseLen("ideaItems"),
            wishes: parseLen("wishItems")
        };
    }

    // JSON ダウンロード実行
    function exportJSON() {
        const fullData = collectAllData();
        const jsonStr = JSON.stringify(fullData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });

        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const h = String(now.getHours()).padStart(2, "0");
        const mi = String(now.getMinutes()).padStart(2, "0");
        const filename = `MyNote_Backup_${y}${m}${d}_${h}${mi}.json`;

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    // JSON インポート実行
    function importJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error("ファイルが選択されていません。"));

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (!parsed || !parsed.data) {
                        return reject(new Error("MyNoteのバックアップファイル形式と一致しません。"));
                    }

                    const data = parsed.data;
                    const updatedKeys = [];

                    Object.keys(data).forEach(key => {
                        if (BACKUP_KEYS.includes(key)) {
                            const val = data[key];
                            if (val !== null && val !== undefined) {
                                const valStr = typeof val === "string" ? val : JSON.stringify(val);
                                localStorage.setItem(key, valStr);
                                updatedKeys.push(key);
                            }
                        }
                    });

                    // Supabase同期キューに追加
                    if (window.dbSync && typeof window.dbSync.queueSync === "function") {
                        updatedKeys.forEach(k => window.dbSync.queueSync(k));
                    }

                    // グローバル同期イベント発火
                    window.dispatchEvent(new CustomEvent("myNoteDataSynced"));

                    resolve({ count: updatedKeys.length, exportedAt: parsed.exportedAt });
                } catch (err) {
                    reject(new Error("JSONファイルの解析に失敗しました: " + err.message));
                }
            };
            reader.onerror = () => reject(new Error("ファイルの読み込み中にエラーが発生しました。"));
            reader.readAsText(file);
        });
    }

    // ── モーダルUI構築 ────────────────────────────────────
    function createModalDOM() {
        if (document.getElementById("backup-modal-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "backup-modal-overlay";
        overlay.className = "backup-modal-overlay";

        overlay.innerHTML = `
            <div class="backup-modal-card">
                <div class="backup-modal-header">
                    <h3>📦 データバックアップ & 復元</h3>
                    <button class="backup-modal-close-btn" id="backup-modal-close" aria-label="閉じる">&times;</button>
                </div>
                <div class="backup-modal-body">
                    <!-- データ件数統計 -->
                    <div class="backup-stats-box">
                        <div class="backup-stats-title">📊 現在の保存データ状況</div>
                        <div class="backup-stats-grid" id="backup-stats-grid">
                            <!-- 動的挿入 -->
                        </div>
                    </div>

                    <!-- エクスポート -->
                    <div class="backup-section-action">
                        <div class="backup-section-title">⬇️ データを保存（エクスポート）</div>
                        <p class="backup-section-desc">
                            課題・タスク・習慣・予定・誕生日・メモなど、すべてのデータをJSONファイルとしてダウンロードします。端末の引っ越しや定期保存にご利用ください。
                        </p>
                        <button class="backup-btn-export" id="btn-do-export">
                            📥 今すぐバックアップを保存 (JSON)
                        </button>
                    </div>

                    <hr style="border:none; border-top:1px solid #e2e8f0; margin:4px 0;">

                    <!-- インポート -->
                    <div class="backup-section-action">
                        <div class="backup-section-title">⬆️ データを復元（インポート）</div>
                        <p class="backup-section-desc">
                            過去に保存したバックアップJSONファイルを選択して、データを復元します。
                        </p>
                        <div class="backup-dropzone" id="backup-dropzone">
                            <span class="backup-dropzone-icon">📂</span>
                            <span class="backup-dropzone-text">クリックまたはファイルをドラッグ＆ドロップ</span>
                            <span class="backup-dropzone-sub">.json ファイルのみ</span>
                            <input type="file" id="backup-file-input" class="backup-file-input" accept=".json">
                        </div>
                        <div id="backup-status-msg" class="backup-status-msg"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // イベント設定
        const closeBtn = document.getElementById("backup-modal-close");
        closeBtn.addEventListener("click", closeModal);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal();
        });

        document.getElementById("btn-do-export").addEventListener("click", () => {
            exportJSON();
            showStatus("バックアップファイルをダウンロードしました！", true);
        });

        const dropzone = document.getElementById("backup-dropzone");
        const fileInput = document.getElementById("backup-file-input");

        dropzone.addEventListener("click", () => fileInput.click());

        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });

        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileImport(e.dataTransfer.files[0]);
            }
        });

        fileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileImport(e.target.files[0]);
            }
        });
    }

    function handleFileImport(file) {
        if (!confirm(`バックアップファイル「${file.name}」からデータを復元しますか？\n（現在のデータはバックアップの内容で更新されます）`)) {
            return;
        }

        importJSON(file)
            .then(res => {
                showStatus(`復元が完了しました！（${res.count} 個のデータ項目を更新）`, true);
                updateStatsUI();
                if (typeof window.renderTodayDashboard === "function") {
                    window.renderTodayDashboard();
                }
            })
            .catch(err => {
                showStatus(err.message, false);
            });
    }

    function showStatus(text, isSuccess) {
        const msg = document.getElementById("backup-status-msg");
        if (!msg) return;
        msg.textContent = text;
        msg.className = `backup-status-msg ${isSuccess ? "success" : "error"}`;
        setTimeout(() => {
            if (msg) msg.style.display = "none";
        }, 5000);
    }

    function updateStatsUI() {
        const grid = document.getElementById("backup-stats-grid");
        if (!grid) return;
        const s = getDataSummary();
        grid.innerHTML = `
            <div class="backup-stat-chip"><span>📚 課題</span><span>${s.tasks}件</span></div>
            <div class="backup-stat-chip"><span>✅ タスク</span><span>${s.todo}件</span></div>
            <div class="backup-stat-chip"><span>🔥 習慣</span><span>${s.habits}件</span></div>
            <div class="backup-stat-chip"><span>📅 予定</span><span>${s.schedules}件</span></div>
            <div class="backup-stat-chip"><span>🎂 誕生日</span><span>${s.birthdays}件</span></div>
            <div class="backup-stat-chip"><span>💡 アイデア</span><span>${s.ideas}件</span></div>
            <div class="backup-stat-chip"><span>✨ やりたいこと</span><span>${s.wishes}件</span></div>
        `;
    }

    function openModal() {
        createModalDOM();
        updateStatsUI();
        const overlay = document.getElementById("backup-modal-overlay");
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        const overlay = document.getElementById("backup-modal-overlay");
        if (overlay) {
            overlay.classList.remove("open");
            document.body.style.overflow = "";
        }
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });

    // 公開API
    window.MyNoteBackup = {
        exportJSON,
        importJSON,
        openModal,
        closeModal,
        getDataSummary
    };
})();
