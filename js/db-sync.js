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
        "ideas",
        "deletedIdeas",
        "habitTasks",
        "habitCompleted",
        "habitDeleted",
        "habitDailyHistory",
        "habitLastDate",
        "wishlist",
        "completedWishlist",
        "deletedWishlist",
        "birthdays",
        "deletedBirthdays",
        "kadaiList"
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
                data.forEach(item => {
                    if (item.data_key && item.content !== undefined) {
                        const valStr = typeof item.content === "string" ? item.content : JSON.stringify(item.content);
                        localStorage.setItem(item.data_key, valStr);
                    }
                });
                console.log("クラウドデータの同期が完了しました。");
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
            const rawVal = localStorage.getItem(key);
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

    window.MyNoteDBSync = {
        pullCloudData,
        pushCloudData,
        queueSync,
        migrateLocalDataToCloud,
        DATA_KEYS
    };
})();
