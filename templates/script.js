document.addEventListener("DOMContentLoaded", () => { // Ждем загрузки DOM

    const btnDG = document.getElementById("btnDG");
    const btnCH = document.getElementById("btnCH");
    const btnUpload = document.getElementById("btnUpload");
    const btnExport = document.getElementById("btnExport");
    const uploadDialog = document.getElementById("uploadDialog");
    const exportDialog = document.getElementById("exportDialog");
    const container = document.getElementById("data-list"); // Контейнер для CH данных

    btnDG.addEventListener("click", requestDG);
    btnCH.addEventListener("click", requestCH);
    btnUpload.addEventListener("click", () => uploadDialog.showModal());
    btnExport.addEventListener("click", () => exportDialog.showModal());

    async function requestDG() {
        try {
            const response = await fetch('http://192.168.100.113:8000/dg/request');
            const data = await response.json();
            alert(JSON.stringify(data));
        } catch (e) {
            alert("Ошибка запроса DG: " + e.message);
        }
    }

    async function requestCH() {
        try {
            const sqlQuery = encodeURIComponent("SELECT * FROM feedgen.blocked_ips ORDER BY blocked_at DESC");
            const response = await fetch(`http://192.168.100.113:8000/ch/read?query=${sqlQuery}&_ts=${Date.now()}`);
            const result = await response.json();

            const rows = result.data;

            if (!rows || rows.length === 0) {
                container.innerHTML = "<p>Данные отсутствуют</p>";
                return;
            }

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

            rows.forEach(row => {
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

            // Плавное появление таблицы
            container.innerHTML = "";
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = html;
            tempDiv.style.opacity = 0;
            container.appendChild(tempDiv);

            let opacity = 0;
            const fadeIn = setInterval(() => {
                opacity += 0.05;
                tempDiv.style.opacity = opacity;
                if (opacity >= 1) clearInterval(fadeIn);
            }, 15);

        } catch (e) {
            alert("Ошибка запроса CH: " + e.message);
        }
    }

});
