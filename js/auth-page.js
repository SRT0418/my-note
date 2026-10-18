window.addEventListener("load", () => {

    // 既にログイン済みならホームへ
    if (window.MyNoteAuth.getCurrentUser()) {
        location.href = "index.html";
        return;
    }

    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const panelLogin = document.getElementById("panel-login");
    const panelRegister = document.getElementById("panel-register");

    tabLogin.addEventListener("click", () => switchTab("login"));
    tabRegister.addEventListener("click", () => switchTab("register"));

    function switchTab(which) {
        const isLogin = which === "login";
        tabLogin.classList.toggle("active", isLogin);
        tabRegister.classList.toggle("active", !isLogin);
        panelLogin.classList.toggle("active", isLogin);
        panelRegister.classList.toggle("active", !isLogin);
    }

    // ---------- ログイン ----------
    const loginMessage = document.getElementById("login-message");

    document.getElementById("login-submit").addEventListener("click", async () => {
        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-password").value;

        loginMessage.textContent = "";
        loginMessage.classList.remove("success");

        if (!username || !password) {
            loginMessage.textContent = "ユーザー名とパスワードを入力してください。";
            return;
        }

        const result = await window.MyNoteAuth.loginUser(username, password);
        if (result.ok) {
            location.href = "index.html";
        } else {
            loginMessage.textContent = result.message;
        }
    });

    document.getElementById("login-password").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("login-submit").click();
    });

    // usernameフィールドでもEnterで次のフィールドへ移動
    document.getElementById("login-username").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("login-password").focus();
    });

    // ---------- 初期機能カスタマイズUIの初期化 ----------
    const signupFeaturesGrid = document.getElementById("signup-features-grid");
    const featuresModule = window.MyNoteFeatures;
    const allFeatures = featuresModule ? featuresModule.ALL_FEATURES : [];

    if (signupFeaturesGrid && allFeatures.length > 0) {
        signupFeaturesGrid.innerHTML = allFeatures.map(f => `
            <label class="signup-feature-chip active" data-id="${f.id}">
                <input type="checkbox" name="signup-feature" value="${f.id}" checked>
                <span class="feat-icon">${f.icon}</span>
                <div class="feat-info">
                    <span class="feat-name">${f.name}</span>
                    <span class="feat-desc">${f.desc}</span>
                </div>
            </label>
        `).join("");

        // チップ全体のクリック連動
        signupFeaturesGrid.querySelectorAll(".signup-feature-chip").forEach(chip => {
            const cb = chip.querySelector('input[type="checkbox"]');
            cb.addEventListener("change", () => {
                chip.classList.toggle("active", cb.checked);
            });
        });

        // 全選択・全解除
        const btnSelectAll = document.getElementById("btn-signup-select-all");
        const btnDeselectAll = document.getElementById("btn-signup-deselect-all");

        if (btnSelectAll) {
            btnSelectAll.addEventListener("click", () => {
                signupFeaturesGrid.querySelectorAll('input[name="signup-feature"]').forEach(cb => {
                    cb.checked = true;
                    cb.closest(".signup-feature-chip")?.classList.add("active");
                });
            });
        }

        if (btnDeselectAll) {
            btnDeselectAll.addEventListener("click", () => {
                signupFeaturesGrid.querySelectorAll('input[name="signup-feature"]').forEach(cb => {
                    cb.checked = false;
                    cb.closest(".signup-feature-chip")?.classList.remove("active");
                });
            });
        }
    }

    // ---------- 新規登録 ----------
    const registerMessage = document.getElementById("register-message");
    const registerUsernameInput = document.getElementById("register-username");
    const usernameCheckMsg = document.getElementById("username-check-msg");

    // アカウント名のリアルタイム重複チェック（デバウンス）
    let usernameCheckTimer = null;
    if (registerUsernameInput && usernameCheckMsg) {
        async function checkUsernameLive() {
            const val = registerUsernameInput.value.trim();
            if (!val) {
                usernameCheckMsg.style.display = "none";
                usernameCheckMsg.textContent = "";
                return;
            }
            if (val.length > 20) {
                usernameCheckMsg.style.display = "block";
                usernameCheckMsg.style.color = "#ef4444";
                usernameCheckMsg.textContent = "⚠️ アカウント名は20文字以内で入力してください。";
                return;
            }

            try {
                const isTaken = await window.MyNoteAuth.isUsernameTaken(val);
                usernameCheckMsg.style.display = "block";
                if (isTaken) {
                    usernameCheckMsg.style.color = "#ef4444";
                    usernameCheckMsg.textContent = "❌ このアカウント名は既に使われています。別の名前を入力してください。";
                } else {
                    usernameCheckMsg.style.color = "#10b981";
                    usernameCheckMsg.textContent = "✅ このアカウント名は使用できます！";
                }
            } catch (e) {
                usernameCheckMsg.style.display = "none";
            }
        }

        registerUsernameInput.addEventListener("input", () => {
            clearTimeout(usernameCheckTimer);
            usernameCheckTimer = setTimeout(checkUsernameLive, 400);
        });

        registerUsernameInput.addEventListener("blur", () => {
            clearTimeout(usernameCheckTimer);
            checkUsernameLive();
        });
    }

    document.getElementById("register-submit").addEventListener("click", async () => {
        const username = document.getElementById("register-username").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;
        const password2 = document.getElementById("register-password2").value;

        registerMessage.textContent = "";
        registerMessage.classList.remove("success");

        if (!username) {
            registerMessage.textContent = "アカウント名（ユーザー名）を入力してください。";
            return;
        }

        if (password !== password2) {
            registerMessage.textContent = "パスワードが一致しません。";
            return;
        }

        // 事前重複チェック
        const isTaken = await window.MyNoteAuth.isUsernameTaken(username);
        if (isTaken) {
            registerMessage.textContent = `アカウント名「${username}」は既に使われています。別のアカウント名を入力してください。`;
            if (usernameCheckMsg) {
                usernameCheckMsg.style.display = "block";
                usernameCheckMsg.style.color = "#ef4444";
                usernameCheckMsg.textContent = "❌ このアカウント名は既に使われています。";
            }
            return;
        }

        // 選択された機能一覧を取得
        const selectedFeatures = [];
        if (signupFeaturesGrid) {
            signupFeaturesGrid.querySelectorAll('input[name="signup-feature"]:checked').forEach(cb => {
                selectedFeatures.push(cb.value);
            });
        }

        const result = await window.MyNoteAuth.registerUser(username, email, password, selectedFeatures);
        if (!result.ok) {
            registerMessage.textContent = result.message;
            return;
        }

        // 登録後、自動的にログインする
        const loginResult = await window.MyNoteAuth.loginUser(email, password);
        if (loginResult.ok) {
            location.href = "index.html";
        } else {
            registerMessage.classList.add("success");
            // メール確認が必要な場合は案内する
            if (loginResult.message && loginResult.message.includes("確認メール")) {
                registerMessage.textContent = "登録が完了しました。登録したメールアドレスに確認メールが届いていますので、リンクをクリックしてからログインしてください。";
            } else {
                registerMessage.textContent = "登録が完了しました。ログインしてください。";
            }
            switchTab("login");
        }
    });

    document.getElementById("register-password2").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("register-submit").click();
    });
});
