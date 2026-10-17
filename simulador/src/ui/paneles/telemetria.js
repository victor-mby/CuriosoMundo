import { crear, vaciar } from '../dom.js';
import { numero, porcentaje, horaSegundos, entero } from '../../nucleo/formato.js';

function baldosa(etiqueta, unidad, inicial) {
  const valor = crear('span', { class: 'tile__valor mono', texto: inicial });
  const barra = crear('div', { class: 'tile__barra' }, [crear('div', { class: 'tile__relleno' })]);
  return {
    nodo: crear('div', { class: 'tile' }, [
      crear('div', { class: 'tile__cabecera' }, [
        crear('span', { class: 'tile__etiqueta', texto: etiqueta }),
        crear('span', { class: 'tile__unidad', texto: unidad }),
      ]),
      valor,
      barra,
    ]),
    valor,
    relleno: barra.children[0],
  };
}

function lectura(etiqueta, clase) {
  const valor = crear('span', { class: `lectura__valor mono ${clase || ''}`, texto: '—' });
  return {
    nodo: crear('div', { class: 'lectura' }, [crear('span', { class: 'lectura__etiqueta', texto: etiqueta }), valor]),
    valor,
  };
}

export function crearPanelTelemetria(contenedor, sim) {
  const cuerpo = crear('div', { class: 'panel__cuerpo panel__cuerpo--scroll' });
  vaciar(contenedor).appendChild(cuerpo);

  const nivel = baldosa('NIVEL RESERVORIO', 'm', '0.00');
  const caudal = baldosa('CAUDAL TOTAL', 'L/s', '0.0');
  const potencia = baldosa('POTENCIA TOTAL', 'kW', '0.00');
  const voltaje = baldosa('TENSIÓN BARRAS', 'V', '0.0');

  const lecturas = {
    nivelPorcentaje: lectura('Nivel en %'),
    volumen: lectura('Volumen estimado'),
    alturaMin: lectura('Altura útil'),
    tension: lectura('Tensión de barras'),
    frecuencia: lectura('Frecuencia'),
    corrienteTotal: lectura('Corriente total'),
    potenciaUtil: lectura('Potencia útil'),
    alturaTotal: lectura('Altura total de impulsión'),
    coeficiente: lectura('Coeficiente de sistema'),
    puntoOperacion: lectura('Factor de succión'),
    destinoNivel: lectura('Nivel destino'),
    destinoPresion: lectura('Presión de red'),
    demanda: lectura('Demanda de red'),
    ingreso: lectura('Ingreso agua cruda'),
    calidad: lectura('Calidad de señal'),
    latencia: lectura('Latencia RTU'),
    paquetes: lectura('Paquetes recibidos'),
    actualizacion: lectura('Última actualización'),
    paso: lectura('Tiempo de simulación'),
  };

  const motoresContenedor = crear('div', { class: 'telemetria__motores' });
  const comunicacion = crear('div', { class: 'telemetria__estado' }, [
    crear('span', { class: 'led led--grande' }),
    crear('span', { class: 'telemetria__estadoTexto', texto: 'ONLINE' }),
  ]);
  const ledComunicacion = comunicacion.querySelector('.led');
  const textoComunicacion = comunicacion.querySelector('.telemetria__estadoTexto');

  cuerpo.appendChild(
    crear('div', { class: 'tiles' }, [nivel.nodo, caudal.nodo, potencia.nodo, voltaje.nodo]),
  );
  cuerpo.appendChild(crear('div', { class: 'seccion-titulo', texto: 'VARIABLES DE ESTACIÓN' }));
  cuerpo.appendChild(
    crear('div', { class: 'lecturas' }, Object.values(lecturas).map((l) => l.nodo)),
  );
  cuerpo.appendChild(crear('div', { class: 'seccion-titulo', texto: 'DESGLOSE POR EQUIPO' }));
  cuerpo.appendChild(motoresContenedor);
  cuerpo.appendChild(comunicacion);

  let filasMotores = new Map();
  let ids = '';

  function asegurarMotores(motores) {
    const nuevo = motores.map((m) => m.id).join('|');
    if (nuevo === ids) return;
    ids = nuevo;
    filasMotores = new Map();
    vaciar(motoresContenedor);
    for (const motor of motores) {
      const led = crear('span', { class: 'led' });
      const caudalF = lectura('Caudal');
      const amperajeF = lectura('Amperaje');
      const potenciaF = lectura('Potencia');
      const estadoF = lectura('Estado');
      motorsFila(motoresContenedor, motor, led, caudalF, amperajeF, potenciaF, estadoF);
      filasMotores.set(motor.id, { led, caudal: caudalF, amperaje: amperajeF, potencia: potenciaF, estado: estadoF });
    }
  }

  function motorsFila(padre, motor, led, caudalF, amperajeF, potenciaF, estadoF) {
    padre.appendChild(
      crear('div', { class: 'telegrafia-fila' }, [
        crear('div', { class: 'telegrafia-fila__id' }, [led, crear('span', { texto: motor.id })]),
        crear('div', { class: 'lecturas lecturas--compacto' }, [
          estadoF.nodo,
          caudalF.nodo,
          amperajeF.nodo,
          potenciaF.nodo,
        ]),
      ]),
    );
  }

  function actualizar() {
    const estado = sim.estado();
    const cfg = sim.config();
    const rel = Math.max(0, Math.min(1, estado.tanque.nivel / estado.tanque.altura));
    nivel.valor.textContent = numero(estado.tanque.nivel, 2);
    nivel.relleno.style.width = `${numero(rel * 100, 1)}%`;
    caudal.valor.textContent = numero(estado.totales.caudal * 1000, 1);
    caudal.relleno.style.width = `${numero(Math.min(1, (estado.totales.caudal * 1000) / 120) * 100, 1)}%`;
    potencia.valor.textContent = numero(estado.totales.potencia, 2);
    potencia.relleno.style.width = `${numero(Math.min(1, estado.totales.potencia / 60) * 100, 1)}%`;
    voltaje.valor.textContent = numero(estado.red.tension, 1);
    voltaje.relleno.style.width = `${numero(((estado.red.tension - 200) / 40) * 100, 1)}%`;
    voltaje.valor.classList.toggle('tile__valor--alerta', estado.red.tension < cfg.alarmas.tensionMinima || estado.red.tension > cfg.alarmas.tensionMaxima);

    lecturas.nivelPorcentaje.valor.textContent = porcentaje(rel, 1);
    lecturas.volumen.valor.textContent = `${entero(estado.tanque.volumen)} L`;
    lecturas.alturaMin.valor.textContent = `${numero(cfg.tanque.altura, 1)} m`;
    lecturas.tension.valor.textContent = `${numero(estado.red.tension, 1)} V`;
    lecturas.frecuencia.valor.textContent = `${numero(cfg.red.frecuencia, 1)} Hz`;
    lecturas.corrienteTotal.valor.textContent = `${numero(estado.red.corriente, 1)} A`;
    lecturas.potenciaUtil.valor.textContent = `${numero(estado.puntoOperacion ? estado.puntoOperacion.potenciaUtil / 1000 : 0, 2)} kW`;
    lecturas.alturaTotal.valor.textContent = estado.totales.caudal > 0.0001 ? `${numero(estado.motores[0].altura, 1)} m` : '—';
    lecturas.coeficiente.valor.textContent = estado.puntoOperacion ? `${entero(estado.puntoOperacion.coeficiente)} (L/s)²/m` : '—';
    lecturas.puntoOperacion.valor.textContent = porcentaje(estado.factorSuccion, 0);
    lecturas.puntoOperacion.valor.classList.toggle('lectura__valor--alerta', estado.factorSuccion < 0.8);
    lecturas.destinoNivel.valor.textContent = `${numero(estado.destino.nivel, 2)} m`;
    lecturas.destinoPresion.valor.textContent = `${numero(estado.destino.presion, 2)} bar`;
    lecturas.demanda.valor.textContent = `${numero(estado.destino.demanda, 1)} L/s`;
    lecturas.ingreso.valor.textContent = `${numero(estado.tanque.ingreso, 1)} L/s`;
    lecturas.calidad.valor.textContent = `${numero(estado.comunicacion.calidad, 1)} %`;
    lecturas.latencia.valor.textContent = `${numero(estado.comunicacion.latencia, 0)} ms`;
    lecturas.paquetes.valor.textContent = entero(estado.comunicacion.paquetes);
    lecturas.actualizacion.valor.textContent = horaSegundos(new Date(sim.ahora()));
    lecturas.paso.valor.textContent = `${numero(estado.tiempo, 1)} s (x${sim.reloj.velocidad})`;

    asegurarMotores(estado.motores);
    for (const motor of estado.motores) {
      const fila = filasMotores.get(motor.id);
      if (!fila) continue;
      fila.led.style.background = ledColorHex(motor.estado);
      fila.caudal.valor.textContent = `${numero(motor.caudal * 1000, 1)} L/s`;
      fila.amperaje.valor.textContent = `${numero(motor.corriente, 1)} A`;
      fila.potencia.valor.textContent = `${numero(motor.potencia, 2)} kW`;
      fila.estado.valor.textContent = motor.estado;
    }

    const online = estado.comunicacion.online;
    ledComunicacion.style.background = online ? '#35d07f' : '#e64a4a';
    textoComunicacion.textContent = online ? 'COMUNICACIÓN ONLINE' : 'COMUNICACIÓN PERDIDA';
    comunicacion.classList.toggle('telemetria__estado--offline', !online);
  }

  return { actualizar };
}

function ledColorHex(estado) {
  if (estado === 'OPERATIVO') return '#35d07f';
  if (estado === 'ARRANCANDO') return '#f5c451';
  if (estado === 'DETENIÉNDOSE') return '#f0934f';
  if (estado === 'FALLA') return '#e64a4a';
  return '#4a5a6a';
}