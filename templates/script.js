document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector(".login-form");
    const loginPage = document.querySelector(".login-page");
    const appRoot = document.querySelector(".app");

    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");
    const btnLogout = document.getElementById("btnLogout");

    const uploadDialog = document.getElementById("uploadDialog");
    const exportDialog = document.getElementById("exportDialog");
    const container = document.getElementById("data-list");

    let exportedData = [];

    // АВТОРИЗАЦИЯ
    loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const login = loginForm.elements["login"].value.trim();
        const password = loginForm.elements["password"].value;

        if (login === "admin" && password === "admin") {
            loginPage.classList.add("is-hidden");
            appRoot.classList.remove("is-hidden");
        } else {
            alert("Ошибка входа");
        }
    });

    // ПРОФИЛЬ
    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("is-hidden");
    });

    window.addEventListener("click", () => profileMenu.classList.add("is-hidden"));

    btnLogout.addEventListener("click", () => {
        appRoot.classList.add("is-hidden");
        loginPage.classList.remove("is-hidden");
    });

    // ДИАЛОГИ
    document.getElementById("btnUpload").addEventListener("click", () => uploadDialog.showModal());
    document.getElementById("btnExport").addEventListener("click", () => exportDialog.showModal());

    // ЧТЕНИЕ ДАННЫХ
    async function requestCH() {
        try {
            container.innerHTML = "<p style='padding:20px'>Загрузка...</p>";
            const sqlQuery = encodeURIComponent("SELECT * FROM feedgen.blocked_ips ORDER BY blocked_at DESC");
            const response = await fetch(`http://192.168.100.113:8000/ch/read?query=${sqlQuery}&_ts=${Date.now()}`);
            const result = await response.json();
            exportedData = result.data;

            if (!exportedData || exportedData.length === 0) {
                container.innerHTML = "<p style='padding:20px'>Нет данных</p>";
                return;
            }

            let html = `<table><thead><tr>
                <th>Дата</th><th>IP</th><th>Источник</th><th>Профиль</th>
            </tr></thead><tbody>`;

            exportedData.forEach(row => {
                html += `<tr>
                    <td>${row.blocked_at || ''}</td>
                    <td>${row.ip_address || ''}</td>
                    <td>${row.source || ''}</td>
                    <td>${row.profile || ''}</td>
                </tr>`;
            });
            container.innerHTML = html + "</tbody></table>";
        } catch (e) {
            container.innerHTML = `<p style='padding:20px; color:red'>Ошибка: ${e.message}</p>`;
        }
    }

    // ЭКСПОРТ
    window.exportData = function() {
        if (!exportedData.length) return alert("Нет данных");
        const ws = XLSX.utils.json_to_sheet(exportedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, 'export.xlsx');
        exportDialog.close();
    };

    document.getElementById("btnCH").addEventListener("click", requestCH);
});