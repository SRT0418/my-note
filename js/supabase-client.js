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
    const SUPABASE_ANON_KEY = window.MYNOTE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hbGJyaXJheWtiYWZ0eGN6bmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzAxNTYsImV4cCI6MjEwNDk0NjE1Nn0.t-n_MygaJb_RgLfDVAZjagUr8RKjsHEpv0dNuAGea2E";

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
            // auth.js の localStorage フック（名前空間化）をバイパスするため
            // Supabase SDK には生の localStorage メソッドを使うカスタムストレージを渡す
            const _rawGet    = function(k) { return Object.getPrototypeOf(localStorage).getItem.call(localStorage, k); };
            const _rawSet    = function(k, v) { return Object.getPrototypeOf(localStorage).setItem.call(localStorage, k, v); };
            const _rawRemove = function(k) { return Object.getPrototypeOf(localStorage).removeItem.call(localStorage, k); };

            supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    storage: {
                        getItem:    function(key) { return _rawGet(key); },
                        setItem:    function(key, value) { return _rawSet(key, value); },
                        removeItem: function(key) { return _rawRemove(key); }
                    },
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
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
