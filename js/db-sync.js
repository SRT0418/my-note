/* =========================================================
   MyNote クラウド同期 & データ管理 (db-sync.js)
   ---------------------------------------------------------
   ・localStorage と Supabase `user_data` テーブル間の自動双方向同期。
   ・端末ローカルで即座に高速表示しつつ、バックグラウンドでクラウドへ同期。
   ========================================================= */

(function () {
    "use strict";

    const DATA_KEYS = [
        "todoTasks",
        "todoCompleted",
        "todoDeleted",
        "schedules",
        "deletedSchedules",
        "secret_base_schedules",
        "ideaItems",
        "ideaDeleted",
        "habitTasks",
        "habitCompleted",
        "habitDeleted",
        "habitDailyHistory",
        "habitLastDate",
        "wishItems",
        "wishDeleted",
        "wishPartnerFilter",
        "birthdays",
        "deletedBirthdays",
        "tasks",
        "completedTasks",
        "deletedTasks",
        "weeklyHistory"
    ];

    let syncTimer = null;
    const pendingKeys = new Set();

    function isValidUUID(uuid) {
        return typeof uuid === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    }

    // Supabaseからユーザーデータを取得してlocalStorageに反映
    async function pullCloudData(userId) {
        const client = window.MyNoteSupabase ? window.MyNoteSupabase.getClient() : null;
        if (!client || !isValidUUID(userId)) return;

        try {
            const { data, error } = await client
                .from("user_data")
                .select("data_key, content")
                .eq("user_id", userId);

            if (error) {
                console.error("クラウドデータの読み込みエラー:", error);
                return;
            }

            if (data && data.length > 0) {
                let updatedAny = false;
                data.forEach(item => {
                    if (item.data_key && item.content !== undefined) {
                        const valStr = typeof item.content === "string" ? item.content : JSON.stringify(item.content);
                        if (localStorage.getItem(item.data_key) !== valStr) {
                            localStorage.setItem(item.data_key, valStr);
                            updatedAny = true;
                        }
                    }
                });
                console.log("クラウドデータの同期が完了しました。");

                // クラウドデータの引き込みによってデータが更新された場合、画面を自動再描画
                if (updatedAny) {
                    window.dispatchEvent(new CustomEvent("myNoteDataSynced"));
                    // 各ページの初期表示関数が存在すれば再呼び出し
                    if (typeof window.renderAll === "function") window.renderAll();           // everydayTask
                    else if (typeof window.renderTodoAll === "function") window.renderTodoAll();  // tasks
                    else if (typeof window.renderKadai === "function") window.renderKadai();  // kadai
                    else if (typeof window.renderIdeasAll === "function") window.renderIdeasAll(); // ideas
                    else if (typeof window.renderWishAll === "function") window.renderWishAll();   // wishlist
                    else if (typeof window.renderCalendar === "function") window.renderCalendar(); // calendar
                }
            }
        } catch (e) {
            console.error("データ引き込み中の例外:", e);
        }
    }

    // 特定のキー、または変更のあったキーをSupabaseへプッシュ
    async function pushCloudData(userId, keysToPush) {
        const client = window.MyNoteSupabase ? window.MyNoteSupabase.getClient() : null;
        if (!client || !isValidUUID(userId) || keysToPush.length === 0) return;

        const payload = [];
        keysToPush.forEach(key => {
            let rawVal = localStorage.getItem(key);

            // もし現在の名前空間に無い場合、素のキーまたは端末内の過去プレフィックスキーから検索
            if (rawVal === null) {
                rawVal = Storage.prototype.getItem.call(localStorage, key);
                if (rawVal === null) {
                    for (let i = 0; i < localStorage.length; i++) {
                        const lKey = localStorage.key(i);
                        if (lKey && lKey.endsWith(":" + key)) {
                            rawVal = Storage.prototype.getItem.call(localStorage, lKey);
                            if (rawVal !== null) break;
                        }
                    }
                }
            }

            if (rawVal !== null) {
                let parsed;
                try {
                    parsed = JSON.parse(rawVal);
                } catch (e) {
                    parsed = rawVal;
                }
                payload.push({
                    user_id: userId,
                    data_key: key,
                    content: parsed,
                    updated_at: new Date().toISOString()
                });
            }
        });

        if (payload.length === 0) return;

        try {
            const { error } = await client
                .from("user_data")
                .upsert(payload, { onConflict: "user_id,data_key" });

            if (error) {
                console.error("クラウド保存エラー:", error);
            }
        } catch (e) {
            console.error("クラウド保存例外:", e);
        }
    }

    // 変更のあったキーをキューに貯めてデバウンス送信
    function queueSync(key) {
        if (DATA_KEYS.indexOf(key) === -1) return;
        pendingKeys.add(key);

        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            const user = window.MyNoteAuth ? window.MyNoteAuth.getCurrentUser() : null;
            const userId = window.MyNoteAuth ? window.MyNoteAuth.getCurrentUserId() : null;
            if (userId) {
                const keys = Array.from(pendingKeys);
                pendingKeys.clear();
                pushCloudData(userId, keys);
            }
        }, 1000);
    }

    // 初回移行: localDataにデータがあってSupabaseにまだ無い場合一括プッシュ
    async function migrateLocalDataToCloud(userId) {
        const client = window.MyNoteSupabase ? window.MyNoteSupabase.getClient() : null;
        if (!client || !isValidUUID(userId)) return;

        const keysToMigrate = [];
        DATA_KEYS.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                keysToMigrate.push(key);
            }
        });

        if (keysToMigrate.length > 0) {
            await pushCloudData(userId, keysToMigrate);
        }
    }

    // ページ読み込み時に全自動でクラウド同期(引き込み&全キー送信)を行う
    async function autoSync() {
        const auth = window.MyNoteAuth;
        if (!auth) return;
        let userId = auth.getCurrentUserId();

        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client && client.auth && (!userId || !isValidUUID(userId))) {
            try {
                const { data } = await client.auth.getUser();
                if (data && data.user && data.user.id) {
                    userId = data.user.id;
                }
            } catch (e) {
                console.warn("SupabaseユーザーID取得スキップ:", e);
            }
        }

        if (userId && isValidUUID(userId)) {
            await pullCloudData(userId);
            // 存在する全データキーをクラウドへプッシュ
            const keysToPush = DATA_KEYS.filter(k => localStorage.getItem(k) !== null);
            if (keysToPush.length > 0) {
                await pushCloudData(userId, keysToPush);
            }
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoSync);
    } else {
        autoSync();
    }

    window.MyNoteDBSync = {
        pullCloudData,
        pushCloudData,
        queueSync,
        migrateLocalDataToCloud,
        autoSync,
        DATA_KEYS
    };
})();
