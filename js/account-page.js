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

    // 管理者の場合、マスターページへのボタンを表示
    if (auth.isAdmin()) {
        const currentUserSec = document.getElementById("account-current-user").parentNode;
        const masterBtn = document.createElement("button");
        masterBtn.id = "master-page-button";
        masterBtn.style.cssText = "background: linear-gradient(135deg, #8e44ad, #9b59b6); color: white; border: none; font-weight: bold;";
        masterBtn.textContent = "⚙️ 管理者ページ（アカウント管理マスター）";
        masterBtn.addEventListener("click", () => {
            location.href = "master-account.html";
        });
        currentUserSec.insertBefore(masterBtn, document.getElementById("logout-button"));
    }

    // ---------- 機能カスタマイズプレビュー & 画面遷移 ----------
    const featPreview = document.getElementById("account-current-features-preview");
    const goCustomizeBtn = document.getElementById("btn-go-customize");
    const featuresModule = window.MyNoteFeatures;

    if (featPreview && featuresModule) {
        const enabledIds = new Set(featuresModule.getEnabledFeatureIds());
        const allFeats = featuresModule.ALL_FEATURES;
        const activeFeats = allFeats.filter(f => enabledIds.has(f.id));

        if (activeFeats.length === 0) {
            featPreview.innerHTML = `<span style="color:#ef4444; font-size:13px;">※ 現在有効な機能はありません</span>`;
        } else {
            featPreview.innerHTML = activeFeats.map(f => `
                <span class="feat-badge-pill">${f.icon} ${f.name}</span>
            `).join("");
        }
    }

    if (goCustomizeBtn) {
        goCustomizeBtn.addEventListener("click", () => {
            location.href = "customize.html";
        });
    }

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

    // ---------- アカウント削除依頼 ----------
    const deleteRequestMsg = document.getElementById("delete-request-message");
    const deleteRequestAlready = document.getElementById("delete-request-already");
    const deleteRequestFormWrap = document.getElementById("delete-request-form-wrap");

    // ========== EmailJS 設定 ==========
    // ※ EmailJS でサービスID・テンプレートID・公開キーを取得して下記に設定してください
    const EMAILJS_SERVICE_ID  = "YOUR_SERVICE_ID";   // EmailJS > Email Services
    const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";  // EmailJS > Email Templates
    const EMAILJS_PUBLIC_KEY  = "YOUR_PUBLIC_KEY";   // EmailJS > Account > Public Key
    // ====================================

    // 既に申請済みかチェック
    async function checkExistingRequest() {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;
        if (!client) return;

        const userId = await auth.getCurrentUserIdAsync();
        if (!userId || userId.startsWith("local-")) return;

        const { data } = await client
            .from("delete_requests")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "pending")
            .maybeSingle();

        if (data) {
            // 申請済みの場合、フォームを非表示にして受付メッセージを表示
            const d = new Date(data.requested_at);
            const dateStr = d.getFullYear() + "/" +
                String(d.getMonth() + 1).padStart(2, "0") + "/" +
                String(d.getDate()).padStart(2, "0") + " " +
                String(d.getHours()).padStart(2, "0") + ":" +
                String(d.getMinutes()).padStart(2, "0");
            document.getElementById("delete-request-already-date").textContent =
                "受付日時：" + dateStr;
            deleteRequestAlready.style.display = "flex";
            deleteRequestFormWrap.style.display = "none";
        }
    }

    checkExistingRequest();

    // 削除依頼送信ボタン
    document.getElementById("send-delete-request-button").addEventListener("click", async () => {
        const reason = (document.getElementById("delete-reason").value || "").trim();
        const userInfo = auth.getCurrentUserInfo() || {};
        const username = userInfo.username || user;
        const email = userInfo.email || "";

        deleteRequestMsg.classList.remove("success");
        deleteRequestMsg.textContent = "";

        if (!email) {
            deleteRequestMsg.textContent = "メールアドレスが登録されていません。先にメールアドレスを設定してください。";
            return;
        }

        if (!confirm(`アカウント「${username}」の削除依頼をマスターに送信します。よろしいですか？`)) return;

        // 送信ボタンを無効化
        const btn = document.getElementById("send-delete-request-button");
        btn.disabled = true;
        btn.textContent = "送信中...";

        try {
            // 1. Supabaseに削除依頼を保存
            const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
                ? window.MyNoteSupabase.getClient()
                : null;

            const now = new Date();
            const nowStr = now.getFullYear() + "/" +
                String(now.getMonth() + 1).padStart(2, "0") + "/" +
                String(now.getDate()).padStart(2, "0") + " " +
                String(now.getHours()).padStart(2, "0") + ":" +
                String(now.getMinutes()).padStart(2, "0");

            const userId = await auth.getCurrentUserIdAsync();

            if (client && userId && !userId.startsWith("local-")) {
                const { error } = await client.from("delete_requests").insert({
                    user_id: userId,
                    username: username,
                    email: email,
                    reason: reason || null,
                    status: "pending"
                });
                if (error) throw new Error("DB保存エラー: " + error.message);
            }

            // 2. EmailJSで確認メールを申請者へ送信
            if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY") {
                emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    to_email:       email,
                    to_name:        username,
                    account_name:   username,
                    request_date:   nowStr,
                    reason:         reason || "（理由なし）"
                });
            }

            // 成功時の処理
            deleteRequestMsg.classList.add("success");
            deleteRequestMsg.textContent =
                "✅ 削除依頼を送信しました。登録メールアドレスに確認メールをお送りしました。";

            // フォームを受付済み表示に切り替え
            document.getElementById("delete-request-already-date").textContent =
                "受付日時：" + nowStr;
            deleteRequestAlready.style.display = "flex";
            deleteRequestFormWrap.style.display = "none";

        } catch (e) {
            deleteRequestMsg.textContent = "❌ 送信に失敗しました：" + e.message;
            btn.disabled = false;
            btn.textContent = "📨 マスターへ削除願いを送る";
        }
    });
});

