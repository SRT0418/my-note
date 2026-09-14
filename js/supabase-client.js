/* =========================================================
   MyNote Supabase クライアント設定 (supabase-client.js)
   ---------------------------------------------------------
   ・SupabaseのURLとAnon Keyを設定します。
   ・Supabase JS SDK (@supabase/supabase-js) の初期化を行います。
   ========================================================= */

(function () {
    "use strict";

    // 以下の設定項目をご自身のSupabaseプロジェクトのURLとAnon Keyに置き換えてください
    const SUPABASE_URL = window.MYNOTE_SUPABASE_URL || "https://oalbriraykbaftxcznjx.supabase.co";
    const SUPABASE_ANON_KEY = window.MYNOTE_SUPABASE_ANON_KEY || "sb_publishable_pD_-4S0VWqb6ErDB1-Eong_6u8SnfEB";

    let supabaseInstance = null;

    function initSupabase() {
        if (supabaseInstance) return supabaseInstance;

        if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
            console.warn("Supabase SDKが読み込まれていません。");
            return null;
        }

        if (SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL" || !SUPABASE_URL) {
            console.warn("Supabase URLが設定されていません。supabase-client.js を編集してください。");
            return null;
        }

        try {
            supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            return supabaseInstance;
        } catch (e) {
            console.error("Supabase クライアント初期化エラー:", e);
            return null;
        }
    }

    window.MyNoteSupabase = {
        getClient: initSupabase,
        isConfigured: function () {
            return (
                SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL" &&
                SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY" &&
                typeof window.supabase !== "undefined" &&
                window.supabase.createClient
            );
        }
    };
})();
