import { placaDeMotor, factorSuccion, resolverPuntoOperacion, alturaEstatica } from './hidraulica.js';
import { tensionBarra, calcularMotor, calidadSenal } from './electrico.js';
import { crearRuntimeMotor, actualizarValvula, actualizarVelocidad, transicionar } from './maquinaEstados.js';
import { perfilDemanda, RHO } from './configuracion.js';
import { acotar, ruidoFraccionario, crearGenerador } from '../nucleo/azar.js';

export function crearEstacion(cfg, eventos) {
  const areaTanque = (Math.PI * cfg.tanque.diametro ** 2) / 4;
  const volumenTanque = areaTanque * cfg.tanque.altura;
  const areaDestino = (Math.PI * cfg.destino.diametro ** 2) / 4;
  const volumenDestino = areaDestino * cfg.destino.altura;
  const azar = crearGenerador(cfg.simulacion.semilla);
  let perturbaciones = [];

  const motores = cfg.motores.map((m) => {
    const placa = placaDeMotor(m);
    const runtime = crearRuntimeMotor(m, placa, 0);
    runtime.potenciaInicial = (placa.potenciaEje * m.cargaInicial) / 100;
    return runtime;
  });

  const estado = {
    tiempo: 0,
    tiempoRealInicio: Date.now(),
    red: { tension: cfg.red.tension, corriente: 0, frecuencia: cfg.red.frecuencia, perturbaciones },
    tanque: {
      id: cfg.tanque.id,
      nivel: cfg.tanque.nivelInicial,
      area: areaTanque,
      altura: cfg.tanque.altura,
      volumen: areaTanque * cfg.tanque.nivelInicial,
      ingreso: 0,
      variacion: 0,
    },
    destino: {
      id: cfg.destino.id,
      nivel: cfg.destino.nivelInicial,
      area: areaDestino,
      altura: cfg.destino.altura,
      volumen: areaDestino * cfg.destino.nivelInicial,
      demanda: cfg.destino.demandaBase,
      presion: 0,
    },
    motores,
    totales: { caudal: 0, potencia: 0, corriente: 0, carga: 0, motoresActivos: 0 },
    comunicacion: { online: true, latido: 0, paquetes: 0, perdidos: 0, calidad: 100, latencia: 0 },
    factorSuccion: 1,
  };

  function fechaSimulacion() {
    return new Date(estado.tiempoRealInicio + estado.tiempo * 1000);
  }

  function porMotor() {
    const mapa = {};
    for (const motor of motores) mapa[motor.id] = motor;
    return mapa;
  }

  function registrar(texto, extra) {
    eventos.agregar({ tiempo: estado.tiempo, tipo: 'OPERACIÓN', equipo: 'ESTACIÓN', texto, ...extra });
  }

  function buscar(id) {
    return motores.find((m) => m.id === id) || null;
  }

  function comando(motor, texto, extra) {
    eventos.agregar({ tiempo: estado.tiempo, tipo: 'OPERACIÓN', equipo: motor.id, texto, ...extra });
  }

  function comandoValvula(motor, texto, extra) {
    eventos.agregar({ tiempo: estado.tiempo, tipo: 'VÁLVULA', equipo: motor.valvula.id, texto, motor: motor.id, ...extra });
  }

  function estartrar(id) {
    const motor = buscar(id);
    if (!motor) return { ok: false, mensaje: `Equipo ${id} no encontrado.` };
    if (motor.estado === 'FALLA') {
      return { ok: false, mensaje: `${id} está en falla. Reinicie el equipo antes de arrancarlo.` };
    }
    if (motor.estado === 'ARRANCANDO' || motor.estado === 'OPERATIVO') {
      return { ok: false, mensaje: `${id} ya está en proceso de arranque o operativo.` };
    }
    if (cfg.controles && cfg.controles.interbloqueoValvula && motor.valvula.posicion < 0.99) {
      return { ok: false, mensaje: `Arranque bloqueado: abra ${motor.valvula.id} (interbloqueo de válvula).` };
    }
    transicionar(motor, 'ARRANCANDO', estado.tiempo, 'ARRANQUE');
    motor.arranques += 1;
    comando(motor, `Orden de arranque de ${id} (${motor.hp} HP) aceptada.`);
    return { ok: true, mensaje: `${id}: secuencia de arranque iniciada.` };
  }

  function parar(id, motivo) {
    const motor = buscar(id);
    if (!motor) return { ok: false, mensaje: `Equipo ${id} no encontrado.` };
    if (motor.estado === 'FALLA') {
      return { ok: false, mensaje: `${id} está en falla y no admite orden de parada.` };
    }
    if (motor.estado === 'PARADO') {
      return { ok: false, mensaje: `${id} ya está detenido.` };
    }
    transicionar(motor, 'DETENIÉNDOSE', estado.tiempo, 'PARADA');
    motor.paradas += 1;
    comando(motor, `Orden de paralización de ${id}${motivo ? ` (${motivo})` : ''}.`);
    return { ok: true, mensaje: `${id}: secuencia de parada iniciada.` };
  }

  function abrirValvula(id) {
    const motor = buscar(id);
    if (!motor) return { ok: false, mensaje: `Equipo ${id} no encontrado.` };
    if (motor.valvula.posicion >= 0.99) return { ok: false, mensaje: `${motor.valvula.id} ya está abierta.` };
    motor.valvula.objetivo = 1;
    motor.valvula.orden = 'ABRIR';
    motor.valvula.carreras += 1;
    comandoValvula(motor, `${motor.valvula.id}: orden de apertura, recorrido iniciado.`);
    return { ok: true, mensaje: `${motor.valvula.id}: abriendo.` };
  }

  function cerrarValvula(id) {
    const motor = buscar(id);
    if (!motor) return { ok: false, mensaje: `Equipo ${id} no encontrado.` };
    if (motor.valvula.posicion <= 0.01) return { ok: false, mensaje: `${motor.valvula.id} ya está cerrada.` };
    motor.valvula.objetivo = 0;
    motor.valvula.orden = 'CERRAR';
    motor.valvula.carreras += 1;
    comandoValvula(motor, `${motor.valvula.id}: orden de cierre, recorrido iniciado.`);
    return { ok: true, mensaje: `${motor.valvula.id}: cerrando.` };
  }

  function fallar(id, codigo, texto) {
    const motor = buscar(id);
    if (!motor) return { ok: false, mensaje: `Equipo ${id} no encontrado.` };
    if (motor.estado === 'FALLA') return { ok: false, mensaje: `${id} ya se encuentra en falla.` };
    motor.fallo = { codigo, texto, hora: fechaSimulacion() };
    transicionar(motor, 'FALLA', estado.tiempo, codigo);
    if (cfg.controles && cfg.controles.cierreAutomaticoFalla && motor.valvula.posicion > 0.005) {
      motor.valvula.objetivo = 0;
      motor.valvula.orden = 'CERRAR';
      comandoValvula(motor, `${motor.valvula.id}: cierre automático por falla de ${motor.id}.`);
    }
    comando(motor, `Falla en ${id}: ${texto}. Protección actuada, equipo bloqueado.`, { severidad: 'CRITICA' });
    return { ok: true, mensaje: `${id}: falla registrada (${codigo}).` };
  }

  function reiniciarFalla(id) {
    const motor = buscar(id);
    if (!motor) return { ok: false, mensaje: `Equipo ${id} no encontrado.` };
    if (motor.estado !== 'FALLA') return { ok: false, mensaje: `${id} no está en falla.` };
    motor.fallo = null;
    motor.velocidad = 0;
    transicionar(motor, 'PARADO', estado.tiempo, 'RESET');
    comando(motor, `Reinicio de falla de ${id} ejecutado. Equipo disponible para arranque.`);
    return { ok: true, mensaje: `${id}: falla reiniciada.` };
  }

  function desactivarComunicacion(activa) {
    const anterior = estado.comunicacion.online;
    estado.comunicacion.online = !activa;
    if (anterior === estado.comunicacion.online) return { ok: true };
    eventos.agregar({
      tiempo: estado.tiempo,
      tipo: 'COMUNICACIÓN',
      equipo: 'RTU-01',
      severidad: activa ? 'CRITICA' : 'INFO',
      texto: activa
        ? 'Pérdida de comunicación con el RTU: la telemetría deja de actualizarse.'
        : 'Comunicación con el RTU restablecida. Recepción de datos normal.',
    });
    return { ok: true };
  }

  function perturbacion(delta, duracion, etiqueta, retraso) {
    perturbaciones.push({
      delta,
      duracion,
      inicio: estado.tiempo + (retraso || 0),
      etiqueta: etiqueta || 'inyección de red',
    });
    eventos.agregar({
      tiempo: estado.tiempo,
      tipo: 'SISTEMA',
      equipo: 'AL-01',
      texto: `Evento de red: ${etiqueta || 'inyección'} (${delta > 0 ? '+' : ''}${delta} V durante ${duracion} s).`,
    });
  }

  function avanzar(dt) {
    estado.tiempo += dt;
    const cfgLocal = cfg;
    const dinamica = cfgLocal.dinamica;

    if (!estado.comunicacion.online) {
      estado.comunicacion.latido += dt;
      estado.comunicacion.perdidos += Math.round(dt * 10);
      estado.comunicacion.calidad = calidadSenal(estado.comunicacion.perdidos, estado.comunicacion.paquetes);
      return;
    }

    estado.comunicacion.latido = 0;
    estado.comunicacion.paquetes += Math.max(1, Math.round(dt * 10));
    if (azar() < 0.004) estado.comunicacion.perdidos += 1;
    estado.comunicacion.latencia = 8 + azar() * 24;
    estado.comunicacion.calidad = calidadSenal(estado.comunicacion.perdidos, estado.comunicacion.paquetes);

    perturbaciones = perturbaciones.filter((p) => estado.tiempo <= p.inicio + p.duracion);
    estado.red.perturbaciones = perturbaciones;

    const succion = factorSuccion(estado.tanque.nivel, dinamica);
    estado.factorSuccion = succion;

    for (const motor of motores) {
      motor.factorSuccionActual = succion;
      actualizarVelocidad(motor, dt, dinamica);
      actualizarValvula(motor.valvula, dt);
      motor.tiempoEstado += dt;
      evaluarTransiciones(motor, dt);
    }

    const demandaRelativa = acotar(estado.destino.demanda / Math.max(1, cfgLocal.destino.demandaBase), 0, 3);
    const punto = resolverPuntoOperacion(motores, {
      alturaEstatica: alturaEstatica(estado.tanque.nivel, cfgLocal.impulsion.cotaDestino),
      coeficienteBase: cfgLocal.impulsion.coeficienteSistema,
      succion,
      demandaRelativa,
    });

    aplicarElectrico(motores, 2);

    let caudalTotal = 0;
    let potenciaTotal = 0;
    let corrienteTotal = 0;
    let activos = 0;
    for (const motor of motores) {
      caudalTotal += motor.caudal;
      potenciaTotal += motor.potencia;
      corrienteTotal += motor.corriente;
      if (motor.estado === 'OPERATIVO' || motor.estado === 'ARRANCANDO') activos += 1;
      motor.caudalEsperado = (motor.placa.caudalDiseno / 1000) * motor.velocidad;
      const alfa = 1 - Math.exp(-dt / dinamica.ventanaCaudal);
      motor.caudalSuavizado += (motor.caudal - motor.caudalSuavizado) * alfa;
    }

    estado.totales.caudal = caudalTotal;
    estado.totales.potencia = potenciaTotal;
    estado.totales.corriente = corrienteTotal;
    estado.totales.carga = potenciaTotal / Math.max(1, motores.reduce((s, m) => s + m.placa.potenciaEje, 0));
    estado.totales.motoresActivos = activos;
    estado.red.corriente = corrienteTotal;
    estado.puntoOperacion = punto;

    const variacion = ruidoFraccionario(estado.tiempo / 180, 311, 3) * 0.08;
    estado.tanque.ingreso = cfgLocal.impulsion.ingresoAguaCruda * (1 + variacion);
    estado.tanque.variacion = variacion;
    estado.tanque.nivel = acotar(
      estado.tanque.nivel + ((estado.tanque.ingreso - caudalTotal * 1000) / 1000 / areaTanque) * dt,
      0,
      cfgLocal.tanque.altura,
    );
    estado.tanque.volumen = areaTanque * estado.tanque.nivel;

    const horaSim = fechaSimulacion();
    const perfil = perfilDemanda(horaSim.getHours() + horaSim.getMinutes() / 60);
    const ruidoDemanda = ruidoFraccionario(estado.tiempo / 90, 77, 2) * 0.12;
    estado.destino.demanda = acotar(
      cfgLocal.destino.demandaBase * perfil * (1 + ruidoDemanda),
      cfgLocal.destino.demandaMin,
      cfgLocal.destino.demandaMax,
    );
    estado.destino.nivel = acotar(
      estado.destino.nivel + ((caudalTotal * 1000 - estado.destino.demanda) / 1000 / areaDestino) * dt,
      0,
      cfgLocal.destino.altura,
    );
    estado.destino.volumen = areaDestino * estado.destino.nivel;
    estado.destino.presion = (estado.destino.nivel * RHO) / 100000;
  }

  function evaluarTransiciones(motor, dt) {
    if (motor.estado === 'ARRANCANDO' && motor.velocidad >= 0.995) {
      transicionar(motor, 'OPERATIVO', estado.tiempo, 'OPERATIVO');
      comando(motor, `${motor.id} en OPERATIVO (velocidad 100 %, ${motor.corriente.toFixed(1)} A).`);
    }
    if (motor.estado === 'DETENIÉNDOSE' && motor.velocidad <= 0.005) {
      motor.velocidad = 0;
      transicionar(motor, 'PARADO', estado.tiempo, 'PARADO');
      comando(motor, `${motor.id} detenido. Corriente ${motor.corriente.toFixed(2)} A.`);
    }
    if (motor.velocidad > 0.02) motor.tiempoOperacion += dt;
    if (motor.estado === 'ARRANCANDO' || motor.estado === 'OPERATIVO') {
      if (estado.tanque.nivel < cfg.alarmas.nivelCritico) {
        fallar(motor.id, 'NIVEL BAJO', 'parada por protección de nivel mínimo (sección en vacío)');
        return;
      }
      motor.tiempoSobrecarga = motor.carga > cfg.alarmas.sobrecargaTrip ? motor.tiempoSobrecarga + dt : 0;
      if (motor.tiempoSobrecarga > cfg.alarmas.retardoTrip) {
        fallar(motor.id, 'SOBRECARGA', 'disparo por sobrecorriente sustained en el motor');
        return;
      }
      if (estado.red.tension < cfg.alarmas.tensionMinima - 4) {
        motor.tiempoBajaTension = (motor.tiempoBajaTension || 0) + dt;
        if (motor.tiempoBajaTension > cfg.alarmas.retardoTrip) {
          fallar(motor.id, 'BAJA TENSIÓN', 'disparo por tensión de barras fuera de rango');
        }
      } else {
        motor.tiempoBajaTension = 0;
      }
    }
  }

  function aplicarElectrico(lista, pasadas) {
    for (let pasada = 0; pasada < pasadas; pasada += 1) {
      const tension = tensionBarra(cfg.red, estado.tiempo, estado.red.corriente, perturbaciones);
      estado.red.tension = tension;
      let corriente = 0;
      for (const motor of lista) {
        const resultado = calcularMotor(motor, {
          tensionBarra: tension,
          cfg,
          ruido: azar(),
        });
        motor.corriente = resultado.corriente;
        motor.tensionTerminal = resultado.tensionTerminal;
        motor.potencia = resultado.potencia;
        motor.potenciaUtil = resultado.potenciaUtil;
        motor.factorPotencia = resultado.factorPotencia;
        motor.carga = resultado.carga;
        corriente += resultado.corriente;
      }
      estado.red.corriente = corriente;
    }
  }

  function reconfigurar(nuevaCfg) {
    const previos = new Map(motores.map((m) => [m.id, m]));
    cfg = nuevaCfg;
    const area = (Math.PI * cfg.tanque.diametro ** 2) / 4;
    const areaD = (Math.PI * cfg.destino.diametro ** 2) / 4;
    estado.tanque.area = area;
    estado.tanque.altura = cfg.tanque.altura;
    estado.tanque.nivel = acotar(estado.tanque.nivel, 0, cfg.tanque.altura);
    estado.tanque.volumen = area * estado.tanque.nivel;
    estado.destino.area = areaD;
    estado.destino.altura = cfg.destino.altura;
    estado.destino.nivel = acotar(estado.destino.nivel, 0, cfg.destino.altura);
    estado.destino.volumen = areaD * estado.destino.nivel;
    perturbaciones = [];
    const nuevos = cfg.motores.map((definicion) => {
      const placa = placaDeMotor(definicion);
      const existente = previos.get(definicion.id);
      if (existente) {
        const plataforma = {
          ...existente,
          descripcion: definicion.descripcion,
          placa,
          hp: definicion.hp,
          potenciaNominalKw: placa.potenciaKw,
          eficienciaBomba: placa.eficiencia,
          eficienciaMotor: definicion.eficiencia,
          tamanoValvula: definicion.valvula.tamano,
        };
        plataforma.valvula.tiempoRecorrido = definicion.valvula.tiempoRecorrido;
        return plataforma;
      }
      return crearRuntimeMotor(definicion, placa, estado.tiempo);
    });
    motores.length = 0;
    for (const motor of nuevos) motores.push(motor);
    estado.motores = motores;
    eventos.agregar({
      tiempo: estado.tiempo,
      tipo: 'CONFIG',
      equipo: 'ESTACIÓN',
      texto: `Configuración aplicada: ${motores.length} equipo(s) en servicio.`,
    });
  }

  function fijarNivel(valor) {
    estado.tanque.nivel = acotar(valor, 0, cfg.tanque.altura);
    estado.tanque.volumen = areaTanque * estado.tanque.nivel;
  }

  function fijarNivelDestino(valor) {
    estado.destino.nivel = acotar(valor, 0, cfg.destino.altura);
    estado.destino.volumen = areaDestino * estado.destino.nivel;
  }

  registrar('Estación inicializada. Tanque en ' + estado.tanque.nivel.toFixed(2) + ' m.');

  return {
    estado,
    fechaSimulacion,
    porMotor,
    estartrar,
    parar,
    abrirValvula,
    cerrarValvula,
    fallar,
    reiniciarFalla,
    desactivarComunicacion,
    perturbacion,
    avanzar,
    reconfigurar,
    fijarNivel,
    fijarNivelDestino,
    areas: { tanque: areaTanque, destino: areaDestino },
  };
}
