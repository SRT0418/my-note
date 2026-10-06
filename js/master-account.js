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
    const featureFilter = document.getElementById("master-feature-filter");
    const reloadBtn = document.getElementById("btn-reload-users");
    const backBtn = document.getElementById("btn-back-home");
    const tbody = document.getElementById("master-user-tbody");

    backBtn.addEventListener("click", () => {
        location.href = "index.html";
    });

    async function fetchAndRenderUsers() {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #888;">
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
        const feat = featureFilter ? featureFilter.value : "all";

        const filtered = allProfiles.filter(p => {
            const matchQuery = !query ||
                (p.username && p.username.toLowerCase().includes(query)) ||
                (p.email && p.email.toLowerCase().includes(query));
            const matchRole = role === "all" || p.role === role;
            const matchStatus = status === "all" || p.status === status;
            const userFeats = Array.isArray(p.custom_features)
                ? p.custom_features
                : (window.MyNoteFeatures ? window.MyNoteFeatures.getDefaultFeatureIds() : []);
            const matchFeat = feat === "all" || userFeats.includes(feat);
            return matchQuery && matchRole && matchStatus && matchFeat;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #888;">
                        該当するユーザーが見つかりません。
                    </td>
                </tr>
            `;
            return;
        }

        const currentAdminId = auth.getCurrentUserId();
        const allFeatDefs = window.MyNoteFeatures ? window.MyNoteFeatures.ALL_FEATURES : [];

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

            // カスタマイズ機能バッジ表示
            const userFeats = Array.isArray(p.custom_features) && p.custom_features.length > 0
                ? p.custom_features
                : (window.MyNoteFeatures ? window.MyNoteFeatures.getDefaultFeatureIds() : []);

            const featTags = userFeats.map(fid => {
                const def = allFeatDefs.find(f => f.id === fid);
                return def
                    ? `<span class="master-feat-tag" title="${def.name}">${def.icon} ${def.name.slice(0, 4)}</span>`
                    : `<span class="master-feat-tag">${fid}</span>`;
            }).join("");

            const featCellHtml = userFeats.length === 0
                ? '<span style="color:#ef4444; font-size:12px; font-weight:bold;">なし (0機能)</span>'
                : `<div class="master-feats-wrap">${featTags}</div><div class="master-feat-count">${userFeats.length} / ${allFeatDefs.length} 機能</div>`;

            let actionHtml = "";
            if (isSelf) {
                actionHtml = '<span class="self-user-label">👤 ログイン中</span>';
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
                    <td class="col-username"><strong>${escapeHtml(p.username)}</strong></td>
                    <td class="col-email">${escapeHtml(p.email || "-")}</td>
                    <td class="col-role">${roleBadge}</td>
                    <td class="col-status">${statusBadge}</td>
                    <td class="col-features">${featCellHtml}</td>
                    <td class="col-created">${formatDate(p.created_at)}</td>
                    <td class="col-actions">${actionHtml}</td>
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

    // ============================================================
    // アカウント削除依頼の読み込み・表示
    // ============================================================
    const deleteRequestsList = document.getElementById("delete-requests-list");
    const pendingBadge = document.getElementById("delete-req-pending-badge");

    async function fetchAndRenderDeleteRequests() {
        deleteRequestsList.innerHTML = '<div class="delete-req-loading">読み込み中...</div>';

        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        if (!client) {
            deleteRequestsList.innerHTML =
                '<div class="delete-req-empty">Supabaseが設定されていないため、削除依頼を取得できません。</div>';
            return;
        }

        const { data: requests, error } = await client
            .from("delete_requests")
            .select("*")
            .order("requested_at", { ascending: false });

        if (error) {
            deleteRequestsList.innerHTML =
                `<div class="delete-req-empty">取得エラー: ${escapeHtml(error.message)}</div>`;
            return;
        }

        if (!requests || requests.length === 0) {
            deleteRequestsList.innerHTML =
                '<div class="delete-req-empty">現在、アカウント削除依頼はありません。</div>';
            pendingBadge.style.display = "none";
            return;
        }

        const pendingCount = requests.filter(r => r.status === "pending").length;
        if (pendingCount > 0) {
            pendingBadge.textContent = `未対応 ${pendingCount} 件`;
            pendingBadge.style.display = "inline-flex";
        } else {
            pendingBadge.style.display = "none";
        }

        deleteRequestsList.innerHTML = requests.map(r => {
            const isPending = r.status === "pending";
            const statusClass = isPending ? "req-status-pending" : "req-status-done";
            const statusText = isPending ? "⏳ 未対応" : "✅ 対応済み";

            return `
            <div class="delete-req-card ${isPending ? "delete-req-card--pending" : "delete-req-card--done"}">
                <div class="delete-req-card-header">
                    <div class="delete-req-user-info">
                        <span class="delete-req-username">👤 ${escapeHtml(r.username)}</span>
                        <span class="delete-req-email">${escapeHtml(r.email)}</span>
                    </div>
                    <span class="delete-req-status ${statusClass}">${statusText}</span>
                </div>
                <div class="delete-req-card-body">
                    <div class="delete-req-date">📅 受付日時：${formatDate(r.requested_at)}</div>
                    <div class="delete-req-reason">
                        💬 理由：${r.reason ? escapeHtml(r.reason) : '<span class="delete-req-no-reason">（理由なし）</span>'}
                    </div>
                </div>
                <div class="delete-req-card-actions">
                    ${isPending ? `
                    <a href="https://supabase.com/dashboard/project/oalbriraykbaftxcznjx/auth/users"
                       target="_blank" rel="noopener"
                       class="btn-supabase-link btn-supabase-link--small">
                        🔗 Supabase でアカウント削除
                    </a>
                    <button class="btn-action btn-req-done"
                            data-req-id="${r.id}"
                            data-req-username="${escapeHtml(r.username)}">
                        ✅ 対応済みにする
                    </button>
                    ` : `
                    <button class="btn-action btn-req-undo"
                            data-req-id="${r.id}"
                            data-req-username="${escapeHtml(r.username)}">
                        ↩️ 未対応に戻す
                    </button>
                    <button class="btn-action btn-req-delete"
                            data-req-id="${r.id}"
                            data-req-username="${escapeHtml(r.username)}">
                        🗑️ 依頼を削除
                    </button>
                    `}
                </div>
            </div>`;
        }).join("");

        bindDeleteRequestEvents();
    }

    function bindDeleteRequestEvents() {
        const client = window.MyNoteSupabase && window.MyNoteSupabase.isConfigured()
            ? window.MyNoteSupabase.getClient()
            : null;

        // 対応済みにする
        deleteRequestsList.querySelectorAll(".btn-req-done").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const reqId = e.target.getAttribute("data-req-id");
                const uname = e.target.getAttribute("data-req-username");
                if (!confirm(`「${uname}」の削除依頼を対応済みにしますか？\n※実際のアカウント削除はSupabaseダッシュボードで行ってください。`)) return;

                const { error } = await client
                    .from("delete_requests")
                    .update({ status: "done" })
                    .eq("id", reqId);

                if (error) {
                    alert("更新に失敗しました: " + error.message);
                } else {
                    await fetchAndRenderDeleteRequests();
                }
            });
        });

        // 未対応に戻す
        deleteRequestsList.querySelectorAll(".btn-req-undo").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const reqId = e.target.getAttribute("data-req-id");
                const { error } = await client
                    .from("delete_requests")
                    .update({ status: "pending" })
                    .eq("id", reqId);
                if (error) {
                    alert("更新に失敗しました: " + error.message);
                } else {
                    await fetchAndRenderDeleteRequests();
                }
            });
        });

        // 依頼レコードを削除
        deleteRequestsList.querySelectorAll(".btn-req-delete").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const reqId = e.target.getAttribute("data-req-id");
                const uname = e.target.getAttribute("data-req-username");
                if (!confirm(`「${uname}」の削除依頼レコードを完全に削除しますか？`)) return;
                const { error } = await client
                    .from("delete_requests")
                    .delete()
                    .eq("id", reqId);
                if (error) {
                    alert("削除に失敗しました: " + error.message);
                } else {
                    await fetchAndRenderDeleteRequests();
                }
            });
        });
    }

    // 削除依頼更新ボタン
    document.getElementById("btn-reload-delete-requests").addEventListener("click", fetchAndRenderDeleteRequests);

    // イベントバインド
    searchInput.addEventListener("input", renderFilteredUsers);
    roleFilter.addEventListener("change", renderFilteredUsers);
    statusFilter.addEventListener("change", renderFilteredUsers);
    if (featureFilter) featureFilter.addEventListener("change", renderFilteredUsers);
    reloadBtn.addEventListener("click", fetchAndRenderUsers);

    // 初期ロード
    await fetchAndRenderUsers();
    await fetchAndRenderDeleteRequests();
});

