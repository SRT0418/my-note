window.addEventListener("load", () => {

    const params = new URLSearchParams(location.search);
    const editId = params.get("id");

    let schedules = JSON.parse(localStorage.getItem("schedules")) || [];

    // 編集モードの場合、該当データをフォームに表示する
    if (editId) {

        const schedule = schedules.find(s => s.id == editId);

        if (schedule) {
            document.getElementById("title").value = schedule.title;
            document.getElementById("partner").value = schedule.partner || "";
            document.getElementById("start-date").value = schedule.startDate;
            document.getElementById("end-date").value = schedule.endDate;
            document.getElementById("start-time").value = schedule.startTime || "";
            document.getElementById("end-time").value = schedule.endTime || "";

            // 詳細欄の初期値設定（存在する場合）
            const descEl = document.getElementById("description");
            if (descEl) descEl.value = schedule.description || "";

            document.getElementById("form-heading").textContent = "予定編集";
            document.getElementById("save-button").textContent = "更新";
            document.getElementById("save-button").dataset.editId = editId;
        }
    }

    // 保存ボタン：新規追加 or 編集更新を切り替える
    document.getElementById("save-button").addEventListener("click", () => {

        let schedules = JSON.parse(localStorage.getItem("schedules")) || [];
        const editId = document.getElementById("save-button").dataset.editId;

        const title = document.getElementById("title").value.trim();
        const partner = document.getElementById("partner").value.trim();
        const startDate = document.getElementById("start-date").value;
        const endDate = document.getElementById("end-date").value || startDate;
        const startTime = document.getElementById("start-time").value;
        const endTime = document.getElementById("end-time").value;

        const descEl = document.getElementById("description");
        const description = descEl ? descEl.value : "";

        // 入力チェック
        if (!title) {
            alert("題を入力してください。");
            return;
        }

        if (!startDate) {
            alert("日付を入力してください。");
            return;
        }

        if (endDate < startDate) {
            alert("終了日は開始日より後の日付にしてください。");
            return;
        }

        // 保存する予定オブジェクトの作成
        const schedule = {
            id: editId || Date.now().toString(),
            title: title,
            partner: partner,
            startDate: startDate,
            endDate: endDate,
            startTime: startTime,
            endTime: endTime,
            description: description // 詳細欄
        };

        // データの保存（変数名を schedule に統一）
        if (editId) {
            const idx = schedules.findIndex(s => s.id == editId);
            if (idx !== -1) schedules[idx] = schedule;
        } else {
            schedules.push(schedule);
        }

        localStorage.setItem("schedules", JSON.stringify(schedules));
        location.href = "calendar.html";
    });

    // キャンセルボタン：一覧画面へ戻る
    document.getElementById("cancel-button").addEventListener("click", () => {
        location.href = "calendar.html";
    });
});