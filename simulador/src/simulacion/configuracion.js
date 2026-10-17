export const RHO = 9810;
export const G = 9.81;
export const HP_W = 745.7;

export const ESTADOS_MOTOR = ['PARADO', 'ARRANCANDO', 'OPERATIVO', 'DETENIÉNDOSE', 'FALLA'];
export const ESTADOS_VALVULA = ['ABIERTA', 'ABRIENDO', 'CERRADA', 'CERRANDO'];

export const CONFIG_POR_DEFECTO = {
  estacion: {
    id: 'EB-01',
    nombre: 'ESTACIÓN DE BOMBEO PRINCIPAL',
    linea: 'Impulsión EB-01 → Red de distribución Norte',
    zona: 'SECTOR NORTE',
    operador: 'Sala de Control SCADA',
  },
  simulacion: {
    paso: 0.1,
    intervaloMuestra: 1,
    historialMaximo: 7200,
    ventanaGraficas: 120,
    velocidad: 6,
    semilla: 20260420,
  },
  red: {
    tension: 220,
    frecuencia: 60,
    amplitudRuido: 1.5,
    derivaLenta: 1.2,
    resistanciaAlimentador: 0.0075,
    etapas: 3,
  },
  tanque: {
    id: 'TQ-01',
    nombre: 'Reservorio de succión',
    altura: 8,
    diametro: 4,
    nivelInicial: 4.2,
    material: 'Acero soldado',
  },
  impulsion: {
    diametro: 8,
    material: 'Acero SCH40',
    cotaDestino: 22,
    coeficienteSistema: 4600,
    longitud: 1450,
    ingresoAguaCruda: 42,
  },
  destino: {
    id: 'RQ-02',
    nombre: 'Reservorio elevado de distribución',
    altura: 6.5,
    diametro: 6,
    nivelInicial: 3.4,
    demandaBase: 35,
    demandaMin: 18,
    demandaMax: 48,
    nivelMinimo: 1.6,
    nivelMaximo: 5.6,
  },
  dinamica: {
    tiempoArranque: 4.2,
    tiempoParada: 3,
    impulsoCorriente: 2.9,
    constanteImpulso: 0.55,
    corrienteNoCarga: 0.3,
    ventanaCaudal: 1.6,
    nivelSuccionMax: 1.2,
    succionMinima: 0.55,
  },
  controles: {
    interbloqueoValvula: false,
    cierreAutomaticoFalla: true,
  },
  alarmas: {
    tensionMinima: 217,
    tensionMaxima: 231,
    histeresis: 1.5,
    nivelBajo: 1.5,
    nivelCritico: 0.5,
    nivelAlto: 7.2,
    nivelCriticoAlto: 7.6,
    caudalRelativoMinimo: 0.4,
    retardoCaudal: 6,
    retardoNivel: 3,
    retardoTension: 4,
    retardoGeneral: 2,
    sobrecarga: 1.15,
    retardoSobrecarga: 20,
    sobrecargaTrip: 1.32,
    retardoTrip: 30,
    sobrecorriente: 1.18,
    retardoSobrecorriente: 12,
    nivelSuccion: 0.9,
  },
  motores: [
    {
      id: 'M-01',
      descripcion: 'Bomba de impulsión principal 1',
      hp: 20,
      voltaje: 220,
      etapas: 3,
      eficiencia: 0.88,
      factorPotencia: 0.85,
      alturaCierre: 78,
      caudalDiseno: 25,
      cargaInicial: 0,
      horasIniciales: 0,
      estadoInicial: 'PARADO',
      valvula: {
        id: 'V-01',
        estadoInicial: 'CERRADA',
        tiempoRecorrido: 3.5,
        tamano: 1,
      },
    },
    {
      id: 'M-02',
      descripcion: 'Bomba de impulsión principal 2',
      hp: 50,
      voltaje: 220,
      etapas: 3,
      eficiencia: 0.9,
      factorPotencia: 0.86,
      alturaCierre: 48.7,
      caudalDiseno: 80,
      cargaInicial: 0,
      horasIniciales: 0,
      estadoInicial: 'PARADO',
      valvula: {
        id: 'V-02',
        estadoInicial: 'CERRADA',
        tiempoRecorrido: 3.5,
        tamano: 1.25,
      },
    },
  ],
};

export function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

export function fusionar(base, cambios) {
  if (Array.isArray(base)) {
    return Array.isArray(cambios) ? clonar(cambios) : clonar(base);
  }
  if (base && typeof base === 'object' && cambios && typeof cambios === 'object') {
    const resultado = {};
    const claves = new Set([...Object.keys(base), ...Object.keys(cambios)]);
    for (const clave of claves) {
      resultado[clave] = fusionar(base[clave], cambios[clave]);
    }
    return resultado;
  }
  return cambios === undefined ? base : cambios;
}

function limitar(valor, minimo, maximo, respaldo) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return respaldo;
  return Math.min(maximo, Math.max(minimo, n));
}

export function normalizar(cfg) {
  cfg.estacion.id = String(cfg.estacion.id || 'EB-01');
  cfg.estacion.nombre = String(cfg.estacion.nombre || 'ESTACIÓN DE BOMBEO');
  cfg.estacion.linea = String(cfg.estacion.linea || '');
  cfg.estacion.zona = String(cfg.estacion.zona || '');
  cfg.estacion.operador = String(cfg.estacion.operador || '');
  cfg.simulacion.paso = limitar(cfg.simulacion.paso, 0.02, 0.5, 0.1);
  cfg.simulacion.intervaloMuestra = limitar(cfg.simulacion.intervaloMuestra, 0.2, 30, 1);
  cfg.simulacion.historialMaximo = Math.round(limitar(cfg.simulacion.historialMaximo, 200, 60000, 7200));
  cfg.simulacion.ventanaGraficas = limitar(cfg.simulacion.ventanaGraficas, 30, 1800, 120);
  cfg.simulacion.velocidad = limitar(cfg.simulacion.velocidad, 0.5, 60, 10);
  cfg.simulacion.semilla = Math.round(limitar(cfg.simulacion.semilla, 1, 999999999, 20260420));
  cfg.red.tension = limitar(cfg.red.tension, 100, 480, 220);
  cfg.red.amplitudRuido = limitar(cfg.red.amplitudRuido, 0, 20, 1.5);
  cfg.red.derivaLenta = limitar(cfg.red.derivaLenta, 0, 30, 1.2);
  cfg.red.resistenciaAlimentador = limitar(cfg.red.resistenciaAlimentador, 0, 1, 0.0075);
  cfg.tanque.altura = limitar(cfg.tanque.altura, 1, 40, 8);
  cfg.tanque.diametro = limitar(cfg.tanque.diametro, 0.5, 60, 4);
  cfg.tanque.nivelInicial = limitar(cfg.tanque.nivelInicial, 0, cfg.tanque.altura, 4.2);
  cfg.impulsion.cotaDestino = limitar(cfg.impulsion.cotaDestino, 0, 300, 22);
  cfg.impulsion.coeficienteSistema = limitar(cfg.impulsion.coeficienteSistema, 100, 400000, 4600);
  cfg.impulsion.diametro = limitar(cfg.impulsion.diametro, 1, 48, 8);
  cfg.impulsion.longitud = limitar(cfg.impulsion.longitud, 1, 20000, 1450);
  cfg.impulsion.ingresoAguaCruda = limitar(cfg.impulsion.ingresoAguaCruda, 0, 1000, 42);
  cfg.destino.altura = limitar(cfg.destino.altura, 1, 40, 6.5);
  cfg.destino.diametro = limitar(cfg.destino.diametro, 0.5, 80, 6);
  cfg.destino.nivelInicial = limitar(cfg.destino.nivelInicial, 0, cfg.destino.altura, 3.4);
  cfg.destino.demandaBase = Math.max(0, Number(cfg.destino.demandaBase) || 0);
  cfg.destino.demandaMin = Math.max(0, Number(cfg.destino.demandaMin) || 0);
  cfg.destino.demandaMax = Math.max(cfg.destino.demandaMin + 1, Number(cfg.destino.demandaMax) || 1);
  cfg.dinamica.tiempoArranque = limitar(cfg.dinamica.tiempoArranque, 0.5, 30, 4.2);
  cfg.dinamica.tiempoParada = limitar(cfg.dinamica.tiempoParada, 0.5, 30, 3);
  cfg.dinamica.impulsoCorriente = limitar(cfg.dinamica.impulsoCorriente, 1, 8, 2.9);
  cfg.dinamica.constanteImpulso = limitar(cfg.dinamica.constanteImpulso, 0.05, 5, 0.55);
  cfg.dinamica.corrienteNoCarga = limitar(cfg.dinamica.corrienteNoCarga, 0, 0.9, 0.3);
  cfg.dinamica.ventanaCaudal = limitar(cfg.dinamica.ventanaCaudal, 0.1, 20, 1.6);
  cfg.dinamica.nivelSuccionMax = limitar(cfg.dinamica.nivelSuccionMax, 0.2, 6, 1.2);
  cfg.dinamica.succionMinima = limitar(cfg.dinamica.succionMinima, 0, 3, 0.55);
  cfg.controles = cfg.controles || {};
  cfg.controles.interbloqueoValvula = Boolean(cfg.controles.interbloqueoValvula);
  cfg.controles.cierreAutomaticoFalla = cfg.controles.cierreAutomaticoFalla !== false;
  const a = cfg.alarmas;
  a.tensionMinima = limitar(a.tensionMinima, 0, 1000, 217);
  a.tensionMaxima = Math.max(a.tensionMinima + 1, Number(a.tensionMaxima) || 231);
  a.histeresis = limitar(a.histeresis, 0, 10, 1.5);
  a.nivelBajo = limitar(a.nivelBajo, 0, cfg.tanque.altura, 1.5);
  a.nivelCritico = limitar(a.nivelCritico, 0, a.nivelBajo, 0.5);
  a.nivelAlto = limitar(a.nivelAlto, 0, cfg.tanque.altura, 7.2);
  a.nivelCriticoAlto = limitar(a.nivelCriticoAlto, a.nivelAlto, cfg.tanque.altura, 7.6);
  a.nivelSuccion = limitar(a.nivelSuccion, 0, a.nivelBajo + 2, 0.9);
  cfg.destino.nivelMinimo = limitar(cfg.destino.nivelMinimo, 0, cfg.destino.altura, 1.6);
  cfg.destino.nivelMaximo = limitar(cfg.destino.nivelMaximo, cfg.destino.nivelMinimo, cfg.destino.altura, 5.6);
  a.caudalRelativoMinimo = limitar(a.caudalRelativoMinimo, 0, 1, 0.4);
  a.retardoCaudal = Math.max(0.5, Number(a.retardoCaudal) || 6);
  a.retardoNivel = Math.max(0.5, Number(a.retardoNivel) || 3);
  a.retardoTension = Math.max(0.5, Number(a.retardoTension) || 4);
  a.retardoGeneral = Math.max(0.5, Number(a.retardoGeneral) || 2);
  a.sobrecarga = limitar(a.sobrecarga, 1, 2, 1.12);
  a.retardoSobrecarga = Math.max(1, Number(a.retardoSobrecarga) || 20);
  a.sobrecargaTrip = Math.max(a.sobrecarga, limitar(a.sobrecargaTrip, 1, 2, 1.35));
  a.retardoTrip = Math.max(1, Number(a.retardoTrip) || 30);
  a.sobrecorriente = limitar(a.sobrecorriente, 1, 2, 1.15);
  a.retardoSobrecorriente = Math.max(1, Number(a.retardoSobrecorriente) || 12);
  a.nivelSuccion = limitar(a.nivelSuccion, 0, a.nivelBajo + 2, 0.9);

  const vistos = new Set();
  cfg.motores = (Array.isArray(cfg.motores) ? cfg.motores : []).map((m, indice) =>
    normalizarMotor(m, indice, vistos),
  );
  if (cfg.motores.length === 0) {
    cfg.motores = [normalizarMotor(CONFIG_POR_DEFECTO.motores[0], 0, vistos)];
  }
  return cfg;
}

function normalizarMotor(motor, indice, vistos) {
  const base = clonar(CONFIG_POR_DEFECTO.motores[indice % 2]);
  const m = fusionar(base, motor || {});
  let id = String(m.id || '').trim() || `M-${String(indice + 1).padStart(2, '0')}`;
  while (vistos.has(id)) id = `${id}-${indice + 1}`;
  vistos.add(id);
  m.id = id;
  m.descripcion = String(m.descripcion || `Equipo de impulsión ${indice + 1}`);
  m.hp = limitar(m.hp, 1, 5000, 20);
  m.voltaje = limitar(m.voltaje, 48, 1000, 220);
  m.etapas = limitar(m.etapas, 1, 3, 3);
  m.eficiencia = limitar(m.eficiencia, 0.3, 0.99, 0.88);
  m.factorPotencia = limitar(m.factorPotencia, 0.4, 1, 0.85);
  m.alturaCierre = limitar(m.alturaCierre, 2, 400, 52);
  m.caudalDiseno = limitar(m.caudalDiseno, 0.2, 500, 26);
  m.cargaInicial = limitar(m.cargaInicial, 0, 100, 0);
  m.horasIniciales = Math.max(0, Number(m.horasIniciales) || 0);
  if (!ESTADOS_MOTOR.includes(m.estadoInicial)) m.estadoInicial = 'PARADO';
  const v = fusionar(base.valvula, m.valvula || {});
  v.id = String(v.id || '').trim() || `V-${String(indice + 1).padStart(2, '0')}`;
  v.tiempoRecorrido = limitar(v.tiempoRecorrido, 0.2, 30, 3.5);
  v.tamano = limitar(v.tamano, 0.2, 3, 1);
  if (!ESTADOS_VALVULA.includes(v.estadoInicial)) v.estadoInicial = 'CERRADA';
  m.valvula = v;
  return m;
}

export function crearConfiguracion(parcial) {
  const base = clonar(CONFIG_POR_DEFECTO);
  const cfg = parcial ? fusionar(base, parcial) : base;
  return normalizar(cfg);
}

export function perfilDemanda(horaDelDia) {
  const tabla = [
    0.62, 0.58, 0.55, 0.55, 0.6, 0.72, 0.9, 1.05, 1.1, 1.12, 1.15, 1.18,
    1.16, 1.12, 1.1, 1.12, 1.18, 1.24, 1.2, 1.1, 0.95, 0.8, 0.68, 0.62,
  ];
  const h = ((horaDelDia % 24) + 24) % 24;
  const i = Math.floor(h);
  const f = h - i;
  const a = tabla[i % tabla.length];
  const b = tabla[(i + 1) % tabla.length];
  return a + (b - a) * f;
}
