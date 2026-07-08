window.addEventListener("load", () => {

    const params = new URLSearchParams(location.search);
    const editId = params.get("id");

    let items = JSON.parse(localStorage.getItem("wishItems")) || [];

    if (editId) {

        const item = items.find(i => i.id == editId);

        if (item) {
            document.getElementById("title").value = item.title;
            document.getElementById("partner").value = item.partner || "";
            document.getElementById("content").value = item.content || "";
            document.getElementById("detail").value = item.detail || "";

            document.getElementById("save-button").textContent = "更新";
            document.getElementById("save-button").dataset.editId = editId;
        }
    }

    document.getElementById("save-button").addEventListener("click", () => {

        let items = JSON.parse(localStorage.getItem("wishItems")) || [];
        const editId = document.getElementById("save-button").dataset.editId;

        const title = document.getElementById("title").value.trim();
        const partnerInput = document.getElementById("partner").value.trim();
        const partner = partnerInput === "" ? "自分" : partnerInput; // 空欄は自分のしたいこと扱い
        const content = document.getElementById("content").value.trim();
        const detail = document.getElementById("detail").value.trim();

        if (!title) {
            alert("タイトルを入力してください。");
            return;
        }

        if (editId) {
            const kadai = items.findIndex(i => i.id == editId);
            if (kadai !== -1) {
                items[kadai].title = title;
                items[kadai].partner = partner;
                items[kadai].content = content;
                items[kadai].detail = detail;
                // createdAtは編集時も変更しない
            }
        } else {
            items.push({
                id: Date.now(),
                title: title,
                partner: partner,
                content: content,
                detail: detail,
                achieved: false,
                achievedAt: null,
                createdAt: new Date().toISOString()
            });
        }

        localStorage.setItem("wishItems", JSON.stringify(items));
        location.href = "wishlist.html";
    });

    document.getElementById("cancel-button").addEventListener("click", () => {
        location.href = "wishlist.html";
    });
});
