/* =========================================================
   MyNote 機能定義 & カスタマイズ管理 (features.js)
   ---------------------------------------------------------
   ・全機能メタデータ定義
   ・ユーザーのカスタマイズ（有効機能）取得・保存
   ・ナビゲーションメニューやホーム画面への動的反映
   ========================================================= */

(function () {
    "use strict";

    const STORAGE_KEY = "custom_features";

    const ALL_FEATURES = [
        {
            id: "kadai",
            name: "課題締切管理",
            icon: "📚",
            url: "kadai.html",
            desc: "課題の締切を管理し、達成率を確認できます",
            category: "学習・締切"
        },
        {
            id: "tasks",
            name: "タスク管理",
            icon: "✅",
            url: "tasks.html",
            desc: "締切のない用事を、優先度をつけて管理します",
            category: "ToDo"
        },
        {
            id: "everydayTask",
            name: "毎日習慣タスク",
            icon: "🔄",
            url: "everydayTask.html",
            desc: "毎日続けたい習慣を登録し、達成状況を記録します",
            category: "習慣・ルーティン"
        },
        {
            id: "wishlist",
            name: "やりたいことリスト",
            icon: "✨",
            url: "wishlist.html",
            desc: "やりたいことをリストにして、達成チェックできます",
            category: "ライフ"
        },
        {
            id: "ideas",
            name: "アイデア保存",
            icon: "💡",
            url: "ideas.html",
            desc: "思いついたアイデアを保存しておけます",
            category: "メモ・発想"
        },
        {
            id: "calendar",
            name: "カレンダー",
            icon: "📅",
            url: "calendar.html",
            desc: "予定をカレンダーとカードで管理できます",
            category: "スケジュール"
        },
        {
            id: "report",
            name: "報告書作成",
            icon: "📄",
            url: "report.html",
            desc: "予定・課題・タスクから報告書を作成・出力できます",
            category: "業務・学業"
        },
        {
            id: "birthdays",
            name: "誕生日管理",
            icon: "🎂",
            url: "birthdays.html",
            desc: "大切な人の誕生日や年齢・日数をカウント管理できます",
            category: "記念日"
        }
    ];

    function getDefaultFeatureIds() {
        return ALL_FEATURES.map(f => f.id);
    }

    // 現在のユーザーの有効機能ID一覧を取得
    function getEnabledFeatureIds() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn("features load error:", e);
        }

        // プロファイル内に保持されている場合をチェック
        if (window.MyNoteAuth && typeof window.MyNoteAuth.getCurrentUserInfo === "function") {
            const info = window.MyNoteAuth.getCurrentUserInfo();
            if (info && Array.isArray(info.custom_features) && info.custom_features.length > 0) {
                return info.custom_features;
            }
        }

        // 未設定時は全機能有効をデフォルトとする
        return getDefaultFeatureIds();
    }

    // 有効機能を保存
    async function saveEnabledFeatureIds(featureIds) {
        if (!Array.isArray(featureIds)) featureIds = [];
        
        // 1. localStorage に保存 (Storageフックにより u:<username>:custom_features に保存)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(featureIds));

        // 2. Supabase DB の profiles テーブルと user_data に保存
        if (window.MyNoteAuth) {
            const userId = window.MyNoteAuth.getCurrentUserId();
            const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
                ? window.MyNoteSupabase.getClient()
                : null;

            if (client && userId && !userId.startsWith("local-")) {
                try {
                    // profiles テーブルの custom_features カラム更新を試みる
                    await client
                        .from("profiles")
                        .update({ custom_features: featureIds })
                        .eq("id", userId);
                } catch (e) {
                    console.warn("profiles custom_features update notice:", e);
                }

                // user_data にも同期
                if (window.MyNoteDBSync && typeof window.MyNoteDBSync.queueSync === "function") {
                    window.MyNoteDBSync.queueSync(STORAGE_KEY);
                }
            }

            // 3. ローカルフォールバック用ユーザーリストの更新
            try {
                const rawUsers = Storage.prototype.getItem.call(localStorage, "myNoteUsers");
                if (rawUsers) {
                    const users = JSON.parse(rawUsers);
                    const currentUname = window.MyNoteAuth.getCurrentUser();
                    if (currentUname && Array.isArray(users)) {
                        const target = users.find(u => u.username.toLowerCase() === currentUname.toLowerCase());
                        if (target) {
                            target.custom_features = featureIds;
                            Storage.prototype.setItem.call(localStorage, "myNoteUsers", JSON.stringify(users));
                        }
                    }
                }
            } catch (e) {
                console.warn("local user custom_features error:", e);
            }
        }

        // メニュー等の表示を再同期
        applyCustomFeaturesToUI();
        return true;
    }

    // 全ページのドロワーメニューにカスタマイズを適用
    function applyToNavMenu() {
        const navMenu = document.getElementById("nav-menu");
        if (!navMenu) return;

        const enabledIds = new Set(getEnabledFeatureIds());

        // 各機能のリンクを判定
        navMenu.querySelectorAll("a").forEach(link => {
            const href = link.getAttribute("href") || "";
            const feature = ALL_FEATURES.find(f => f.url === href);
            if (feature) {
                if (enabledIds.has(feature.id)) {
                    link.style.display = "";
                } else {
                    link.style.display = "none";
                }
            }
        });

        // カスタマイズ画面へのリンクを追加（未追加の場合）
        if (!navMenu.querySelector(".nav-customize-link")) {
            const custLink = document.createElement("a");
            custLink.href = "customize.html";
            custLink.className = "nav-customize-link";
            custLink.style.cssText = "border-top: 1px solid rgba(255,255,255,0.15); margin-top: 8px; color: #67e8f9; font-weight: bold;";
            custLink.innerHTML = "⚙️ 機能カスタマイズ";
            navMenu.appendChild(custLink);
        }
    }

    // ホーム画面 (index.html) のメニューカードにカスタマイズを適用
    function applyToHomeMenu() {
        const menuGrid = document.querySelector(".menu-grid");
        if (!menuGrid) return;

        const enabledIds = new Set(getEnabledFeatureIds());

        // 既存のカードを判定
        let visibleCount = 0;
        menuGrid.querySelectorAll(".menu-item").forEach(item => {
            const onclickAttr = item.getAttribute("onclick") || "";
            const feature = ALL_FEATURES.find(f => onclickAttr.includes(f.url));
            if (feature) {
                if (enabledIds.has(feature.id)) {
                    item.style.display = "";
                    visibleCount++;
                } else {
                    item.style.display = "none";
                }
            }
        });

        // 誕生日管理カードが index.html になければ動的に追加可能にする
        const hasBirthdayCard = Array.from(menuGrid.querySelectorAll(".menu-item")).some(
            el => (el.getAttribute("onclick") || "").includes("birthdays.html")
        );
        if (!hasBirthdayCard && enabledIds.has("birthdays")) {
            const bCard = document.createElement("div");
            bCard.className = "card menu-item dynamic-feature-card";
            bCard.onclick = () => location.href = "birthdays.html";
            bCard.innerHTML = `<h2>🎂 誕生日管理</h2><p>大切な人の誕生日や年齢・日数をカウント管理できます</p>`;
            menuGrid.appendChild(bCard);
            visibleCount++;
        }

        // カスタマイズ追加用カードを末尾に追加
        let addCard = document.getElementById("home-customize-add-card");
        if (!addCard) {
            addCard = document.createElement("div");
            addCard.id = "home-customize-add-card";
            addCard.className = "card menu-item home-customize-card";
            addCard.onclick = () => location.href = "customize.html";
            addCard.innerHTML = `
                <div style="font-size: 26px; margin-bottom: 6px;">⚙️ ＋</div>
                <h2 style="color: #3b82f6;">機能のカスタマイズ</h2>
                <p>使いたい機能の追加・非表示をいつでも変更できます</p>
            `;
            menuGrid.appendChild(addCard);
        }

        // 全てOFFの場合のメッセージ
        let emptyNotice = document.getElementById("home-empty-features-notice");
        if (visibleCount === 0) {
            if (!emptyNotice) {
                emptyNotice = document.createElement("div");
                emptyNotice.id = "home-empty-features-notice";
                emptyNotice.className = "card";
                emptyNotice.style.cssText = "grid-column: 1 / -1; text-align: center; padding: 32px 20px;";
                emptyNotice.innerHTML = `
                    <p style="font-size: 16px; color: #64748b; margin-bottom: 16px;">
                        表示中の機能がありません。「機能のカスタマイズ」から使いたい機能を選択してください。
                    </p>
                    <button onclick="location.href='customize.html'" class="btn-primary" style="padding: 10px 20px;">
                        ⚙️ 機能を選択する
                    </button>
                `;
                menuGrid.insertBefore(emptyNotice, addCard);
            }
            emptyNotice.style.display = "";
        } else if (emptyNotice) {
            emptyNotice.style.display = "none";
        }
    }

    function applyCustomFeaturesToUI() {
        applyToNavMenu();
        applyToHomeMenu();
    }

    // 公開API
    window.MyNoteFeatures = {
        ALL_FEATURES,
        getDefaultFeatureIds,
        getEnabledFeatureIds,
        saveEnabledFeatureIds,
        applyCustomFeaturesToUI
    };

    // DOMロード時に適用
    document.addEventListener("DOMContentLoaded", () => {
        applyCustomFeaturesToUI();
    });
})();
