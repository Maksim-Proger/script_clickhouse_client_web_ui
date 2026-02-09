document.addEventListener("DOMContentLoaded", () => {
    // --- КОНФИГУРАЦИЯ ---
    const API_BASE = "http://192.168.100.113:8000"; // Убедись, что адрес верный

    // --- ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ---
    const loginForm = document.querySelector(".login-form");
    const loginPage = document.querySelector(".login-page");
    const appRoot = document.querySelector(".app");

    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");
    const btnLogout = document.getElementById("btnLogout");
    const currentUserSpan = document.getElementById("currentUser"); // Элемент для имени

    const uploadDialog = document.getElementById("uploadDialog");
    const exportDialog = document.getElementById("exportDialog");
    const container = document.getElementById("data-list");

    const fileInput = document.getElementById("fileInput");
    const btnUploadFile = document.getElementById("btnUploadFile");
    const btnConfirmExport = document.querySelector("#exportDialog .primary-button"); // Кнопка внутри модалки экспорта

    // --- СОСТОЯНИЕ ---
    let accessToken = localStorage.getItem("token") || null;
    let currentLogin = localStorage.getItem("login") || "User"; // Запоминаем логин
    let exportedData = [];

    // --- ПРОВЕРКА СЕССИИ ПРИ ЗАПУСКЕ ---
    if (accessToken) {
        showApp();
    }

    function showApp() {
        loginPage.classList.add("is-hidden");
        appRoot.classList.remove("is-hidden");
        currentUserSpan.textContent = currentLogin; // Обновляем имя в профиле
    }

    function showLogin() {
        appRoot.classList.add("is-hidden");
        loginPage.classList.remove("is-hidden");
        localStorage.removeItem("token");
        localStorage.removeItem("login");
        accessToken = null;
    }

    // --- АВТОРИЗАЦИЯ ---
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const login = loginForm.elements["login"].value.trim();
        const password = loginForm.elements["password"].value;

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login, password })
            });

            if (response.ok) {
                const data = await response.json();
                accessToken = data.access_token;
                currentLogin = login; // Сохраняем логин

                localStorage.setItem("token", accessToken);
                localStorage.setItem("login", currentLogin);

                showApp();
            } else {
                alert("Ошибка: Неверный логин или пароль");
            }
        } catch (err) {
            console.error(err);
            alert("Сервер авторизации недоступен");
        }
    });

    btnLogout.addEventListener("click", showLogin);

    // --- УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК ЗАПРОСОВ (BEARER) ---
    async function authFetch(url, options = {}) {
        options.headers = {
            ...options.headers,
            "Authorization": `Bearer ${accessToken}`
        };

        const response = await fetch(url, options);

        if (response.status === 401) {
            alert("Сессия истекла или неверный токен");
            showLogin();
            throw new Error("Unauthorized");
        }
        return response;
    }

    // --- ЛОГИКА ПРОФИЛЯ ---
    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("is-hidden");
    });
    window.addEventListener("click", () => profileMenu.classList.add("is-hidden"));

    // --- ЧТЕНИЕ ДАННЫХ (ClickHouse) ---
    async function requestCH() {
        try {
            container.innerHTML = "<p style='padding:20px'>Загрузка из CH...</p>";
            // Твой SQL запрос
            const sql = encodeURIComponent("SELECT * FROM feedgen.blocked_ips ORDER BY blocked_at DESC");

            const response = await authFetch(`${API_BASE}/ch/read?query=${sql}`);
            const result = await response.json();

            // Если формат ответа { data: [...] }, используем его, иначе result
            exportedData = result.data || result;

            // Проверка, является ли exportedData массивом
            if (!Array.isArray(exportedData)) {
                // Если пришла ошибка от CH в формате JSON
                exportedData = [];
                throw new Error("Некорректный формат ответа от сервера");
            }

            renderTable(exportedData);
        } catch (e) {
            if (e.message !== "Unauthorized") {
                container.innerHTML = `<p style='padding:20px; color:red'>Ошибка: ${e.message}</p>`;
            }
        }
    }

    function renderTable(data) {
        if (!data || data.length === 0) {
            container.innerHTML = "<p style='padding:20px'>Нет данных</p>";
            return;
        }

        // Динамическое создание заголовков на основе ключей первого объекта
        const headers = Object.keys(data[0]);

        let html = `<table><thead><tr>`;
        headers.forEach(h => html += `<th>${h}</th>`);
        html += `</tr></thead><tbody>`;

        data.forEach(row => {
            html += `<tr>`;
            headers.forEach(key => {
                 html += `<td>${row[key] !== null ? row[key] : ''}</td>`;
            });
            html += `</tr>`;
        });
        container.innerHTML = html + "</tbody></table>";
    }

    // --- ЗАПРОС В DG (NATS) ---
    async function requestDG() {
        try {
            const response = await authFetch(`${API_BASE}/dg/request`);
            if (response.ok) alert("Запрос в DG отправлен");
        } catch (e) {
            console.error(e);
        }
    }

    // --- ЗАГРУЗКА ФАЙЛА ---
    async function uploadFile() {
        if (!fileInput.files[0]) return alert("Выберите файл");

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

                // Отправляем JSON на сервер
                const response = await authFetch(`${API_BASE}/data/receive`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(jsonData)
                });

                if (response.ok) {
                    alert("Данные успешно загружены!");
                    uploadDialog.close();
                    fileInput.value = ""; // Очистить инпут
                } else {
                    alert("Ошибка при загрузке на сервер");
                }
            } catch (err) {
                console.error(err);
                if (err.message !== "Unauthorized") {
                    alert("Ошибка при обработке файла");
                }
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // --- ЭКСПОРТ (XLSX) ---
    function exportData() {
        if (!exportedData || !exportedData.length) return alert("Нет данных для экспорта");
        const ws = XLSX.utils.json_to_sheet(exportedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, 'export.xlsx');
        exportDialog.close();
    }

    // --- СОБЫТИЯ КНОПОК ---
    document.getElementById("btnCH").addEventListener("click", requestCH);
    document.getElementById("btnDG").addEventListener("click", requestDG);

    // Открытие модалок
    document.getElementById("btnUpload").addEventListener("click", () => uploadDialog.showModal());
    document.getElementById("btnExport").addEventListener("click", () => exportDialog.showModal());

    // Действия внутри модалок
    btnUploadFile.addEventListener("click", uploadFile);
    btnConfirmExport.addEventListener("click", exportData); // Привязали экспорт здесь
});