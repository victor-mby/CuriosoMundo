const severidades = { CRITICA: 3, ALTA: 2, MEDIA: 1 };

export function crearGestorAlarmas(cfg, alRegistrar) {
  const registros = new Map();
  const historico = [];
  const reglas = construirReglas(cfg);

  function obtener(id) {
    let registro = registros.get(id);
    if (!registro) {
      registro = {
        id,
        activa: false,
        temporizador: 0,
        severidad: 'MEDIA',
        inicio: null,
        fin: null,
        valor: null,
        limite: null,
        mensaje: '',
        equipo: 'ESTACIÓN',
        veces: 0,
        acknowledge: false,
      };
      registros.set(id, registro);
    }
    return registro;
  }

  function activar(registro, regla, evaluacion, tiempo) {
    registro.activa = true;
    registro.severidad = evaluacion.severidad || regla.severidad;
    registro.inicio = tiempo;
    registro.fin = null;
    registro.valor = evaluacion.valor;
    registro.limite = evaluacion.limite;
    registro.mensaje = evaluacion.mensaje;
    registro.equipo = regla.equipo;
    registro.veces += 1;
    registro.acknowledge = false;
    alRegistrar({
      tipo: 'ALARMA',
      equipo: regla.equipo,
      severidad: registro.severidad,
      texto: `${regla.titulo}: ${evaluacion.mensaje}`,
    });
  }

  function limpiar(registro, regla, tiempo) {
    registro.activa = false;
    registro.fin = tiempo;
    registro.temporizador = 0;
    const duracion = tiempo - (registro.inicio || tiempo);
    alRegistrar({
      tipo: 'ALARMA',
      equipo: regla.equipo,
      severidad: 'INFO',
      texto: `Recuperada ${regla.titulo} (duración ${duracion.toFixed(0)} s).`,
    });
  }

  function evaluar(contexto) {
    const nuevas = [];
    for (const regla of reglas) {
      const registro = obtener(regla.id);
      const evaluacion = regla.evaluar(contexto, registro.activa);
      if (!evaluacion) continue;
      if (evaluacion.activa) {
        registro.temporizador += contexto.dt;
        registro.valor = evaluacion.valor;
        registro.limite = evaluacion.limite;
        if (!registro.activa && registro.temporizador >= regla.retardo) {
          activar(registro, regla, evaluacion, contexto.tiempo);
          nuevas.push(registro);
        } else if (registro.activa) {
          registro.mensaje = evaluacion.mensaje;
          registro.severidad = evaluacion.severidad || regla.severidad;
        }
      } else if (registro.activa) {
        limpiar(registro, regla, contexto.tiempo);
        nuevas.push(registro);
      } else {
        registro.temporizador = 0;
      }
    }
    if (nuevas.length > 0) {
      for (const registro of nuevas) {
        historico.push({ ...registro });
      }
      if (historico.length > 400) historico.splice(0, historico.length - 400);
    }
    return nuevas;
  }

  function listar() {
    return Array.from(registros.values())
      .filter((r) => r.activa)
      .sort((a, b) => severidades[b.severidad] - severidades[a.severidad] || a.id.localeCompare(b.id));
  }

  function historicoCompleto() {
    return historico.slice().reverse();
  }

  function acknowledge(id) {
    const registro = obtener(id);
    registro.acknowledge = true;
    return registro;
  }

  function acknowledgeTodas() {
    for (const registro of registros.values()) {
      if (registro.activa) registro.acknowledge = true;
    }
  }

  function reiniciar() {
    registros.clear();
    historico.length = 0;
  }

  function contar() {
    let criticas = 0;
    let totales = 0;
    let sinConfirmar = 0;
    for (const registro of registros.values()) {
      if (!registro.activa) continue;
      totales += 1;
      if (registro.severidad === 'CRITICA') criticas += 1;
      if (!registro.acknowledge) sinConfirmar += 1;
    }
    return { criticas, totales, sinConfirmar };
  }

  return { evaluar, listar, historico: historicoCompleto, acknowledge, acknowledgeTodas, reiniciar, contar, obtener };
}

function construirReglas(cfg) {
  const a = cfg.alarmas;
  const reglas = [
    {
      id: 'TEN-ALTA',
      titulo: 'Sobretensión en barras',
      severidad: 'ALTA',
      equipo: 'AL-01',
      retardo: a.retardoTension,
      evaluar: (ctx, activa) => {
        const limite = activa ? a.tensionMaxima - a.histeresis : a.tensionMaxima;
        return {
          activa: ctx.red.tension > limite,
          valor: ctx.red.tension,
          limite,
          mensaje: `Tensión de barras ${ctx.red.tension.toFixed(1)} V por encima de ${a.tensionMaxima} V.`,
        };
      },
    },
    {
      id: 'TEN-BAJA',
      titulo: 'Baja tensión en barras',
      severidad: 'ALTA',
      equipo: 'AL-01',
      retardo: a.retardoTension,
      evaluar: (ctx, activa) => {
        const limite = activa ? a.tensionMinima + a.histeresis : a.tensionMinima;
        return {
          activa: ctx.red.tension < limite,
          valor: ctx.red.tension,
          limite,
          mensaje: `Tensión de barras ${ctx.red.tension.toFixed(1)} V por debajo de ${a.tensionMinima} V.`,
        };
      },
    },
    {
      id: 'NIV-BAJO',
      titulo: 'Nivel bajo en reservorio',
      severidad: 'MEDIA',
      equipo: cfg.tanque.id,
      retardo: a.retardoNivel,
      evaluar: (ctx, activa) => {
        const limite = activa ? a.nivelBajo + a.histeresis * 0.2 : a.nivelBajo;
        return {
          activa: ctx.tanque.nivel < limite,
          valor: ctx.tanque.nivel,
          limite,
          mensaje: `Nivel ${ctx.tanque.nivel.toFixed(2)} m por debajo del mínimo operativo ${a.nivelBajo} m.`,
        };
      },
    },
    {
      id: 'NIV-CRITICO',
      titulo: 'Nivel crítico en reservorio',
      severidad: 'CRITICA',
      equipo: cfg.tanque.id,
      retardo: 1.5,
      evaluar: (ctx) => ({
        activa: ctx.tanque.nivel < a.nivelCritico,
        valor: ctx.tanque.nivel,
        limite: a.nivelCritico,
        mensaje: `Nivel ${ctx.tanque.nivel.toFixed(2)} m en zona crítica. Riesgo de succión en vacío.`,
      }),
    },
    {
      id: 'NIV-ALTO',
      titulo: 'Nivel alto en reservorio',
      severidad: 'MEDIA',
      equipo: cfg.tanque.id,
      retardo: a.retardoNivel,
      evaluar: (ctx, activa) => {
        const limite = activa ? a.nivelAlto - a.histeresis * 0.2 : a.nivelAlto;
        return {
          activa: ctx.tanque.nivel > limite,
          valor: ctx.tanque.nivel,
          limite,
          mensaje: `Nivel ${ctx.tanque.nivel.toFixed(2)} m por encima del máximo operativo ${a.nivelAlto} m.`,
        };
      },
    },
    {
      id: 'NIV-DESBORDE',
      titulo: 'Nivel de desborde',
      severidad: 'CRITICA',
      equipo: cfg.tanque.id,
      retardo: 2,
      evaluar: (ctx) => ({
        activa: ctx.tanque.nivel > a.nivelCriticoAlto,
        valor: ctx.tanque.nivel,
        limite: a.nivelCriticoAlto,
        mensaje: `Nivel ${ctx.tanque.nivel.toFixed(2)} m, riesgo de desborde del reservorio.`,
      }),
    },
    {
      id: 'DEST-BAJO',
      titulo: 'Presión baja en destino',
      severidad: 'ALTA',
      equipo: cfg.destino.id,
      retardo: a.retardoNivel * 2,
      evaluar: (ctx, activa) => {
        const limite = activa ? cfg.destino.nivelMinimo + 0.2 : cfg.destino.nivelMinimo;
        return {
          activa: ctx.destino.nivel < limite,
          valor: ctx.destino.nivel,
          limite,
          mensaje: `Nivel de destino ${ctx.destino.nivel.toFixed(2)} m, presión insuficiente en la red.`,
        };
      },
    },
    {
      id: 'DEST-ALTO',
      titulo: 'Destino en nivel máximo',
      severidad: 'MEDIA',
      equipo: cfg.destino.id,
      retardo: a.retardoNivel * 2,
      evaluar: (ctx, activa) => {
        const limite = activa ? cfg.destino.nivelMaximo - 0.2 : cfg.destino.nivelMaximo;
        return {
          activa: ctx.destino.nivel > limite,
          valor: ctx.destino.nivel,
          limite,
          mensaje: `Destino ${ctx.destino.nivel.toFixed(2)} m, revisar caudal de impulsión.`,
        };
      },
    },
    {
      id: 'COM-FALLA',
      titulo: 'Falla de comunicación RTU',
      severidad: 'CRITICA',
      equipo: 'RTU-01',
      retardo: 1,
      evaluar: (ctx) => ({
        activa: !ctx.comunicacion.online,
        valor: 0,
        limite: 1,
        mensaje: 'Enlace de telemetría con el RTU interrumpido. Datos congelados.',
      }),
    },
    {
      id: 'SUC-BAJA',
      titulo: 'Suctor baja con equipos en marcha',
      severidad: 'ALTA',
      equipo: cfg.tanque.id,
      retardo: 2,
      evaluar: (ctx) => ({
        activa: ctx.cualquieraEnMarcha && ctx.tanque.nivel < a.nivelSuccion,
        valor: ctx.tanque.nivel,
        limite: a.nivelSuccion,
        mensaje: `Nivel ${ctx.tanque.nivel.toFixed(2)} m por debajo del mínimo de succión con bombas operando.`,
      }),
    },
  ];

  for (const motor of cfg.motores) {
    const id = motor.id;
    reglas.push({
      id: `MOT-FALLA:${id}`,
      titulo: `Equipo ${id} en falla`,
      severidad: 'CRITICA',
      equipo: id,
      retardo: 0.5,
      evaluar: (ctx) => {
        const m = ctx.porMotor[id];
        if (!m || m.estado !== 'FALLA') return null;
        return {
          activa: true,
          valor: 1,
          limite: 0,
          mensaje: `${id} detenido por ${m.fallo ? m.fallo.codigo : 'protección'}. Requiere reinicio manual.`,
        };
      },
    });
    reglas.push({
      id: `VAL-CERRADA:${id}`,
      titulo: `Válvula de impulsión cerrada con bombeo solicitado`,
      severidad: 'ALTA',
      equipo: motor.valvula.id,
      retardo: 4,
      evaluar: (ctx) => {
        const m = ctx.porMotor[id];
        if (!m) return null;
        const bombero = m.estado === 'ARRANCANDO' || m.estado === 'OPERATIVO' || m.estado === 'DETENIÉNDOSE';
        return {
          activa: bombero && m.valvula.posicion < 0.02,
          valor: m.valvula.posicion * 100,
          limite: 2,
          mensaje: `${motor.valvula.id} cerrada mientras ${id} está en ${m.estado}. Sin caudal de impulsión.`,
        };
      },
    });
    reglas.push({
      id: `CAU-INSF:${id}`,
      titulo: `Caudal insuficiente en ${id}`,
      severidad: 'ALTA',
      equipo: id,
      retardo: a.retardoCaudal,
      evaluar: (ctx) => {
        const m = ctx.porMotor[id];
        if (!m || m.estado !== 'OPERATIVO' || m.valvula.posicion < 0.6) return null;
        const esperado = m.caudalEsperado;
        if (!(esperado > 1)) return null;
        const minimo = esperado * a.caudalRelativoMinimo;
        return {
          activa: m.caudal < minimo,
          valor: m.caudal * 1000,
          limite: minimo * 1000,
          mensaje: `${id} entrega ${(m.caudal * 1000).toFixed(1)} L/s, inferior al mínimo esperado ${(minimo * 1000).toFixed(1)} L/s.`,
        };
      },
    });
    reglas.push({
      id: `SOBRECARGA:${id}`,
      titulo: `Sobrecarga en ${id}`,
      severidad: 'MEDIA',
      equipo: id,
      retardo: a.retardoSobrecarga,
      evaluar: (ctx, activa) => {
        const m = ctx.porMotor[id];
        if (!m || m.estado === 'FALLA' || m.velocidad < 0.2) return null;
        const limite = activa ? a.sobrecarga - 0.05 : a.sobrecarga;
        return {
          activa: m.carga > limite,
          valor: m.carga * 100,
          limite: limite * 100,
          mensaje: `${id} operando al ${(m.carga * 100).toFixed(0)} % de su potencia nominal.`,
        };
      },
    });
    reglas.push({
      id: `SOBRECORRIENTE:${id}`,
      titulo: `Sobrecorriente en ${id}`,
      severidad: 'ALTA',
      equipo: id,
      retardo: a.retardoSobrecorriente,
      evaluar: (ctx, activa) => {
        const m = ctx.porMotor[id];
        if (!m || m.estado === 'FALLA' || m.velocidad < 0.2) return null;
        const limite = activa ? a.sobrecorriente - 0.04 : a.sobrecorriente;
        const referencia = m.placa.corrienteNominal * limite;
        return {
          activa: m.corriente > referencia,
          valor: m.corriente,
          limite: referencia,
          mensaje: `${id} consumiendo ${m.corriente.toFixed(1)} A, sobre el límite de ${referencia.toFixed(1)} A.`,
        };
      },
    });
  }
  return reglas;
}
