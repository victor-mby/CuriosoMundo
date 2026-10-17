import { RHO, HP_W } from './configuracion.js';
import { acotar, mezclar } from '../nucleo/azar.js';

export function placaDeMotor(cfg) {
  const potenciaEje = cfg.hp * HP_W;
  const caudal = Math.max(0.05, cfg.caudalDiseno) / 1000;
  let alturaCierre = Math.max(2, cfg.alturaCierre);
  let alturaDiseno = (potenciaEje * 0.95 * cfg.eficiencia) / (RHO * caudal);
  if (alturaDiseno >= alturaCierre * 0.9) {
    alturaDiseno = alturaCierre * 0.86;
  }
  const caudalCorregido = (potenciaEje * 0.95 * cfg.eficiencia) / (RHO * alturaDiseno);
  const coeficiente = Math.max(1, (alturaCierre - alturaDiseno) / (caudalCorregido * caudalCorregido));
  const corrienteNominal =
    potenciaEje / (Math.sqrt(cfg.etapas) * cfg.voltaje * cfg.factorPotencia);
  return {
    id: cfg.id,
    potenciaKw: potenciaEje / 1000,
    potenciaEje,
    corrienteNominal,
    alturaCierre,
    alturaDiseno,
    caudalDiseno: caudalCorregido * 1000,
    coeficiente,
    etapas: cfg.etapas,
    voltaje: cfg.voltaje,
    eficiencia: cfg.eficiencia,
    factorPotencia: cfg.factorPotencia,
  };
}

export function factorValvula(posicion) {
  if (posicion <= 0.005) return Infinity;
  return 1 + 1.1 * (1 / (posicion * posicion) - 1);
}

export function factorSuccion(nivel, dinamica) {
  const superior = Math.max(0.2, dinamica.nivelSuccionMax);
  const inferior = Math.min(dinamica.succionMinima, superior - 0.05);
  if (nivel >= superior) return 1;
  if (nivel <= inferior) return 0.22;
  return mezclar(0.22, 1, (nivel - inferior) / (superior - inferior));
}

export function perdidasValvula(posicion) {
  const p = acotar(posicion, 0, 1);
  if (p <= 0.005) return Infinity;
  return 1.1 * (1 / (p * p) - 1);
}

export function alturaEstatica(nivel, cotaDestino) {
  return Math.max(0, cotaDestino - nivel);
}

export function resolverPuntoOperacion(motores, opciones) {
  const { alturaEstatica: hEst, coeficienteBase, succion } = opciones;
  let coeficiente = coeficienteBase * (0.95 + 0.15 * opciones.demandaRelativa);
  const activos = [];
  for (const motor of motores) {
    const valvulaAbierta = motor.valvula.posicion > 0.005;
    const enMarcha = motor.velocidad > 0.008;
    if (!valvulaAbierta || !enMarcha) {
      motor.caudal = 0;
      motor.altura = hEst;
      motor.retencionCerrada = enMarcha && !valvulaAbierta;
      continue;
    }
    const adicion = coeficienteBase * perdidasValvula(motor.valvula.posicion) * Math.pow(motor.tamanoValvula, 2);
    coeficiente += Number.isFinite(adicion) ? adicion : Infinity;
    const alturaEfectiva = motor.velocidad * motor.velocidad * motor.placa.alturaCierre * (0.92 + 0.08 * succion);
    activos.push({ motor, alturaEfectiva });
    motor.retencionCerrada = false;
  }

  if (activos.length === 0 || !Number.isFinite(coeficiente) || coeficiente <= 0) {
    for (const item of activos) {
      item.motor.caudal = 0;
      item.motor.altura = hEst;
    }
    return { caudalTotal: 0, altura: hEst, coeficiente, valvulaCerrada: true };
  }

  let maximo = hEst;
  for (const item of activos) maximo = Math.max(maximo, item.alturaEfectiva);
  if (maximo <= hEst) {
    for (const item of activos) {
      item.motor.caudal = 0;
      item.motor.altura = hEst;
      item.motor.retencionCerrada = true;
    }
    return { caudalTotal: 0, altura: hEst, coeficiente, valvulaCerrada: false };
  }

  let bajo = hEst;
  let alto = maximo;
  for (let iteracion = 0; iteracion < 44; iteracion += 1) {
    const medio = (bajo + alto) / 2;
    const oferta = ofertaDeBombas(activos, medio, succion);
    const demanda = Math.sqrt(Math.max(0, (medio - hEst) / coeficiente));
    if (oferta > demanda) bajo = medio;
    else alto = medio;
  }
  const altura = (bajo + alto) / 2;
  let caudalTotal = 0;
  for (const item of activos) {
    const caudal = Math.sqrt(Math.max(0, (item.alturaEfectiva - altura) / item.motor.placa.coeficiente)) * succion;
    item.motor.caudal = caudal;
    item.motor.altura = altura;
    item.motor.retencionCerrada = caudal < 1e-6;
    caudalTotal += caudal;
  }
  return {
    caudalTotal,
    altura,
    coeficiente,
    valvulaCerrada: false,
    potenciaUtil: caudalTotal * RHO * altura,
  };
}

function ofertaDeBombas(activos, altura, succion) {
  let total = 0;
  for (const item of activos) {
    const disponible = item.alturaEfectiva - altura;
    if (disponible > 0) {
      total += Math.sqrt(disponible / item.motor.placa.coeficiente) * succion;
    }
  }
  return total;
}
