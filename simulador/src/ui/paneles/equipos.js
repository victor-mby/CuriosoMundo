import { crear, vaciar } from '../dom.js';
import { numero, porcentaje, duracionHoras, claseEstado } from '../../nucleo/formato.js';

function fila(etiqueta, valorInicial, clase) {
  const valor = crear('span', { class: `dato__valor ${clase || ''}`, texto: valorInicial });
  return {
    nodo: crear('div', { class: 'dato' }, [
      crear('span', { class: 'dato__etiqueta', texto: etiqueta }),
      valor,
    ]),
    valor,
  };
}

function boton(texto, clase, accion, title) {
  return crear('button', {
    class: `boton ${clase || ''}`,
    type: 'button',
    title: title || texto,
    on: { click: accion },
  }, [crear('span', { texto })]);
}

export function crearPanelEquipos(contenedor, sim, avisar) {
  const cuerpo = crear('div', { class: 'panel__cuerpo panel__cuerpo--scroll' });
  vaciar(contenedor).appendChild(cuerpo);
  let tarjetas = new Map();
  let idsActuales = '';

  function asegurarTarjetas(motores) {
    const ids = motores.map((m) => m.id).join('|');
    if (ids === idsActuales) return;
    idsActuales = ids;
    tarjetas = new Map();
    vaciar(cuerpo);
    for (const motor of motores) {
      tarjetas.set(motor.id, crearTarjeta(motor));
      cuerpo.appendChild(tarjetas.get(motor.id).nodo);
    }
  }

  function crearTarjeta(motor) {
    const led = crear('span', { class: 'led led--grande' });
    const estado = crear('span', { class: 'equipo__estado', texto: motor.estado });
    const subtitulo = crear('span', { class: 'equipo__subtitulo', texto: motor.descripcion });
    const vel = fila('Velocidad', '0 %');
    const voltaje = fila('Voltaje', '0.0 V');
    const amperaje = fila('Amperaje', '0.0 A');
    const corrienteNominal = fila('Corriente nominal', '0.0 A');
    const caudal = fila('Caudal', '0.0 L/s');
    const altura = fila('Altura', '0.0 m');
    const potencia = fila('Potencia', '0.00 kW');
    const potenciaNominal = fila('Potencia nominal', '0.0 kW');
    const carga = fila('Carga', '0 %');
    const factorPotencia = fila('Factor potencia', '0.00');
    const horas = fila('Horas de operación', '0.00 h');
    const arranques = fila('Arranques', '0');
    const valvula = fila('Válvula', '—');
    const posicion = fila('Posición válvula', '0 %');

    const barra = crear('div', { class: 'rampa' }, [crear('div', { class: 'rampa__relleno' }), crear('div', { class: 'rampa__carga' })]);
    const relleno = barra.children[0];
    const cargaBarra = barra.children[1];

    const btnArranque = boton('ARRANQUE', 'boton--arrancar', () => avisar(sim.estartrar(motor.id)));
    const btnParada = boton('PARALIZACIÓN', 'boton--parar', () => avisar(sim.parar(motor.id)));
    const btnAbrir = boton('ABRIR VÁLVULA', 'boton--abrir', () => avisar(sim.abrirValvula(motor.id)));
    const btnCerrar = boton('CERRAR VÁLVULA', 'boton--cerrar', () => avisar(sim.cerrarValvula(motor.id)));
    const btnReset = boton('REINICIAR FALLA', 'boton--fantasma', () => avisar(sim.reiniciarFalla(motor.id)));
    const btnFalla = boton('INYECTAR FALLA', 'boton--peligro boton--compacto', () =>
      avisar(sim.fallar(motor.id, 'FALLA INYECTADA', 'disparo manual del operador desde el HMI')),
    );

    const alerta = crear('div', { class: 'equipo__falla', estilo: { display: 'none' } });

    const nodo = crear('article', { class: 'equipo', 'data-motor': motor.id }, [
      crear('header', { class: 'equipo__cabecera' }, [
        crear('div', { class: 'equipo__identidad' }, [
          crear('span', { class: 'equipo__id', texto: motor.id }),
          subtitulo,
        ]),
        crear('div', { class: 'equipo__estadoBloque' }, [estado, led]),
      ]),
      alerta,
      crear('div', { class: 'rampa-wrap' }, [barra]),
      crear('div', { class: 'datos' }, [
        vel.valor.nodo,
        voltaje.valor.nodo,
        amperaje.valor.nodo,
        caudal.valor.nodo,
        altura.valor.nodo,
        potencia.valor.nodo,
        carga.valor.nodo,
        factorPotencia.valor.nodo,
        valvula.valor.nodo,
        posicion.valor.nodo,
        corrienteNominal.valor.nodo,
        potenciaNominal.valor.nodo,
        horas.valor.nodo,
        arranques.valor.nodo,
      ]),
      crear('div', { class: 'controles' }, [
        crear('div', { class: 'controles__fila' }, [btnArranque, btnParada]),
        crear('div', { class: 'controles__fila' }, [btnAbrir, btnCerrar]),
        crear('div', { class: 'controles__fila controles__fila--secundaria' }, [btnReset, btnFalla]),
      ]),
    ]);

    return {
      nodo,
      led,
      estado,
      vel,
      voltaje,
      amperaje,
      corrienteNominal,
      caudal,
      altura,
      potencia,
      potenciaNominal,
      carga,
      factorPotencia,
      horas,
      arranques,
      valvula,
      posicion,
      relleno,
      cargaBarra,
      btnArranque,
      btnParada,
      btnAbrir,
      btnCerrar,
      btnReset,
      btnFalla,
      alerta,
    };
  }

  function actualizar() {
    const estado = sim.estado();
    asegurarTarjetas(estado.motores);
    for (const motor of estado.motores) {
      const t = tarjetas.get(motor.id);
      if (!t) continue;
      const clase = claseEstado(motor.estado);
      t.nodo.className = `equipo ${clase} ${motor.estado === 'FALLA' ? 'equipo--falla' : ''}`;
      t.led.style.background = colorEstadoHex(motor.estado);
      t.estado.textContent = motor.estado;
      t.estado.className = `equipo__estado equipo__estado--${colorClase(motor.estado)}`;
      t.vel.valor.textContent = `${numero(motor.velocidad * 100, 0)} %`;
      t.voltaje.valor.textContent = `${numero(motor.tensionTerminal, 1)} V`;
      t.amperaje.valor.textContent = `${numero(motor.corriente, 1)} A`;
      t.amperaje.valor.classList.toggle('dato__valor--alerta', motor.corriente > motor.placa.corrienteNominal * 1.18);
      t.corrienteNominal.valor.textContent = `${numero(motor.placa.corrienteNominal, 1)} A`;
      t.caudal.valor.textContent = `${numero(motor.caudal * 1000, 1)} L/s`;
      t.altura.valor.textContent = `${numero(motor.altura, 1)} m`;
      t.potencia.valor.textContent = `${numero(motor.potencia, 2)} kW`;
      t.potenciaNominal.valor.textContent = `${numero(motor.placa.potenciaKw, 2)} kW`;
      t.carga.valor.textContent = porcentaje(motor.carga, 0);
      t.carga.valor.classList.toggle('dato__valor--alerta', motor.carga > 1.12);
      t.factorPotencia.valor.textContent = motor.factorPotencia ? numero(motor.factorPotencia, 2) : '—';
      t.horas.valor.textContent = `${duracionHoras(motor.tiempoOperacion)} h`;
      t.arranques.valor.textContent = `${motor.arranques}`;
      t.valvula.valor.textContent = `${motor.valvula.id} · ${motor.valvula.estado}`;
      t.posicion.valor.textContent = `${numero(motor.valvula.posicion * 100, 0)} %`;

      t.relleno.style.width = `${numero(motor.velocidad * 100, 1)}%`;
      t.cargaBarra.style.width = `${numero(Math.min(1, motor.carga) * 100, 1)}%`;
      t.cargaBarra.style.background = motor.carga > 1.12 ? '#e64a4a' : '#35d07f';

      const enMarcha = motor.estado === 'ARRANCANDO' || motor.estado === 'OPERATIVO' || motor.estado === 'DETENIÉNDOSE';
      t.btnArranque.disabled = motor.estado !== 'PARADO';
      t.btnParada.disabled = !enMarcha;
      t.btnAbrir.disabled = motor.valvula.posicion > 0.99;
      t.btnCerrar.disabled = motor.valvula.posicion < 0.01;
      t.btnReset.disabled = motor.estado !== 'FALLA';
      t.btnFalla.disabled = motor.estado === 'FALLA';

      if (motor.fallo) {
        t.alerta.style.display = '';
        t.alerta.textContent = `FALLA · ${motor.fallo.codigo} — ${motor.fallo.texto}`;
      } else {
        t.alerta.style.display = 'none';
      }
    }
  }

  return { actualizar };
}

function colorClase(estado) {
  if (estado === 'OPERATIVO') return 'operativo';
  if (estado === 'ARRANCANDO') return 'arrancando';
  if (estado === 'DETENIÉNDOSE') return 'deteniendo';
  if (estado === 'FALLA') return 'falla';
  return 'apagado';
}

function colorEstadoHex(estado) {
  if (estado === 'OPERATIVO') return '#35d07f';
  if (estado === 'ARRANCANDO') return '#f5c451';
  if (estado === 'DETENIÉNDOSE') return '#f0934f';
  if (estado === 'FALLA') return '#e64a4a';
  return '#4a5a6a';
}

export function crearPanelControles(contenedor, sim, avisar) {
  const nodo = crear('div', { class: 'controles-panel' });
  const cuerpo = crear('div', { class: 'controles-panel__cuerpo' });
  nodo.appendChild(cuerpo);
  vaciar(contenedor).appendChild(nodo);

  const estadoSim = crear('span', { class: 'pill pill--activo', texto: 'EN PAUSA' });
  const relojSim = crear('span', { class: 'reloj mono', texto: '00:00:00' });
  const factor = crear('select', { class: 'selector' },
    [0.5, 1, 2, 5, 6, 10, 20, 60].map((v) => crear('option', { value: String(v), texto: `x${v}` })));
  factor.value = String(sim.reloj.velocidad);
  factor.addEventListener('change', () => {
    const valor = sim.establecerVelocidad(Number(factor.value));
    factor.value = String(valor);
  });

  const btnComunicacion = crear('button', { class: 'boton boton--fantasma', type: 'button' }, [
    crear('span', { texto: 'SIMULAR PÉRDIDA DE COMUNICACIÓN' }),
  ]);
  btnComunicacion.addEventListener('click', () => avisar(sim.conmutarComunicacion()));

  const btnFalla = crear('button', { class: 'boton boton--fantasma', type: 'button' }, [
    crear('span', { texto: 'INYECTAR FALLA DE RED' }),
  ]);
  btnFalla.addEventListener('click', () => avisar(sim.perturbacion('caida')));

  const btnSobretension = crear('button', { class: 'boton boton--fantasma', type: 'button' }, [
    crear('span', { texto: 'SOBRETENSIÓN' }),
  ]);
  btnSobretension.addEventListener('click', () => avisar(sim.perturbacion('sobre')));

  const btnNivel = crear('button', { class: 'boton boton--fantasma', type: 'button' }, [
    crear('span', { texto: 'LLENAR / VACIAR TANQUE' }),
  ]);
  let alternaNivel = false;
  btnNivel.addEventListener('click', () => {
    alternaNivel = !alternaNivel;
    avisar(sim.fijarNivel(alternaNivel ? sim.estado().tanque.altura * 0.97 : sim.estado().tanque.altura * 0.06));
  });

  cuerpo.appendChild(
    crear('div', { class: 'controles-estacion' }, [
      crear('div', { class: 'controles-estacion__fila' }, [
        crear('span', { class: 'etiqueta-campo', texto: 'Estado de simulación' }),
        estadoSim,
      ]),
      crear('div', { class: 'controles-estacion__fila' }, [
        crear('span', { class: 'etiqueta-campo', texto: 'Reloj de simulación' }),
        relojSim,
      ]),
      crear('div', { class: 'controles-estacion__fila' }, [
        crear('span', { class: 'etiqueta-campo', texto: 'Tiempo de simulación' }),
        factor,
      ]),
      crear('div', { class: 'controles-estacion__acciones' }, [btnComunicacion, btnFalla, btnSobretension, btnNivel]),
    ]),
  );

  return {
    actualizar() {
      const estado = sim.estado();
      estadoSim.textContent = sim.reloj.corriendo ? 'EN CURSO' : 'EN PAUSA';
      estadoSim.className = `pill ${sim.reloj.corriendo ? 'pill--activo' : 'pill--pausa'}`;
      relojSim.textContent = duracion(estado.tiempo);
      if (document.activeElement !== factor) factor.value = String(sim.reloj.velocidad);
      const online = estado.comunicacion.online;
      btnComunicacion.querySelector('span').textContent = online
        ? 'SIMULAR PÉRDIDA DE COMUNICACIÓN'
        : 'RESTABLECER COMUNICACIÓN';
      btnComunicacion.classList.toggle('boton--activo', !online);
    },
    nodo,
  };
}

function duracion(segundos) {
  const total = Math.max(0, Math.floor(segundos));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}