document.addEventListener("DOMContentLoaded", () => { // Ждем загрузки DOM

    const loginForm = document.querySelector(".login-form");
    const loginPage = document.querySelector(".login-page");
    const appRoot = document.querySelector(".app");

    const btnDG = document.getElementById("btnDG"); // Получить данные из DG
    const btnCH = document.getElementById("btnCH"); // Чтение данных из CH
    const btnUpload = document.getElementById("btnUpload"); // Добавить данные
    const btnExport = document.getElementById("btnExport"); // Экспорт данных

    const btnUploadFile = document.getElementById("btnUploadFile"); // Загрузить
    const fileInput = document.getElementById("fileInput"); // Выберите файл

    const container = document.getElementById("data-list"); // Контейнер для вывода данных

    const uploadDialog = document.getElementById("uploadDialog"); // Диалог загрузки файла
    const exportDialog = document.getElementById("exportDialog"); // Диалог экспорта файла

    let exportedData = []; // Глобальная переменная для хранения данных

    if (loginForm && loginPage && appRoot) {
        loginForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const login = loginForm.elements["login"]?.value.trim();
            const password = loginForm.elements["password"]?.value;

            // Проверка логина и пароля (временный тестовый доступ)
            if (login === "admin" && password === "admin") {
                loginPage.classList.add("is-hidden");
                appRoot.classList.remove("is-hidden");
                return;
            }

            alert("Неверный логин или пароль.");
        });
    }

    // Обработчики для кнопок
    if (btnDG) {
        btnDG.addEventListener("click", requestDG);
    }
    if (btnCH) {
        btnCH.addEventListener("click", requestCH);
    }
    if (btnUpload && uploadDialog) {
        btnUpload.addEventListener("click", () => uploadDialog.showModal());
    }
    if (btnExport && exportDialog) {
        btnExport.addEventListener("click", () => exportDialog.showModal());
    }

    if (btnUploadFile) {
        btnUploadFile.addEventListener("click", handleFileUpload);
    }

    // Обработчик выбора файла
    if (fileInput) {
        fileInput.addEventListener("change", handleFileSelection);
    }

    // Обработчик для выбора формата экспорта
    if (exportDialog) {
        exportDialog.querySelector('button').addEventListener('click', exportData);
    }

    // Экспорт в XLSX
    function exportToXLSX(data) {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Blocked IPs");
        XLSX.writeFile(wb, 'data.xlsx');
    }

    // Обработка выбора файла
    function handleFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;
    }

    // Запрос данных DG
    async function requestDG() {
        try {
            const response = await fetch('http://192.168.100.113:8000/dg/request');
            const data = await response.json();
            alert(JSON.stringify(data));
        } catch (e) {
            alert("Ошибка запроса DG: " + e.message);
        }
    }

    // Экспорт данных в зависимости от выбранного формата
    async function exportData() {
        const selectedFormat = document.querySelector('input[name="exportFormat"]:checked')?.value;
        if (!selectedFormat) {
            alert("Пожалуйста, выберите формат для экспорта.");
            return;
        }

        if (!exportedData || exportedData.length === 0) {
            alert("Нет данных для экспорта.");
            return;
        }

        switch (selectedFormat) {
            case 'xlsx':
                exportToXLSX(exportedData);
                break;
            default:
                alert("Неподдерживаемый формат");
        }
    }

    // Обработка загрузки файла
    async function handleFileUpload() {
        const file = fileInput.files[0]; // Получаем выбранный файл
        if (!file) return;

        // Закрываем диалог после загрузки файла
        uploadDialog.close();

        // Проверка типа файла
        if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const data = e.target.result;

                try {
                    // Чтение XLSX файла
                    const workbook = XLSX.read(data, { type: "binary" });

                    const sheetName = workbook.SheetNames[0]; // Берем первый лист
                    const worksheet = workbook.Sheets[sheetName];
                    // Преобразование листа в JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    // Обновляем данные для экспорта
                    exportedData = jsonData;

                    // Отправка данных на сервер
                    await sendDataToScriptChClient(jsonData);

                } catch (error) {
                    console.error("Ошибка при обработке файла:", error);
                }
            };

            // Чтение файла как бинарных данных
            reader.readAsBinaryString(file);
        } else {
            alert("Пожалуйста, выберите файл в формате XLSX.");
        }
    }

    // Функция для отправки данных в script_ch_client
    async function sendDataToScriptChClient(data) {
        try {
            const response = await fetch('http://192.168.100.113:8000/data/receive', {  // Новый endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),  // Отправка данных в виде JSON
            });

            if (response.ok) {
                alert("Данные успешно отправлены в script_ch_client");
            } else {
                alert("Ошибка отправки данных в script_ch_client");
            }
        } catch (error) {
            console.error("Ошибка при отправке данных на сервер:", error);
        }
    }


    // Запрос данных CH
    async function requestCH() {
        try {
            const sqlQuery = encodeURIComponent("SELECT * FROM feedgen.blocked_ips ORDER BY blocked_at DESC");
            const response = await fetch(`http://192.168.100.113:8000/ch/read?query=${sqlQuery}&_ts=${Date.now()}`);
            const result = await response.json();
            exportedData = result.data; // Сохраняем данные для экспорта

            if (!exportedData || exportedData.length === 0) {
                container.innerHTML = "<p>Данные отсутствуют</p>";
                return;
            }

            // Заполняем таблицу с данными
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>blocked_at</th>
                            <th>ip_address</th>
                            <th>source</th>
                            <th>profile</th>
                            <th>created_at</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            exportedData.forEach(row => {
                html += `
                    <tr>
                        <td>${row.blocked_at}</td>
                        <td>${row.ip_address}</td>
                        <td>${row.source}</td>
                        <td>${row.profile}</td>
                        <td>${row.created_at}</td>
                    </tr>
                `;
            });

            html += "</tbody></table>";
            container.innerHTML = html;

        } catch (e) {
            alert("Ошибка запроса CH: " + e.message);
        }
    }

});
