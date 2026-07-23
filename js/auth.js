/* =========================================================
   MyNote アカウント機能 (auth.js)
   ---------------------------------------------------------
   ・同じPC / 同じブラウザを複数人で使い分けるための
     簡易的なログイン機能です。
   ・パスワードはSHA-256＋ソルトでハッシュ化してlocalStorageに
     保存しますが、サーバーを介さないブラウザ内保存のため
     強固なセキュリティではありません（家族・自分用の
     簡易的な使い分けを想定しています）。
   ・ログイン中のユーザー名に応じて、他のページが使う
     localStorageのキーを自動的に振り分け、ユーザーごとに
     データ（タスクやアイデアなど）を分離します。
   ========================================================= */

(function () {
    "use strict";

    const USERS_KEY = "myNoteUsers";       // 全ユーザー情報（配列）
    const SESSION_KEY = "myNoteCurrentUser"; // 現在ログイン中のユーザー名
    const RAW_KEYS = [USERS_KEY, SESSION_KEY]; // ユーザー分離の対象外にするキー

    // ---------- 生のlocalStorageアクセス（ユーザー分離前） ----------
    const rawGetItem = Storage.prototype.getItem;
    const rawSetItem = Storage.prototype.setItem;
    const rawRemoveItem = Storage.prototype.removeItem;

    function rawGet(key) {
        return rawGetItem.call(localStorage, key);
    }
    function rawSet(key, value) {
        return rawSetItem.call(localStorage, key, value);
    }

    // ---------- ユーザー名に応じてキーを振り分ける ----------
    function namespacedKey(key) {
        if (RAW_KEYS.indexOf(key) !== -1) return key;
        const user = rawGet(SESSION_KEY);
        if (!user) return key; // 未ログイン時はそのまま（通常はrequireAuthで到達しない）
        return "u:" + user + ":" + key;
    }

    // localStorageへの全アクセスを横取りし、ユーザーごとに保存先を分ける。
    // （sessionStorageには影響しないよう this === localStorage の場合のみ処理）
    Storage.prototype.getItem = function (key) {
        if (this !== localStorage) return rawGetItem.call(this, key);
        return rawGetItem.call(this, namespacedKey(key));
    };
    Storage.prototype.setItem = function (key, value) {
        if (this !== localStorage) return rawSetItem.call(this, key, value);
        return rawSetItem.call(this, namespacedKey(key), value);
    };
    Storage.prototype.removeItem = function (key) {
        if (this !== localStorage) return rawRemoveItem.call(this, key);
        return rawRemoveItem.call(this, namespacedKey(key));
    };

    // ---------- パスワードのハッシュ化 ----------
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

    // ---------- ユーザー情報の取得・保存 ----------
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

    // ---------- 新規登録 ----------
    // 戻り値: { ok: true } または { ok: false, message: "..." }
    async function registerUser(username, email, password) {
        username = (username || "").trim();
        email = (email || "").trim();
        if (!username) return { ok: false, message: "ユーザー名を入力してください。" };
        if (username.length > 20) return { ok: false, message: "ユーザー名は20文字以内で入力してください。" };
        if (!isValidEmail(email)) return { ok: false, message: "正しいメールアドレスを入力してください。" };
        if (!password || password.length < 4) return { ok: false, message: "パスワードは4文字以上で入力してください。" };
        if (findUser(username)) return { ok: false, message: "そのユーザー名は既に使われています。" };

        const salt = randomSalt();
        const hash = await sha256Hex(salt + password);

        const users = getUsers();
        users.push({
            username: username,
            email: email,
            salt: salt,
            hash: hash,
            createdAt: new Date().toISOString()
        });
        saveUsers(users);
        return { ok: true };
    }

    // ---------- ログイン ----------
    async function loginUser(username, password) {
        const user = findUser(username);
        if (!user) return { ok: false, message: "ユーザー名またはパスワードが違います。" };

        const hash = await sha256Hex(user.salt + (password || ""));
        if (hash !== user.hash) return { ok: false, message: "ユーザー名またはパスワードが違います。" };

        rawSet(SESSION_KEY, user.username);
        return { ok: true };
    }

    // ---------- パスワード変更 ----------
    async function changePassword(username, currentPassword, newPassword) {
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
        if (idx === -1) return { ok: false, message: "ユーザーが見つかりません。" };
        users[idx].salt = newSalt;
        users[idx].hash = newHash;
        saveUsers(users);
        return { ok: true };
    }

    // ---------- メールアドレス変更 ----------
    function updateEmail(username, newEmail) {
        newEmail = (newEmail || "").trim();
        if (!isValidEmail(newEmail)) return { ok: false, message: "正しいメールアドレスを入力してください。" };

        const users = getUsers();
        const idx = users.findIndex(u => u.username.toLowerCase() === (username || "").toLowerCase());
        if (idx === -1) return { ok: false, message: "ユーザーが見つかりません。" };

        users[idx].email = newEmail;
        saveUsers(users);
        return { ok: true };
    }

    // ---------- アカウント削除（そのユーザーのデータも全削除） ----------
    function deleteAccount(username) {
        const prefix = "u:" + username + ":";
        // localStorage内の該当ユーザーのデータを全て削除する
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

        const cur = rawGet(SESSION_KEY);
        if (cur && cur.toLowerCase() === username.toLowerCase()) {
            rawRemoveItem.call(localStorage, SESSION_KEY);
        }
    }

    // ---------- ログイン状態 ----------
    function getCurrentUser() {
        return rawGet(SESSION_KEY);
    }

    // ログイン中ユーザーの表示用情報（ユーザー名・メールアドレス）を返す
    function getCurrentUserInfo() {
        const username = getCurrentUser();
        if (!username) return null;
        const user = findUser(username);
        if (!user) return null;
        return { username: user.username, email: user.email || "" };
    }

    function logout() {
        rawRemoveItem.call(localStorage, SESSION_KEY);
    }

    function currentPageName() {
        return location.pathname.split("/").pop() || "index.html";
    }

    // ---------- ログイン必須ページのガード ----------
    // login.html 以外で未ログインならログイン画面へリダイレクトする
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

    // ---------- アカウント表示の共通HTML ----------
    function accountInfoHtml(user, idPrefix) {
        return (
            '<span id="' + idPrefix + '-user">👤 ' + escapeHtml(user) + ' さん</span>' +
            '<a href="account.html">アカウント設定</a>' +
            '<button id="' + idPrefix + '-logout">ログアウト</button>'
        );
    }

    function bindLogoutButton(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener("click", () => {
            if (confirm("ログアウトしますか？")) {
                logout();
                location.href = "login.html";
            }
        });
    }

    // ハンバーガーメニュー（ドロワー）の上部にアカウント表示を差し込む
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

    // ドロワーメニューが無いページ（フォーム画面など）用の右上フローティング表示
    function renderFloatingBar(user) {
        const bar = document.createElement("div");
        bar.id = "account-bar";
        bar.innerHTML = accountInfoHtml(user, "account-bar");
        document.body.prepend(bar);

        bindLogoutButton("account-bar-logout");
    }

    // ---------- ユーザー情報表示（ログイン中のページに共通表示） ----------
    function renderAccountBar() {
        const page = currentPageName();
        if (page === "login.html") return;

        const user = getCurrentUser();
        if (!user) return;

        const navMenu = document.getElementById("nav-menu");
        if (navMenu) {
            renderNavMenuAccount(navMenu, user);
        } else {
            // renderFloatingBar(user);
        }
    }

    // 公開API（他のスクリプトから利用できるようにwindowへ公開）
    window.MyNoteAuth = {
        registerUser,
        loginUser,
        changePassword,
        updateEmail,
        deleteAccount,
        getCurrentUser,
        getCurrentUserInfo,
        logout,
        findUser
    };

    // ページ読み込み直後（bodyの描画前）に未ログインならリダイレクトする
    requireAuth();

    // ログイン済みの場合、DOM構築後にユーザー情報バーを表示する
    document.addEventListener("DOMContentLoaded", renderAccountBar);
})();
