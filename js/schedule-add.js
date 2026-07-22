window.addEventListener("load", () => {

    const params = new URLSearchParams(location.search);
    const editId = params.get("id");

    const getStoredSchedules = () => {
        const primary = localStorage.getItem("schedules");
        if (primary) {
            try { return JSON.parse(primary); } catch (e) {}
        }
        const fallback = localStorage.getItem("secret_base_schedules");
        if (fallback) {
            try { return JSON.parse(fallback); } catch (e) {}
        }
        return [];
    };

    let schedules = getStoredSchedules();

    // 編集モードの場合、該当データをフォームに表示
    if (editId) {
        const schedule = schedules.find(s => s.id == editId);

        if (schedule) {
            document.getElementById("title").value = schedule.title || "";
            document.getElementById("partner").value = schedule.partner || "";
            
            const locEl = document.getElementById("location");
            if (locEl) locEl.value = schedule.location || "";

            document.getElementById("start-date").value = schedule.startDate || "";
            document.getElementById("end-date").value = schedule.endDate || "";
            document.getElementById("start-time").value = schedule.startTime || "";
            document.getElementById("end-time").value = schedule.endTime || "";

            const descEl = document.getElementById("description");
            if (descEl) descEl.value = schedule.description || "";

            document.getElementById("form-heading").textContent = "予定編集";
            document.getElementById("save-button").textContent = "更新";
            document.getElementById("save-button").dataset.editId = editId;
        }
    }

    // 保存ボタンのイベント
    document.getElementById("save-button").addEventListener("click", () => {

        let schedules = getStoredSchedules();
        const editId = document.getElementById("save-button").dataset.editId;

        const title = document.getElementById("title").value.trim();
        const partner = document.getElementById("partner").value.trim();
        const locEl = document.getElementById("location");
        const locationVal = locEl ? locEl.value.trim() : "";

        const startDate = document.getElementById("start-date").value;
        const endDate = document.getElementById("end-date").value || startDate;
        const startTime = document.getElementById("start-time").value;
        const endTime = document.getElementById("end-time").value;
        
        const descEl = document.getElementById("description");
        const description = descEl ? descEl.value : "";

        if (!title) {
            alert("タイトルを入力してください。");
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

        const schedule = {
            id: editId ? (isNaN(editId) ? editId : Number(editId)) : Date.now(),
            title: title,
            partner: partner,
            location: locationVal,
            startDate: startDate,
            endDate: endDate,
            startTime: startTime,
            endTime: endTime,
            description: description
        };

        if (editId) {
            const idx = schedules.findIndex(s => s.id == editId);
            if (idx !== -1) {
                schedules[idx] = schedule;
            } else {
                schedules.push(schedule);
            }
        } else {
            schedules.push(schedule);
        }

        localStorage.setItem("schedules", JSON.stringify(schedules));
        localStorage.setItem("secret_base_schedules", JSON.stringify(schedules));

        location.href = "calendar.html";
    });

    document.getElementById("cancel-button").addEventListener("click", () => {
        location.href = "calendar.html";
    });
});