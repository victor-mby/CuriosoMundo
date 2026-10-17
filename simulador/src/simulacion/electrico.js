import { ruidoFraccionario, acotar, mezclar, interpolar } from '../nucleo/azar.js';

export function perturbacionActiva(perturbaciones, tiempo) {
  let suma = 0;
  for (const p of perturbaciones) {
    if (tiempo < p.inicio || tiempo > p.inicio + p.duracion) continue;
    const u = (tiempo - p.inicio) / p.duracion;
    const envolvente = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
    suma += p.delta * envolvente;
  }
  return suma;
}

export function tensionBase(cfg, tiempo) {
  const deriva = ruidoFraccionario(tiempo / 240, 17, 3) * cfg.derivaLenta;
  const fluctuacion = ruidoFraccionario(tiempo / 2.4, 91, 2) * cfg.amplitudRuido;
  return cfg.tension + deriva + fluctuacion;
}

export function tensionBarra(cfg, tiempo, corrienteTotal, perturbaciones) {
  const base = tensionBase(cfg, tiempo) + perturbacionActiva(perturbaciones, tiempo);
  const caida = corrienteTotal * cfg.resistenciaAlimentador;
  return acotar(base - caida, 0, 1000);
}

export function calcularMotor(motor, contexto) {
  const { tensionBarra: tension, cfg, ruido } = contexto;
  const placa = motor.placa;
  const dinamica = cfg.dinamica;
  const velocidad = motor.velocidad;

  if (motor.estado === 'FALLA' || velocidad <= 0.002) {
    const corriente = motor.estado === 'FALLA' ? 0 : 0.02 + ruido * 0.05;
    return {
      corriente,
      tensionTerminal: tension,
      potencia: 0,
      potenciaUtil: 0,
      factorPotencia: 0,
      carga: 0,
      velocidad: 0,
    };
  }

  const potenciaHidraulica = motor.caudal * 9810 * motor.altura;
  const potenciaEje = motor.caudal > 1e-9 ? potenciaHidraulica / (motor.eficienciaBomba * motor.eficienciaMotor) : 0;
  const cargaHidraulica = potenciaEje / placa.potenciaEje;
  const corrienteVacio = placa.corrienteNominal * dinamica.corrienteNoCarga;
  const corrienteCarga = corrienteVacio + (placa.corrienteNominal - corrienteVacio) * cargaHidraulica;

  let impulso = 0;
  if (motor.estado === 'ARRANCANDO') {
    impulso =
      placa.corrienteNominal *
      dinamica.impulsoCorriente *
      Math.exp(-motor.tiempoEstado / dinamica.constanteImpulso) *
      (0.45 + 0.55 * velocidad);
  }

  const reintegroSuccion = 1 + (1 - motor.factorSuccionActual) * 0.22;
  const corriente =
    velocidad * corrienteCarga * reintegroSuccion +
    impulso +
    (ruido - 0.5) * placa.corrienteNominal * 0.012;

  const tensionTerminal = Math.max(0, tension - Math.abs(corriente) * 0.02);
  const factorCarga = acotar(cargaHidraulica, 0, 1.6);
  const factorPotencia = acotar(placa.factorPotencia * (0.74 + 0.32 * factorCarga), 0.45, 0.98);
  const potencia = (Math.sqrt(placa.etapas) * tensionTerminal * Math.abs(corriente) * factorPotencia) / 1000;

  return {
    corriente: Math.abs(corriente),
    tensionTerminal,
    potencia,
    potenciaUtil: motor.caudal * 9810 * motor.altura,
    factorPotencia,
    carga: (potencia * 1000) / placa.potenciaEje,
    velocidad,
  };
}

export function calidadSenal(perdidos, paquetes) {
  if (paquetes <= 0) return 100;
  return acotar(100 - (perdidos / paquetes) * 100, 0, 100);
}

export function interpolarLineal(valor, puntos) {
  const x = acotar(valor, puntos[0][0], puntos[puntos.length - 1][0]);
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const [x0, y0] = puntos[i];
    const [x1, y1] = puntos[i + 1];
    if (x >= x0 && x <= x1) return mezclar(y0, y1, interpolar(x, x0, x1));
  }
  return puntos[puntos.length - 1][1];
}
