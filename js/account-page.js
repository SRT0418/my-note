window.addEventListener("load", () => {

    const auth = window.MyNoteAuth;
    const user = auth.getCurrentUser();

    // auth.js のrequireAuthで通常ここには未ログインで来ないが、念のため確認
    if (!user) {
        location.href = "login.html";
        return;
    }

    const info = auth.getCurrentUserInfo() || { username: user, email: "" };
    document.getElementById("account-current-user").textContent =
        "👤 " + info.username + " さん" + (info.email ? "（" + info.email + "）" : "");
    document.getElementById("new-email").value = info.email || "";

    // ---------- メールアドレス変更 ----------
    const changeEmailMessage = document.getElementById("change-email-message");

    document.getElementById("change-email-button").addEventListener("click", async () => {
        const newEmail = document.getElementById("new-email").value;

        changeEmailMessage.classList.remove("success");
        changeEmailMessage.textContent = "";

        const result = await auth.updateEmail(user, newEmail);
        if (result.ok) {
            changeEmailMessage.classList.add("success");
            changeEmailMessage.textContent = "メールアドレスを変更しました。";
            const updated = auth.getCurrentUserInfo();
            document.getElementById("account-current-user").textContent =
                "👤 " + updated.username + " さん" + (updated.email ? "（" + updated.email + "）" : "");
        } else {
            changeEmailMessage.textContent = result.message;
        }
    });

    // ---------- ログアウト ----------
    document.getElementById("logout-button").addEventListener("click", () => {
        if (confirm("ログアウトしますか？")) {
            auth.logout();
            location.href = "login.html";
        }
    });

    // ---------- HOMEへ戻る ----------
    document.getElementById("back-button").addEventListener("click", () => {
        location.href = "index.html";
    });

    // ---------- パスワード変更 ----------
    const changeMessage = document.getElementById("change-password-message");

    document.getElementById("change-password-button").addEventListener("click", async () => {
        const current = document.getElementById("current-password").value;
        const next = document.getElementById("new-password").value;
        const next2 = document.getElementById("new-password2").value;

        changeMessage.classList.remove("success");
        changeMessage.textContent = "";

        if (next !== next2) {
            changeMessage.textContent = "新しいパスワードが一致しません。";
            return;
        }

        const result = await auth.changePassword(user, current, next);
        if (result.ok) {
            changeMessage.classList.add("success");
            changeMessage.textContent = "パスワードを変更しました。";
            document.getElementById("current-password").value = "";
            document.getElementById("new-password").value = "";
            document.getElementById("new-password2").value = "";
        } else {
            changeMessage.textContent = result.message;
        }
    });

    // ---------- アカウント削除 ----------
    document.getElementById("delete-account-button").addEventListener("click", () => {
        const confirm1 = confirm(
            "アカウント「" + user + "」を削除します。保存されたデータも全て完全に削除され、元に戻せません。本当に削除しますか？"
        );
        if (!confirm1) return;

        const typed = prompt("確認のため、ユーザー名「" + user + "」を入力してください。");
        if (typed !== user) {
            alert("ユーザー名が一致しないため、削除を中止しました。");
            return;
        }

        auth.deleteAccount(user);
        alert("アカウントを削除しました。");
        location.href = "login.html";
    });
});
