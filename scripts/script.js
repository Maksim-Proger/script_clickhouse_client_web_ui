import * as Auth from './auth.js'; // Импортируем auth.js

document.addEventListener("DOMContentLoaded", () => {

    // --- ЭЛЕМЕНТЫ UI ---
    const loginForm = document.querySelector(".login-form");
    const loginPage = document.querySelector(".login-page");
    const appRoot = document.querySelector(".app");
    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");
    const btnLogout = document.getElementById("btnLogout");
    const currentUserSpan = document.getElementById("currentUser");
    const uploadDialog = document.getElementById("uploadDialog");
    const exportDialog = document.getElementById("exportDialog");
    const container = document.getElementById("data-list");
    const fileInput = document.getElementById("fileInput");
    const btnUploadFile = document.getElementById("btnUploadFile");
    const btnConfirmExport = document.querySelector("#exportDialog .primary-button");

    let exportedData = [];

    // --- ИНИЦИАЛИЗАЦИЯ ---

    // Говорим модулю Auth: "Если токен протух, запусти функцию showLogin"
    Auth.setSessionExpiredHandler(showLogin);

    // Проверка старта
    if (Auth.isAuthenticated()) {
        showApp();
    } else {
        showLogin();
    }

    // --- УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ---

    function showApp() {
        loginPage.classList.add("is-hidden");
        appRoot.classList.remove("is-hidden");
        // Берем имя пользователя из модуля
        currentUserSpan.textContent = Auth.getCurrentLogin();
    }

    function showLogin() {
        appRoot.classList.add("is-hidden");
        loginPage.classList.remove("is-hidden");
        Auth.logout();
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const login = loginForm.elements["login"].value.trim();
        const password = loginForm.elements["password"].value;

        try {
            // Вызываем логин из модуля
            const success = await Auth.login(login, password);
            if (success) {
                showApp();
                loginForm.reset();
            } else {
                alert("Ошибка: Неверный логин или пароль");
            }
        } catch (err) {
            console.error(err);
            alert("Сервер недоступен");
        }
    });

    btnLogout.addEventListener("click", showLogin);

    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("is-hidden");
    });
    window.addEventListener("click", () => profileMenu.classList.add("is-hidden"));

    // --- БИЗНЕС-ЛОГИКА (ЗАПРОСЫ) ---

    async function requestCH() {
        try {
            container.innerHTML = "<p style='padding:20px'>Загрузка...</p>";
            const sql = encodeURIComponent("SELECT * FROM feedgen.blocked_ips ORDER BY blocked_at DESC");

            // Используем Auth.API_BASE и Auth.authFetch
            const url = `${Auth.API_BASE}/ch/read?query=${sql}`;

            const response = await Auth.authFetch(url);
            const result = await response.json();

            exportedData = result.data || result;

            if (!Array.isArray(exportedData)) throw new Error("Некорректный ответ");

            renderTable(exportedData);
        } catch (e) {
            if (e.message !== "Unauthorized") {
                container.innerHTML = `<p style='padding:20px; color:red'>Ошибка: ${e.message}</p>`;
            }
        }
    }

    function renderTable(data) {
        if (!data.length) {
            container.innerHTML = "<p style='padding:20px'>Нет данных</p>";
            return;
        }
        const headers = Object.keys(data[0]);
        let html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

        data.forEach(row => {
            html += `<tr>${headers.map(key => `<td>${row[key] ?? ''}</td>`).join('')}</tr>`;
        });
        container.innerHTML = html + "</tbody></table>";
    }

    async function requestDG() {
        try {
            // Используем Auth.API_BASE
            const response = await Auth.authFetch(`${Auth.API_BASE}/dg/request`);
            if (response.ok) alert("Запрос отправлен");
        } catch (e) { console.error(e); }
    }

    async function uploadFile() {
        if (!fileInput.files[0]) return alert("Выберите файл");
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                // Используем Auth.API_BASE
                const response = await Auth.authFetch(`${Auth.API_BASE}/data/receive`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(jsonData)
                });

                if (response.ok) {
                    alert("Загружено!");
                    uploadDialog.close();
                    fileInput.value = "";
                } else {
                    alert("Ошибка загрузки");
                }
            } catch (err) {
                if (err.message !== "Unauthorized") alert("Ошибка обработки файла");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function exportData() {
        if (!exportedData?.length) return alert("Нет данных");
        const ws = XLSX.utils.json_to_sheet(exportedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, 'export.xlsx');
        exportDialog.close();
    }

    // Привязка кнопок
    document.getElementById("btnCH").addEventListener("click", requestCH);
    document.getElementById("btnDG").addEventListener("click", requestDG);
    document.getElementById("btnUpload").addEventListener("click", () => uploadDialog.showModal());
    document.getElementById("btnExport").addEventListener("click", () => exportDialog.showModal());
    btnUploadFile.addEventListener("click", uploadFile);
    btnConfirmExport.addEventListener("click", exportData);
});
