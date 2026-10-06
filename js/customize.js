/* =========================================================
   MyNote 機能カスタマイズ画面 ロジック (customize.js)
   ========================================================= */

window.addEventListener("load", () => {
    const auth = window.MyNoteAuth;
    const featuresModule = window.MyNoteFeatures;

    if (!auth || !auth.getCurrentUser()) {
        location.href = "login.html";
        return;
    }

    if (!featuresModule) {
        alert("機能モジュールが読み込めませんでした。");
        return;
    }

    const allFeatures = featuresModule.ALL_FEATURES;
    let selectedSet = new Set(featuresModule.getEnabledFeatureIds());

    const grid = document.getElementById("features-custom-grid");
    const countBadge = document.getElementById("customize-count-badge");
    const btnSave = document.getElementById("btn-save-features");
    const btnSaveTop = document.getElementById("btn-save-features-top");
    const btnBackAccount = document.getElementById("btn-back-account");
    const btnBackHome = document.getElementById("btn-back-home");

    // プリセットボタン
    const presetAll = document.getElementById("preset-all");
    const presetStudent = document.getElementById("preset-student");
    const presetMinimal = document.getElementById("preset-minimal");
    const presetClear = document.getElementById("preset-clear");

    function renderCards() {
        if (!grid) return;
        grid.innerHTML = allFeatures.map(f => {
            const isChecked = selectedSet.has(f.id);
            return `
                <div class="card feature-card ${isChecked ? "active" : ""}" data-id="${f.id}">
                    <div class="feature-card-header">
                        <span class="feature-card-icon">${f.icon}</span>
                        <div class="feature-card-title-group">
                            <span class="feature-category-badge">${f.category || "機能"}</span>
                            <h3 class="feature-card-title">${f.name}</h3>
                        </div>
                        <label class="switch-toggle" onclick="event.stopPropagation();">
                            <input type="checkbox" class="feature-checkbox" data-id="${f.id}" ${isChecked ? "checked" : ""}>
                            <span class="slider"></span>
                        </label>
                    </div>
                    <p class="feature-card-desc">${f.desc}</p>
                    <div class="feature-card-footer">
                        <span class="feature-status-text ${isChecked ? "enabled" : "disabled"}">
                            ${isChecked ? "● 有効（表示中）" : "○ 無効（非表示）"}
                        </span>
                        <a href="${f.url}" class="feature-preview-link" onclick="event.stopPropagation();">ページを開く ↗</a>
                    </div>
                </div>
            `;
        }).join("");

        updateCountBadge();
        bindCardEvents();
    }

    function updateCountBadge() {
        if (countBadge) {
            countBadge.textContent = `${selectedSet.size} / ${allFeatures.length} 機能が有効`;
            if (selectedSet.size === 0) {
                countBadge.style.background = "#fee2e2";
                countBadge.style.color = "#b91c1c";
            } else {
                countBadge.style.background = "#e0f2fe";
                countBadge.style.color = "#0369a1";
            }
        }
    }

    function bindCardEvents() {
        grid.querySelectorAll(".feature-card").forEach(card => {
            const featId = card.dataset.id;
            const cb = card.querySelector(".feature-checkbox");

            // カード全体クリックでON/OFFトグル
            card.addEventListener("click", () => {
                if (selectedSet.has(featId)) {
                    selectedSet.delete(featId);
                } else {
                    selectedSet.add(featId);
                }
                renderCards();
            });

            // スイッチ直接操作時
            if (cb) {
                cb.addEventListener("change", (e) => {
                    e.stopPropagation();
                    if (cb.checked) {
                        selectedSet.add(featId);
                    } else {
                        selectedSet.delete(featId);
                    }
                    renderCards();
                });
            }
        });
    }

    // プリセット適用
    if (presetAll) {
        presetAll.addEventListener("click", () => {
            selectedSet = new Set(allFeatures.map(f => f.id));
            renderCards();
            showToast("全機能を選択しました");
        });
    }

    if (presetStudent) {
        presetStudent.addEventListener("click", () => {
            selectedSet = new Set(["kadai", "tasks", "calendar", "report"]);
            renderCards();
            showToast("学生・学習向けプリセットを適用しました");
        });
    }

    if (presetMinimal) {
        presetMinimal.addEventListener("click", () => {
            selectedSet = new Set(["tasks", "everydayTask", "calendar"]);
            renderCards();
            showToast("シンプルプリセットを適用しました");
        });
    }

    if (presetClear) {
        presetClear.addEventListener("click", () => {
            selectedSet.clear();
            renderCards();
            showToast("すべての機能を解除しました");
        });
    }

    // 保存処理
    async function handleSave() {
        const arr = Array.from(selectedSet);
        const originalText = btnSave ? btnSave.textContent : "";
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.textContent = "保存中...";
        }
        if (btnSaveTop) btnSaveTop.disabled = true;

        try {
            await featuresModule.saveEnabledFeatureIds(arr);
            showToast("🎉 機能カスタマイズを保存しました！", 3500);
        } catch (e) {
            alert("保存に失敗しました: " + e.message);
        } finally {
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.textContent = originalText;
            }
            if (btnSaveTop) btnSaveTop.disabled = false;
        }
    }

    if (btnSave) btnSave.addEventListener("click", handleSave);
    if (btnSaveTop) btnSaveTop.addEventListener("click", handleSave);

    if (btnBackAccount) {
        btnBackAccount.addEventListener("click", () => {
            location.href = "account.html";
        });
    }

    if (btnBackHome) {
        btnBackHome.addEventListener("click", () => {
            location.href = "index.html";
        });
    }

    // トースト通知関数
    function showToast(msg, duration = 2500) {
        let toast = document.getElementById("customize-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "customize-toast";
            toast.className = "draft-toast";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = "block";
        toast.style.opacity = "1";

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => { toast.style.display = "none"; }, 300);
        }, duration);
    }

    // 初期描画
    renderCards();
});
