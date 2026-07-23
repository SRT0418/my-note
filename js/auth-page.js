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
        const username = document.getElementById("login-username").value;
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

    // ---------- 新規登録 ----------
    const registerMessage = document.getElementById("register-message");

    document.getElementById("register-submit").addEventListener("click", async () => {
        const username = document.getElementById("register-username").value;
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;
        const password2 = document.getElementById("register-password2").value;

        registerMessage.textContent = "";
        registerMessage.classList.remove("success");

        if (password !== password2) {
            registerMessage.textContent = "パスワードが一致しません。";
            return;
        }

        const result = await window.MyNoteAuth.registerUser(username, email, password);
        if (!result.ok) {
            registerMessage.textContent = result.message;
            return;
        }

        // 登録後、自動的にログインする
        const loginResult = await window.MyNoteAuth.loginUser(username, password);
        if (loginResult.ok) {
            location.href = "index.html";
        } else {
            registerMessage.classList.add("success");
            registerMessage.textContent = "登録が完了しました。ログインしてください。";
            switchTab("login");
        }
    });

    document.getElementById("register-password2").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("register-submit").click();
    });
});
