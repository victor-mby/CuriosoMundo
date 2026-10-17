import { acotar, interpolar, mezclar } from '../nucleo/azar.js';

export const TRANSICIONES = {
  PARADO: ['ARRANCANDO', 'FALLA'],
  ARRANCANDO: ['OPERATIVO', 'DETENIÉNDOSE', 'FALLA'],
  OPERATIVO: ['DETENIÉNDOSE', 'FALLA'],
  'DETENIÉNDOSE': ['PARADO', 'FALLA'],
  FALLA: ['PARADO'],
};

export function puedeTransitar(estadoActual, estadoSiguiente) {
  const permitidos = TRANSICIONES[estadoActual] || [];
  return permitidos.includes(estadoSiguiente);
}

export function crearRuntimeMotor(cfg, placa, tiempo) {
  const valvula = {
    id: cfg.valvula.id,
    posicion: cfg.valvula.estadoInicial === 'ABIERTA' ? 1 : 0,
    objetivo: cfg.valvula.estadoInicial === 'ABIERTA' ? 1 : 0,
    estado: cfg.valvula.estadoInicial,
    orden: cfg.valvula.estadoInicial === 'ABIERTA' ? 'ABIERTA' : 'CERRADA',
    tiempoRecorrido: cfg.valvula.tiempoRecorrido,
    carreras: 0,
    ultimaAccion: null,
  };
  return {
    id: cfg.id,
    descripcion: cfg.descripcion,
    placa,
    hp: cfg.hp,
    potenciaNominalKw: placa.potenciaKw,
    estado: ESTADO_INICIAL(cfg.estadoInicial),
    estadoSolicitado: ESTADO_INICIAL(cfg.estadoInicial),
    velocidad: cfg.estadoInicial === 'OPERATIVO' || cfg.estadoInicial === 'ARRANCANDO' ? 1 : 0,
    tiempoEstado: 0,
    tiempoOperacion: cfg.horasIniciales * 3600,
    arranques: 0,
    paradas: 0,
    cargaInicial: cfg.cargaInicial / 100,
    corriente: 0,
    tensionTerminal: cfg.voltaje,
    potencia: 0,
    potenciaUtil: 0,
    factorPotencia: 0,
    carga: 0,
    caudal: 0,
    caudalSuavizado: 0,
    altura: 0,
    retencionCerrada: false,
    factorSuccionActual: 1,
    eficienciaBomba: placa.eficiencia,
    eficienciaMotor: cfg.eficiencia,
    tamanoValvula: cfg.valvula.tamano,
    valvula,
    fallo: null,
    ultimaAccion: null,
    marcaTiempo: tiempo,
    tiempoSobrecarga: 0,
    tiempoBajaTension: 0,
    caudalEsperado: 0,
  };
}

function ESTADO_INICIAL(estado) {
  return estado === 'OPERATIVO' || estado === 'ARRANCANDO' ? estado : 'PARADO';
}

export function actualizarValvula(valvula, dt) {
  const diferencia = valvula.objetivo - valvula.posicion;
  if (Math.abs(diferencia) > 1e-6) {
    const paso = dt / Math.max(0.2, valvula.tiempoRecorrido);
    valvula.posicion = valvula.posicion + Math.sign(diferencia) * Math.min(paso, Math.abs(diferencia));
  }
  if (valvula.posicion > 0.995) valvula.posicion = 1;
  if (valvula.posicion < 0.005) valvula.posicion = 0;

  if (valvula.objetivo >= 1 && valvula.posicion < 0.995) valvula.estado = 'ABRIENDO';
  else if (valvula.objetivo <= 0 && valvula.posicion > 0.005) valvula.estado = 'CERRANDO';
  else if (valvula.posicion >= 0.995) valvula.estado = 'ABIERTA';
  else if (valvula.posicion <= 0.005) valvula.estado = 'CERRADA';
  else valvula.estado = valvula.objetivo >= 0.5 ? 'ABRIENDO' : 'CERRANDO';
  return valvula.estado;
}

export function actualizarVelocidad(motor, dt, dinamica) {
  const anterior = motor.velocidad;
  let objetivo = motor.velocidad;
  if (motor.estado === 'ARRANCANDO') objetivo = 1;
  else if (motor.estado === 'OPERATIVO') objetivo = 1;
  else if (motor.estado === 'DETENIÉNDOSE' || motor.estado === 'PARADO' || motor.estado === 'FALLA') objetivo = 0;

  const tiempo = motor.estado === 'ARRANCANDO' ? dinamica.tiempoArranque : dinamica.tiempoParada;
  const rampa = dt / Math.max(0.2, tiempo);
  if (objetivo > anterior) motor.velocidad = Math.min(objetivo, anterior + rampa);
  else if (objetivo < anterior) motor.velocidad = Math.max(objetivo, anterior - rampa);
  motor.velocidad = acotar(motor.velocidad, 0, 1);
  return motor.velocidad;
}

export function transicionar(motor, estadoNuevo, tiempo, motivo) {
  if (motor.estado === estadoNuevo) return false;
  motor.estado = estadoNuevo;
  motor.tiempoEstado = 0;
  motor.estadoSolicitado = estadoNuevo;
  motor.marcaTiempo = tiempo;
  if (motivo) motor.ultimaAccion = motivo;
  return true;
}

export function actualizarCaudalSuavizado(motor, dt, ventana) {
  const alfa = 1 - Math.exp(-dt / Math.max(0.05, ventana));
  motor.caudalSuavizado = mezclar(motor.caudalSuavizado, motor.caudal, alfa);
  return motor.caudalSuavizado;
}

export function factorProgreso(velocidad) {
  return interpolar(velocidad, 0, 1);
}
