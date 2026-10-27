"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const inferir = document.getElementById("btn-inferir");
    const formulario = document.getElementById("asistente-formulario");
    if (inferir) inferir.addEventListener("click", ejecutarInferencia);
    if (formulario) formulario.addEventListener("submit", enviarPregunta);

    document.querySelectorAll(".pregunta-rapida").forEach((boton) => {
        boton.addEventListener("click", () => {
            const input = document.getElementById("asistente-input");
            if (!input) return;
            input.value = boton.dataset.pregunta || "";
            input.focus();
            formulario?.requestSubmit();
        });
    });

    cargarDashboard();
    comprobarOllama();
    // Refresca los contadores y detecciones cuando llega nueva telemetría.
    window.setInterval(cargarDashboard, 10000);
    window.setInterval(comprobarOllama, 15000);
});

async function pedirJson(url, opciones = {}) {
    const respuesta = await fetch(url, {
        cache: "no-store",
        ...opciones,
        headers: { Accept: "application/json", ...(opciones.headers || {}) }
    });
    let datos;
    try {
        datos = await respuesta.json();
    } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
    }
    if (!respuesta.ok || datos.ok === false) {
        throw new Error(datos.error || `Error HTTP ${respuesta.status}`);
    }
    return datos;
}

async function cargarDashboard() {
    const estado = document.getElementById("estado-inferencia");
    try {
        const datos = await pedirJson("/api/dashboard");
        const estadisticas = datos.estadisticas || {};
        ponerTexto("total-registros", estadisticas.total_registros ?? 0);
        ponerTexto("total-anomalias", estadisticas.total_detecciones ?? 0);
        ponerTexto("total-motores", (datos.motores || []).length);
        ponerTexto("umbral", Number.isFinite(Number(estadisticas.umbral))
            ? Number(estadisticas.umbral).toPrecision(5) : "No disponible");
        dibujarHistorial(datos.historial || []);
        if (estado) estado.textContent = "Información actualizada.";
    } catch (error) {
        if (estado) estado.textContent = `No se pudo cargar el dashboard: ${error.message}`;
        console.error("EdgeMant dashboard:", error);
    }
}

function ponerTexto(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = String(valor);
}

function dibujarHistorial(historial) {
    const tbody = document.querySelector("#tabla-anomalias tbody");
    if (!tbody) return;
    tbody.replaceChildren();

    if (!historial.length) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");
        celda.colSpan = 6;
        celda.className = "vacio";
        celda.textContent = "Todavía no hay detecciones registradas.";
        fila.appendChild(celda);
        tbody.appendChild(fila);
        return;
    }

    historial.forEach((deteccion) => {
        const fila = document.createElement("tr");
        const valores = [
            deteccion.fecha || "—",
            deteccion.hora || "—",
            deteccion.motor_id || "—",
            deteccion.severidad || "—",
            Number.isFinite(Number(deteccion.error_reconstruccion))
                ? Number(deteccion.error_reconstruccion).toPrecision(5) : "—",
            deteccion.tipo_interpretacion || deteccion.descripcion || "Sin interpretación"
        ];
        valores.forEach((valor, indice) => {
            const celda = document.createElement("td");
            celda.textContent = String(valor);
            if (indice === 3) {
                celda.className = `severidad severidad-${String(valor).toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
            }
            fila.appendChild(celda);
        });
        tbody.appendChild(fila);
    });
}

async function comprobarOllama() {
    const elemento = document.getElementById("estado-ollama");
    if (!elemento) return;
    try {
        const estado = await pedirJson("/api/asistente/estado");
        const disponible = estado.conectado && estado.modelo_disponible;
        elemento.classList.toggle("conectado", Boolean(disponible));
        elemento.classList.toggle("desconectado", !disponible);
        const texto = elemento.querySelector("span:last-child");
        if (texto) {
            texto.textContent = disponible
                ? `IA local lista · ${estado.modelo}`
                : (estado.conectado ? `Ollama activo; falta ${estado.modelo}` : "IA local desconectada");
        }
    } catch (error) {
        elemento.classList.remove("conectado");
        elemento.classList.add("desconectado");
        const texto = elemento.querySelector("span:last-child");
        if (texto) texto.textContent = "No se pudo comprobar Ollama";
    }
}

function agregarMensaje(texto, tipo) {
    const contenedor = document.getElementById("asistente-mensajes");
    if (!contenedor) return null;
    const articulo = document.createElement("article");
    articulo.className = `mensaje mensaje-${tipo}`;
    const autor = document.createElement("span");
    autor.className = "mensaje-autor";
    autor.textContent = tipo === "usuario" ? "TÚ" : "EDGEMANT";
    const parrafo = document.createElement("p");
    parrafo.textContent = texto;
    articulo.append(autor, parrafo);
    contenedor.appendChild(articulo);
    contenedor.scrollTop = contenedor.scrollHeight;
    return parrafo;
}

async function enviarPregunta(evento) {
    evento.preventDefault();
    const input = document.getElementById("asistente-input");
    const boton = document.getElementById("asistente-enviar");
    const estado = document.getElementById("asistente-estado");
    const pregunta = (input?.value || "").trim();
    if (!pregunta) {
        input?.focus();
        return;
    }

    agregarMensaje(pregunta, "usuario");
    input.value = "";
    input.disabled = true;
    if (boton) boton.disabled = true;
    if (estado) estado.textContent = "Generando respuesta desde Ollama…";
    const respuesta = agregarMensaje("", "ia");

    try {
        const resp = await fetch("/api/asistente/stream", {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
            body: JSON.stringify({ pregunta })
        });
        if (!resp.ok || !resp.body) {
            let detalle = {};
            try { detalle = await resp.json(); } catch { /* respuesta no JSON */ }
            throw new Error(detalle.error || `No se pudo iniciar la consulta (HTTP ${resp.status}).`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let recibioTexto = false;
        let termino = false;

        while (!termino) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
            const bloques = buffer.split("\n\n");
            buffer = bloques.pop() || "";

            for (const bloque of bloques) {
                const linea = bloque.split("\n").find((parte) => parte.startsWith("data:"));
                if (!linea) continue;
                const contenido = linea.slice(5).trim();
                if (contenido === "[DONE]") {
                    termino = true;
                    break;
                }
                let evento;
                try { evento = JSON.parse(contenido); }
                catch { throw new Error("El servidor envió un fragmento de respuesta no válido."); }

                if (evento.error) throw new Error(evento.error);
                if (typeof evento.token === "string" && evento.token) {
                    respuesta.textContent += evento.token;
                    recibioTexto = true;
                    const mensajes = document.getElementById("asistente-mensajes");
                    if (mensajes) mensajes.scrollTop = mensajes.scrollHeight;
                }
                if (evento.done) {
                    termino = true;
                    if (estado) estado.textContent = `Respuesta generada por ${evento.modelo || "la IA local"}.`;
                    break;
                }
            }
        }

        if (!recibioTexto) throw new Error("Ollama terminó sin generar texto.");
        if (estado && !estado.textContent.startsWith("Respuesta generada")) {
            estado.textContent = "Respuesta recibida desde la IA local.";
        }
    } catch (error) {
        respuesta?.closest(".mensaje")?.remove();
        agregarMensaje(error.message, "error");
        if (estado) estado.textContent = "No se pudo completar la consulta.";
    } finally {
        input.disabled = false;
        if (boton) boton.disabled = false;
        input.focus();
    }
}

async function ejecutarInferencia() {
    const boton = document.getElementById("btn-inferir");
    const estado = document.getElementById("estado-inferencia");
    if (boton) boton.disabled = true;
    if (estado) estado.textContent = "Ejecutando inferencia; esto puede tardar…";

    try {
        const datos = await pedirJson("/api/inferir", { method: "POST" });
        if (estado) estado.textContent = `Análisis completado. Nuevas detecciones guardadas: ${datos.detecciones_guardadas ?? 0}.`;
        await cargarDashboard();
    } catch (error) {
        if (estado) estado.textContent = `No se pudo completar la inferencia: ${error.message}`;
        console.error("EdgeMant inferencia:", error);
    } finally {
        if (boton) boton.disabled = false;
    }
}
