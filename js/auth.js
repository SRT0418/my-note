/* =========================================================
   MyNote アカウント機能 (auth.js)
   ---------------------------------------------------------
   ・Supabase Auth 認証 & プロフィール/管理者権限 (Role) 管理
   ・端末ローカル (localStorage) との自動連携および名前空間設定
   ========================================================= */

(function () {
    "use strict";

    const USERS_KEY = "myNoteUsers";         // ローカルフォールバック用ユーザー情報
    const SESSION_KEY = "myNoteCurrentUser";   // ログイン中ユーザー名
    const PROFILE_KEY = "myNoteUserProfile";   // ログイン中プロファイル (Role, ID等)
    const RAW_KEYS = [USERS_KEY, SESSION_KEY, PROFILE_KEY]; // 名前空間除外キー

    // ---------- 生のlocalStorageアクセス ----------
    const rawGetItem = Storage.prototype.getItem;
    const rawSetItem = Storage.prototype.setItem;
    const rawRemoveItem = Storage.prototype.removeItem;

    function rawGet(key) {
        return rawGetItem.call(localStorage, key);
    }
    function rawSet(key, value) {
        return rawSetItem.call(localStorage, key, value);
    }

    // ---------- 名前空間振り分け ----------
    function namespacedKey(key) {
        if (RAW_KEYS.indexOf(key) !== -1) return key;
        const user = rawGet(SESSION_KEY);
        if (!user) return key;
        return "u:" + user + ":" + key;
    }

    // Storageプロトタイプのフック
    Storage.prototype.getItem = function (key) {
        if (this !== localStorage) return rawGetItem.call(this, key);
        return rawGetItem.call(this, namespacedKey(key));
    };
    Storage.prototype.setItem = function (key, value) {
        if (this !== localStorage) return rawSetItem.call(this, key, value);
        const nsKey = namespacedKey(key);
        const res = rawSetItem.call(this, nsKey, value);
        // Supabase DBへバックグラウンド同期
        if (window.MyNoteDBSync && typeof window.MyNoteDBSync.queueSync === "function") {
            window.MyNoteDBSync.queueSync(key);
        }
        return res;
    };
    Storage.prototype.removeItem = function (key) {
        if (this !== localStorage) return rawRemoveItem.call(this, key);
        return rawRemoveItem.call(this, namespacedKey(key));
    };

    // ---------- パスワードハッシュ (ローカルフォールバック用) ----------
    async function sha256Hex(text) {
        const enc = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    function randomSalt() {
        const arr = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
    }

    function getUsers() {
        try {
            return JSON.parse(rawGet(USERS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveUsers(users) {
        rawSet(USERS_KEY, JSON.stringify(users));
    }

    function findUser(username) {
        const key = (username || "").trim().toLowerCase();
        return getUsers().find(u => u.username.toLowerCase() === key) || null;
    }

    // ---------- セッション / プロフィール保存 ----------
    function setSessionProfile(username, profile) {
        rawSet(SESSION_KEY, username);
        rawSet(PROFILE_KEY, JSON.stringify(profile));
    }

    function getSessionProfile() {
        try {
            return JSON.parse(rawGet(PROFILE_KEY)) || null;
        } catch (e) {
            return null;
        }
    }

    function getCurrentUser() {
        return rawGet(SESSION_KEY);
    }

    function getCurrentUserId() {
        const prof = getSessionProfile();
        return prof ? prof.id : null;
    }

    function getCurrentUserInfo() {
        const username = getCurrentUser();
        if (!username) return null;
        const prof = getSessionProfile();
        if (prof) {
            return {
                id: prof.id,
                username: prof.username || username,
                email: prof.email || "",
                role: prof.role || "user",
                status: prof.status || "active"
            };
        }
        const user = findUser(username);
        return {
            id: null,
            username: username,
            email: user ? user.email || "" : "",
            role: (username.toLowerCase() === "admin" || username.toLowerCase() === "master") ? "admin" : "user",
            status: "active"
        };
    }

    function isAdmin() {
        const info = getCurrentUserInfo();
        return info && info.role === "admin";
    }

    // ---------- 新規ユーザー登録 ----------
    async function registerUser(username, email, password) {
        username = (username || "").trim();
        email = (email || "").trim();

        if (!username) return { ok: false, message: "ユーザー名を入力してください。" };
        if (username.length > 20) return { ok: false, message: "ユーザー名は20文字以内で入力してください。" };
        if (!isValidEmail(email)) return { ok: false, message: "正しいメールアドレスを入力してください。" };
        if (!password || password.length < 4) return { ok: false, message: "パスワードは4文字以上で入力してください。" };

        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client) {
            try {
                const { data, error } = await client.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: { username: username }
                    }
                });

                if (error) {
                    return { ok: false, message: error.message || "新規登録に失敗しました。" };
                }

                // ローカルユーザー情報も念のため更新
                const salt = randomSalt();
                const hash = await sha256Hex(salt + password);
                const users = getUsers();
                if (!users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                    users.push({ username, email, salt, hash, createdAt: new Date().toISOString() });
                    saveUsers(users);
                }

                return { ok: true, user: data.user };
            } catch (e) {
                return { ok: false, message: "Supabase接続エラー: " + e.message };
            }
        }

        // Supabase未設定時のローカル登録
        if (findUser(username)) return { ok: false, message: "そのユーザー名は既に使われています。" };
        const salt = randomSalt();
        const hash = await sha256Hex(salt + password);
        const users = getUsers();
        const isFirst = users.length === 0;
        users.push({
            username: username,
            email: email,
            salt: salt,
            hash: hash,
            role: isFirst ? "admin" : "user",
            createdAt: new Date().toISOString()
        });
        saveUsers(users);
        return { ok: true };
    }

    // ---------- ログイン ----------
    async function loginUser(usernameOrEmail, password) {
        usernameOrEmail = (usernameOrEmail || "").trim();
        if (!usernameOrEmail || !password) {
            return { ok: false, message: "ユーザー名/メールアドレスとパスワードを入力してください。" };
        }

        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client) {
            try {
                // メールアドレスまたはユーザー名でのログイン対応
                let emailToUse = usernameOrEmail;
                if (!isValidEmail(usernameOrEmail)) {
                    // profilesからユーザー名でメールアドレスを検索
                    const { data: profData } = await client
                        .from("profiles")
                        .select("email")
                        .eq("username", usernameOrEmail)
                        .maybeSingle();
                    if (profData && profData.email) {
                        emailToUse = profData.email;
                    }
                }

                const { data: authData, error: authErr } = await client.auth.signInWithPassword({
                    email: emailToUse,
                    password: password
                });

                if (authErr || !authData.user) {
                    return { ok: false, message: "ユーザー名/メールアドレスまたはパスワードが違います。" };
                }

                const userId = authData.user.id;

                // プロフィール取得
                let { data: profile, error: profErr } = await client
                    .from("profiles")
                    .select("*")
                    .eq("id", userId)
                    .maybeSingle();

                if (!profile) {
                    // プロフィールが存在しない場合、作成
                    const uname = authData.user.user_metadata?.username || usernameOrEmail;
                    const { data: countData } = await client.from("profiles").select("id", { count: "exact" });
                    const isFirst = !countData || countData.length === 0;
                    const { data: newProf } = await client.from("profiles").insert({
                        id: userId,
                        username: uname,
                        email: authData.user.email,
                        role: isFirst ? "admin" : "user",
                        status: "active"
                    }).select().single();
                    profile = newProf;
                }

                if (profile && profile.status === "suspended") {
                    await client.auth.signOut();
                    return { ok: false, message: "このアカウントは管理者により一時凍結されています。" };
                }

                const displayUsername = profile ? profile.username : (authData.user.user_metadata?.username || usernameOrEmail);
                setSessionProfile(displayUsername, profile || {
                    id: userId,
                    username: displayUsername,
                    email: authData.user.email,
                    role: "user",
                    status: "active"
                });

                // クラウドデータの同期・引き込み
                if (window.MyNoteDBSync) {
                    await window.MyNoteDBSync.pullCloudData(userId);
                    await window.MyNoteDBSync.migrateLocalDataToCloud(userId);
                }

                return { ok: true };
            } catch (e) {
                console.warn("Supabaseログインフォールバック:", e);
            }
        }

        // ローカルフォールバックログイン
        const user = findUser(usernameOrEmail);
        if (!user) return { ok: false, message: "ユーザー名またはパスワードが違います。" };

        const hash = await sha256Hex(user.salt + (password || ""));
        if (hash !== user.hash) return { ok: false, message: "ユーザー名またはパスワードが違います。" };

        const isFirst = getUsers().indexOf(user) === 0;
        const role = user.role || (isFirst || user.username.toLowerCase() === "admin" ? "admin" : "user");
        setSessionProfile(user.username, {
            id: "local-" + user.username,
            username: user.username,
            email: user.email,
            role: role,
            status: "active"
        });

        return { ok: true };
    }

    // ---------- パスワード変更 ----------
    async function changePassword(username, currentPassword, newPassword) {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client) {
            try {
                const { error } = await client.auth.updateUser({ password: newPassword });
                if (error) return { ok: false, message: error.message };
                return { ok: true };
            } catch (e) {
                return { ok: false, message: e.message };
            }
        }

        const user = findUser(username);
        if (!user) return { ok: false, message: "ユーザーが見つかりません。" };
        const hash = await sha256Hex(user.salt + (currentPassword || ""));
        if (hash !== user.hash) return { ok: false, message: "現在のパスワードが違います。" };
        if (!newPassword || newPassword.length < 4) {
            return { ok: false, message: "新しいパスワードは4文字以上で入力してください。" };
        }

        const newSalt = randomSalt();
        const newHash = await sha256Hex(newSalt + newPassword);
        const users = getUsers();
        const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
        if (idx !== -1) {
            users[idx].salt = newSalt;
            users[idx].hash = newHash;
            saveUsers(users);
        }
        return { ok: true };
    }

    // ---------- メール変更 ----------
    async function updateEmail(username, newEmail) {
        newEmail = (newEmail || "").trim();
        if (!isValidEmail(newEmail)) return { ok: false, message: "正しいメールアドレスを入力してください。" };

        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client) {
            try {
                const { error } = await client.auth.updateUser({ email: newEmail });
                if (error) return { ok: false, message: error.message };
                const userId = getCurrentUserId();
                if (userId) {
                    await client.from("profiles").update({ email: newEmail }).eq("id", userId);
                }
                return { ok: true };
            } catch (e) {
                return { ok: false, message: e.message };
            }
        }

        const users = getUsers();
        const idx = users.findIndex(u => u.username.toLowerCase() === (username || "").toLowerCase());
        if (idx === -1) return { ok: false, message: "ユーザーが見つかりません。" };
        users[idx].email = newEmail;
        saveUsers(users);
        return { ok: true };
    }

    // ---------- アカウント削除 (本人操作) ----------
    async function deleteAccount(username) {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        const userId = getCurrentUserId();
        if (client && userId) {
            try {
                await client.from("user_data").delete().eq("user_id", userId);
                await client.from("profiles").delete().eq("id", userId);
            } catch (e) {
                console.error("Supabaseデータ削除エラー:", e);
            }
        }

        const prefix = "u:" + username + ":";
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            allKeys.push(localStorage.key(i));
        }
        allKeys.forEach(key => {
            if (key && key.indexOf(prefix) === 0) {
                rawRemoveItem.call(localStorage, key);
            }
        });

        const users = getUsers().filter(u => u.username.toLowerCase() !== username.toLowerCase());
        saveUsers(users);

        logout();
    }

    // ---------- ログアウト ----------
    async function logout() {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client) {
            try {
                await client.auth.signOut();
            } catch (e) {
                console.error("SignOut Exception:", e);
            }
        }

        rawRemoveItem.call(localStorage, SESSION_KEY);
        rawRemoveItem.call(localStorage, PROFILE_KEY);
    }

    // ---------- マスターAPI (管理者用) ----------
    async function getProfiles() {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client) {
            const { data, error } = await client
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: true });

            if (!error && data) return data;
        }

        // ローカルフォールバック: localStorage 内の全ユーザー一覧を整形して返す
        const users = getUsers();
        return users.map((u, i) => ({
            id: "local-" + u.username,
            username: u.username,
            email: u.email || "",
            role: u.role || (i === 0 || u.username.toLowerCase() === "admin" ? "admin" : "user"),
            status: u.status || "active",
            created_at: u.createdAt || new Date().toISOString()
        }));
    }

    async function updateUserRole(userId, newRole) {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client && !userId.startsWith("local-")) {
            const { error } = await client
                .from("profiles")
                .update({ role: newRole })
                .eq("id", userId);
            if (error) return { ok: false, message: error.message };
            return { ok: true };
        }

        // ローカルフォールバック
        const users = getUsers();
        const u = users.find(x => "local-" + x.username === userId || x.username === userId);
        if (u) {
            u.role = newRole;
            saveUsers(users);
            return { ok: true };
        }
        return { ok: false, message: "対象ユーザーが見つかりません。" };
    }

    async function updateUserStatus(userId, newStatus) {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client && !userId.startsWith("local-")) {
            const { error } = await client
                .from("profiles")
                .update({ status: newStatus })
                .eq("id", userId);
            if (error) return { ok: false, message: error.message };
            return { ok: true };
        }

        const users = getUsers();
        const u = users.find(x => "local-" + x.username === userId || x.username === userId);
        if (u) {
            u.status = newStatus;
            saveUsers(users);
            return { ok: true };
        }
        return { ok: false, message: "対象ユーザーが見つかりません。" };
    }

    async function deleteUserByAdmin(userId, username) {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (client && !userId.startsWith("local-")) {
            await client.from("user_data").delete().eq("user_id", userId);
            const { error } = await client.from("profiles").delete().eq("id", userId);
            if (error) return { ok: false, message: error.message };
        }

        const prefix = "u:" + username + ":";
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            allKeys.push(localStorage.key(i));
        }
        allKeys.forEach(key => {
            if (key && key.indexOf(prefix) === 0) {
                rawRemoveItem.call(localStorage, key);
            }
        });

        const users = getUsers().filter(u => u.username.toLowerCase() !== (username || "").toLowerCase());
        saveUsers(users);

        return { ok: true };
    }

    function currentPageName() {
        return location.pathname.split("/").pop() || "index.html";
    }

    function requireAuth() {
        const page = currentPageName();
        if (page === "login.html") return;
        if (!getCurrentUser()) {
            location.href = "login.html";
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ---------- アカウント表示共通HTML ----------
    function accountInfoHtml(user, idPrefix) {
        const adminBadge = isAdmin() ? ' <span class="badge-admin">👑 管理者</span>' : '';
        const masterLink = isAdmin() ? '<a href="master-account.html" class="nav-admin-link">⚙️ アカウント管理マスター</a>' : '';
        return (
            '<span id="' + idPrefix + '-user">👤 ' + escapeHtml(user) + ' さん' + adminBadge + '</span>' +
            '<a href="account.html">アカウント設定</a>' +
            masterLink +
            '<button id="' + idPrefix + '-logout">ログアウト</button>'
        );
    }

    function bindLogoutButton(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener("click", async () => {
            if (confirm("ログアウトしますか？")) {
                await logout();
                location.href = "login.html";
            }
        });
    }

    function renderNavMenuAccount(navMenu, user) {
        const section = document.createElement("div");
        section.className = "nav-menu-account";
        section.innerHTML = accountInfoHtml(user, "nav-menu-account");

        const header = navMenu.querySelector(".nav-menu-header");
        if (header && header.nextSibling) {
            navMenu.insertBefore(section, header.nextSibling);
        } else if (header) {
            navMenu.appendChild(section);
        } else {
            navMenu.prepend(section);
        }

        bindLogoutButton("nav-menu-account-logout");
    }

    function renderAccountBar() {
        const page = currentPageName();
        if (page === "login.html") return;

        const user = getCurrentUser();
        if (!user) return;

        const navMenu = document.getElementById("nav-menu");
        if (navMenu) {
            renderNavMenuAccount(navMenu, user);
        }
    }

    // 公開API
    window.MyNoteAuth = {
        registerUser,
        loginUser,
        changePassword,
        updateEmail,
        deleteAccount,
        getCurrentUser,
        getCurrentUserId,
        getCurrentUserInfo,
        isAdmin,
        logout,
        findUser,
        // 管理者API
        getProfiles,
        updateUserRole,
        updateUserStatus,
        deleteUserByAdmin
    };

    requireAuth();
    document.addEventListener("DOMContentLoaded", renderAccountBar);
})();
