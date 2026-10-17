/*
 * Puente EdgeMant -> receptor local.
 *
 * Abre el simulador servido en http://127.0.0.1:8080, inicia la simulación,
 * pega este archivo en DevTools > Console y pulsa Enter.
 * No edita archivos del simulador: lee window.__sim.historial.
 */
(() => {
  "use strict";

  const ENDPOINT = "http://127.0.0.1:8765/api/telemetria";
  const INTERVALO_MS = 1500;
  const TAMANO_LOTE = 200;

  if (!window.__sim || !window.__sim.historial ||
      typeof window.__sim.historial.listar !== "function") {
    console.error("[EdgeMant] No encuentro window.__sim. Abre primero el simulador.");
    return;
  }

  if (window.__edgeMantPuente?.timer) clearInterval(window.__edgeMantPuente.timer);

  const enviados = new Set();
  let ocupado = false;
  let detenido = false;
  let totalInsertados = 0;
  let totalDuplicados = 0;

  function clave(r) {
    return `${r.motor_id}|${Number(r.timestamp)}|${Number(r.tiempo).toFixed(6)}`;
  }

  async function enviarPendientes() {
    if (ocupado || detenido) return;
    ocupado = true;
    try {
      const historial = window.__sim.historial.listar();
      const pendientes = [];
      for (const r of historial) {
        const k = clave(r);
        if (!enviados.has(k)) pendientes.push({ key: k, record: r });
      }
      for (let i = 0; i < pendientes.length; i += TAMANO_LOTE) {
        const lote = pendientes.slice(i, i + TAMANO_LOTE);
        const response = await fetch(ENDPOINT, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registros: lote.map((x) => x.record) }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }
        for (const item of lote) enviados.add(item.key);
        totalInsertados += Number(result.insertados || 0);
        totalDuplicados += Number(result.duplicados || 0);
        console.info(
          `[EdgeMant] lote recibido: ${result.insertados} nuevos, ${result.duplicados} duplicados. Total nuevos de esta sesión: ${totalInsertados}.`
        );
      }
      // La BD deduplica también, así que este límite afecta solo la memoria del navegador.
      if (enviados.size > 20000) {
        const recientes = new Set(historial.map(clave));
        for (const k of enviados) if (!recientes.has(k)) enviados.delete(k);
      }
    } catch (error) {
      console.error("[EdgeMant] No se pudo enviar la telemetría; se reintentará:", error);
    } finally {
      ocupado = false;
    }
  }

  const timer = setInterval(enviarPendientes, INTERVALO_MS);
  window.__edgeMantPuente = {
    timer,
    detener() {
      detenido = true;
      clearInterval(timer);
      console.info("[EdgeMant] Puente detenido.");
    },
    sincronizarAhora: enviarPendientes,
    estado() {
      return {
        detenido,
        muestrasVistas: enviados.size,
        totalInsertados,
        totalDuplicados,
        ultimoRegistro: window.__sim.historial.ultimo(),
      };
    },
  };

  console.info("[EdgeMant] Puente activo. Se sincronizarán las muestras disponibles y las nuevas cada 1,5 s.");
  enviarPendientes();
})();