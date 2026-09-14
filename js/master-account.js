window.addEventListener("load", async () => {
    const auth = window.MyNoteAuth;

    // 1. 管理者権限チェック
    if (!auth || !auth.getCurrentUser()) {
        location.href = "login.html";
        return;
    }

    if (!auth.isAdmin()) {
        alert("管理者権限が必要です。");
        location.href = "index.html";
        return;
    }

    let allProfiles = [];

    const searchInput = document.getElementById("master-search-input");
    const roleFilter = document.getElementById("master-role-filter");
    const statusFilter = document.getElementById("master-status-filter");
    const reloadBtn = document.getElementById("btn-reload-users");
    const backBtn = document.getElementById("btn-back-home");
    const tbody = document.getElementById("master-user-tbody");

    backBtn.addEventListener("click", () => {
        location.href = "index.html";
    });

    async function fetchAndRenderUsers() {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: #888;">
                    ユーザー情報を読み込み中...
                </td>
            </tr>
        `;

        allProfiles = await auth.getProfiles();
        updateStats(allProfiles);
        renderFilteredUsers();
    }

    function updateStats(profiles) {
        document.getElementById("stat-total-users").textContent = profiles.length;
        document.getElementById("stat-admin-users").textContent =
            profiles.filter(p => p.role === "admin").length;
        document.getElementById("stat-active-users").textContent =
            profiles.filter(p => p.status === "active").length;
        document.getElementById("stat-suspended-users").textContent =
            profiles.filter(p => p.status === "suspended").length;
    }

    function formatDate(dateStr) {
        if (!dateStr) return "-";
        try {
            const d = new Date(dateStr);
            return d.getFullYear() + "/" +
                String(d.getMonth() + 1).padStart(2, "0") + "/" +
                String(d.getDate()).padStart(2, "0") + " " +
                String(d.getHours()).padStart(2, "0") + ":" +
                String(d.getMinutes()).padStart(2, "0");
        } catch (e) {
            return dateStr;
        }
    }

    function renderFilteredUsers() {
        const query = (searchInput.value || "").toLowerCase().trim();
        const role = roleFilter.value;
        const status = statusFilter.value;

        const filtered = allProfiles.filter(p => {
            const matchQuery = !query ||
                (p.username && p.username.toLowerCase().includes(query)) ||
                (p.email && p.email.toLowerCase().includes(query));
            const matchRole = role === "all" || p.role === role;
            const matchStatus = status === "all" || p.status === status;
            return matchQuery && matchRole && matchStatus;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px; color: #888;">
                        該当するユーザーが見つかりません。
                    </td>
                </tr>
            `;
            return;
        }

        const currentAdminId = auth.getCurrentUserId();

        tbody.innerHTML = filtered.map(p => {
            const isSelf = (currentAdminId && p.id === currentAdminId) ||
                (p.username.toLowerCase() === (auth.getCurrentUser() || "").toLowerCase());

            const roleBadge = p.role === "admin"
                ? '<span class="badge-admin">👑 管理者</span>'
                : '<span class="badge-user">👤 一般</span>';

            const statusBadge = p.status === "suspended"
                ? '<span class="badge-suspended">❄️ 一時凍結</span>'
                : '<span class="badge-active">✨ アクティブ</span>';

            const nextRole = p.role === "admin" ? "user" : "admin";
            const roleBtnText = p.role === "admin" ? "一般にする" : "管理者にする";

            const nextStatus = p.status === "suspended" ? "active" : "suspended";
            const statusBtnText = p.status === "suspended" ? "凍結解除" : "一時凍結";

            let actionHtml = "";
            if (isSelf) {
                actionHtml = '<span style="font-size: 0.85em; color: #888;">(現在のログインユーザー)</span>';
            } else {
                actionHtml = `
                    <div class="action-btns">
                        <button class="btn-action btn-role-toggle" data-id="${p.id}" data-role="${nextRole}">
                            ${roleBtnText}
                        </button>
                        <button class="btn-action btn-status-toggle" data-id="${p.id}" data-status="${nextStatus}">
                            ${statusBtnText}
                        </button>
                        <button class="btn-action btn-delete-user" data-id="${p.id}" data-username="${p.username}">
                            削除
                        </button>
                    </div>
                `;
            }

            return `
                <tr>
                    <td><strong>${escapeHtml(p.username)}</strong></td>
                    <td>${escapeHtml(p.email || "-")}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${formatDate(p.created_at)}</td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join("");

        bindActionEvents();
    }

    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function bindActionEvents() {
        // 権限変更
        tbody.querySelectorAll(".btn-role-toggle").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.getAttribute("data-id");
                const newRole = e.target.getAttribute("data-role");
                if (confirm(`このユーザーの権限を「${newRole}」に変更しますか？`)) {
                    const res = await auth.updateUserRole(id, newRole);
                    if (res.ok) {
                        fetchAndRenderUsers();
                    } else {
                        alert(res.message || "権限の変更に失敗しました。");
                    }
                }
            });
        });

        // ステータス変更 (凍結・有効化)
        tbody.querySelectorAll(".btn-status-toggle").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.getAttribute("data-id");
                const newStatus = e.target.getAttribute("data-status");
                const actionText = newStatus === "suspended" ? "一時凍結" : "アクティブ化";
                if (confirm(`このユーザーを${actionText}しますか？`)) {
                    const res = await auth.updateUserStatus(id, newStatus);
                    if (res.ok) {
                        fetchAndRenderUsers();
                    } else {
                        alert(res.message || "ステータス変更に失敗しました。");
                    }
                }
            });
        });

        // ユーザー削除
        tbody.querySelectorAll(".btn-delete-user").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.target.getAttribute("data-id");
                const username = e.target.getAttribute("data-username");
                if (confirm(`ユーザー「${username}」と関連データを完全に削除しますか？この操作は元に戻せません。`)) {
                    const res = await auth.deleteUserByAdmin(id, username);
                    if (res.ok) {
                        alert(`ユーザー「${username}」を削除しました。`);
                        fetchAndRenderUsers();
                    } else {
                        alert(res.message || "ユーザーの削除に失敗しました。");
                    }
                }
            });
        });
    }

    // イベントバインド
    searchInput.addEventListener("input", renderFilteredUsers);
    roleFilter.addEventListener("change", renderFilteredUsers);
    statusFilter.addEventListener("change", renderFilteredUsers);
    reloadBtn.addEventListener("click", fetchAndRenderUsers);

    // 初期ロード
    await fetchAndRenderUsers();
});
