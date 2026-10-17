document.addEventListener('DOMContentLoaded', () => {
    cargarDashboard();
    document.getElementById('btn-inferir').addEventListener('click', ejecutarInferencia);
});

async function cargarDashboard() {
    try {
        const resp = await fetch('/api/dashboard');
        const datos = await resp.json();
        document.getElementById('total-registros').textContent = datos.estadisticas.total_registros || 0;
        document.getElementById('total-anomalias').textContent = datos.estadisticas.total_detecciones || 0;
        document.getElementById('total-motores').textContent = datos.motores.length;
        document.getElementById('umbral').textContent = datos.estadisticas.umbral ? datos.estadisticas.umbral.toFixed(6) : '-';

        const tbody = document.querySelector('#tabla-anomalias tbody');
        tbody.innerHTML = '';
        const historial = datos.historial || [];
        historial.forEach((d) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.fecha || '-'}</td>
                <td>${d.hora || '-'}</td>
                <td>${d.motor_id}</td>
                <td><span class="severidad ${d.severidad}">${d.severidad}</span></td>
                <td>${d.error_reconstruccion.toFixed(4)}</td>
                <td>${d.tipo_interpretacion}</td>
            `;
            tbody.appendChild(tr);
        });

        const contenedorMotores = document.getElementById('lista-motores');
        contenedorMotores.innerHTML = '';
        (datos.motores || []).forEach((m) => {
            const div = document.createElement('div');
            div.className = 'motor-card';
            div.innerHTML = `<h3>${m}</h3><p>Motor activo en la base de datos.</p>`;
            contenedorMotores.appendChild(div);
        });
    } catch (e) {
        console.error('Error cargando dashboard:', e);
    }
}

async function ejecutarInferencia() {
    const estado = document.getElementById('estado-inferencia');
    estado.textContent = 'Ejecutando...';
    try {
        const resp = await fetch('/api/inferir', { method: 'POST' });
        const datos = await resp.json();
        estado.textContent = `Inferencia completada. Detecciones guardadas: ${datos.detecciones_guardadas}`;
        cargarDashboard();
    } catch (e) {
        estado.textContent = 'Error en la inferencia.';
        console.error(e);
    }
}
