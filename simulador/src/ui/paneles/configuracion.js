import { crear, vaciar } from '../dom.js';
import { clonar } from '../../simulacion/configuracion.js';

function leer(cfg, ruta) {
  return ruta.split('.').reduce((acc, clave) => (acc === undefined || acc === null ? acc : acc[clave]), cfg);
}

function escribir(objeto, ruta, valor) {
  const partes = ruta.split('.');
  const ultima = partes.pop();
  const destino = partes.reduce((acc, clave) => acc[clave], objeto);
  destino[ultima] = valor;
}

export function crearPanelConfiguracion(contenedor, sim, avisar) {
  const cuerpo = crear('div', { class: 'panel__cuerpo panel__cuerpo--scroll configuracion' });
  vaciar(contenedor).appendChild(cuerpo);
  const campos = [];
  const camposMotor = [];
  let firmas = '';

  function seccion(titulo, descripcion, nodos) {
    return crear('section', { class: 'config-seccion' }, [
      crear('header', { class: 'config-seccion__cabecera' }, [
        crear('h3', { texto: titulo }),
        descripcion ? crear('p', { texto: descripcion }) : null,
      ]),
      crear('div', { class: 'config-seccion__campos' }, nodos.filter(Boolean)),
    ]);
  }

  function campoEstacion(etiqueta, ruta, tipo, valores) {
    const entrada = valores
      ? crear('select', { class: 'campo__entrada' }, valores.map((v) => crear('option', { value: String(v), texto: String(v) })))
      : crear('input', { class: 'campo__entrada', type: tipo || 'text' });
    const nodo = crear('label', { class: 'campo' }, [crear('span', { class: 'campo__etiqueta', texto: etiqueta }), entrada]);
    campos.push({ entrada, ruta, tipo: tipo || 'text', nodo });
    return nodo;
  }

  function campoMotor(indice, etiqueta, ruta, tipo, valores) {
    const entrada = valores
      ? crear('select', { class: 'campo__entrada' }, valores.map((v) => crear('option', { value: String(v), texto: String(v) })))
      : crear('input', { class: 'campo__entrada', type: tipo || 'number' });
    const nodo = crear('label', { class: 'campo' }, [crear('span', { class: 'campo__etiqueta', texto: etiqueta }), entrada]);
    camposMotor.push({ entrada, indice, ruta, tipo: tipo || 'number', nodo });
    return nodo;
  }

  function recolectarMotores() {
    const resultado = sim.config().motores.map((m) => clonar(m));
    for (const campo of camposMotor) {
      const destino = resultado[campo.indice];
      if (!destino) continue;
      escribir(destino, campo.ruta, campo.tipo === 'number' ? Number(campo.entrada.value) : campo.entrada.value);
    }
    return resultado;
  }

  function construir() {
    const cfg = sim.config();
    vaciar(cuerpo);
    campos.length = 0;
    camposMotor.length = 0;

    const botonGuardar = crear('button', { class: 'boton boton--primario', type: 'button', texto: 'APLICAR CAMBIOS' });
    const botonReiniciar = crear('button', { class: 'boton boton--fantasma', type: 'button', texto: 'REINICIAR SIMULACIÓN' });
    const botonAlarmas = crear('button', { class: 'boton boton--fantasma', type: 'button', texto: 'REINICIAR ALARMAS' });
    botonGuardar.addEventListener('click', () => {
      const cambios = {};
      for (const campo of campos) {
        escribir(cambios, campo.ruta, campo.tipo === 'number' ? Number(campo.entrada.value) : campo.entrada.value);
      }
      const resultado = sim.aplicarConfig({ ...cambios, motores: recolectarMotores() });
      sincronizar(resultado);
      avisar({ ok: true, mensaje: 'Configuración aplicada en caliente a la estación.' });
    });
    botonReiniciar.addEventListener('click', () => {
      sim.reiniciar();
      construir();
      avisar({ ok: true, mensaje: 'Simulación reiniciada con la configuración vigente.' });
    });
    botonAlarmas.addEventListener('click', () => {
      sim.reiniciarAlarmas();
      avisar({ ok: true, mensaje: 'Registro de alarmas reiniciado.' });
    });

    const hpNuevo = crear('input', { class: 'campo__entrada campo__entrada--corta', type: 'number', value: '15', min: '1', max: '5000' });
    const botonAgregar = crear('button', { class: 'boton boton--primario boton--compacto', type: 'button', texto: 'AGREGAR EQUIPO' });
    botonAgregar.addEventListener('click', () => {
      const hp = Number(hpNuevo.value) || 15;
      const total = sim.config().motores.length + 1;
      const cfgNuevo = sim.agregarMotor({
        hp,
        caudalDiseno: Math.round(hp * 1.05 * 10) / 10,
        alturaCierre: hp > 30 ? 52 : 74,
        descripcion: `Equipo de impulsión adicional ${total}`,
        valvula: { id: `V-${String(total).padStart(2, '0')}`, tiempoRecorrido: 3.5, tamano: 1 },
      });
      construir();
      avisar({ ok: true, mensaje: `Equipo agregado. La estación opera con ${cfgNuevo.motores.length} motores.` });
    });

    const secciones = [
      seccion('ESTACIÓN', 'Identificación del punto de bombeo simulado', [
        campoEstacion('Nombre', 'estacion.nombre', 'text'),
        campoEstacion('Identificador', 'estacion.id', 'text'),
        campoEstacion('Línea / destino', 'estacion.linea', 'text'),
        campoEstacion('Zona', 'estacion.zona', 'text'),
        campoEstacion('Operador', 'estacion.operador', 'text'),
      ]),
      seccion('SIMULACIÓN', 'Parámetros del motor de simulación y del muestreo de telemetría', [
        campoEstacion('Paso de integración (s)', 'simulacion.paso', 'number'),
        campoEstacion('Intervalo de muestreo (s)', 'simulacion.intervaloMuestra', 'number'),
        campoEstacion('Capacidad de historial', 'simulacion.historialMaximo', 'number'),
        campoEstacion('Ventana de gráficas (s)', 'simulacion.ventanaGraficas', 'number'),
        campoEstacion('Velocidad de simulación', 'simulacion.velocidad', 'number'),
        campoEstacion('Interbloqueo de válvula', 'controles.interbloqueoValvula', 'select', ['false', 'true']),
        campoEstacion('Cierre automático ante falla', 'controles.cierreAutomaticoFalla', 'select', ['true', 'false']),
      ]),
      seccion('RED ELÉCTRICA', 'Alimentación y fluctuaciones de la tensión de barras', [
        campoEstacion('Tensión nominal (V)', 'red.tension', 'number'),
        campoEstacion('Frecuencia (Hz)', 'red.frecuencia', 'number'),
        campoEstacion('Amplitud de fluctuación (V)', 'red.amplitudRuido', 'number'),
        campoEstacion('Deriva lenta (V)', 'red.derivaLenta', 'number'),
        campoEstacion('Resistencia de alimentador (Ω)', 'red.resistenciaAlimentador', 'number'),
      ]),
      seccion('RESERVORIO DE SUCCIÓN', 'Geometría y nivel inicial del tanque', [
        campoEstacion('Identificador', 'tanque.id', 'text'),
        campoEstacion('Nombre', 'tanque.nombre', 'text'),
        campoEstacion('Altura (m)', 'tanque.altura', 'number'),
        campoEstacion('Diámetro (m)', 'tanque.diametro', 'number'),
        campoEstacion('Nivel inicial (m)', 'tanque.nivelInicial', 'number'),
      ]),
      seccion('LÍNEA DE IMPULSIÓN', 'Pérdidas de carga y aporte de agua cruda', [
        campoEstacion('Cota del destino (m)', 'impulsion.cotaDestino', 'number'),
        campoEstacion('Coeficiente de sistema', 'impulsion.coeficienteSistema', 'number'),
        campoEstacion('Diámetro de tubería (in)', 'impulsion.diametro', 'number'),
        campoEstacion('Longitud (m)', 'impulsion.longitud', 'number'),
        campoEstacion('Ingreso de agua cruda (L/s)', 'impulsion.ingresoAguaCruda', 'number'),
      ]),
      seccion('DESTINO DE IMPULSIÓN', 'Reservorio elevado y demanda de la red', [
        campoEstacion('Identificador', 'destino.id', 'text'),
        campoEstacion('Altura (m)', 'destino.altura', 'number'),
        campoEstacion('Diámetro (m)', 'destino.diametro', 'number'),
        campoEstacion('Nivel inicial (m)', 'destino.nivelInicial', 'number'),
        campoEstacion('Demanda base (L/s)', 'destino.demandaBase', 'number'),
        campoEstacion('Demanda mínima (L/s)', 'destino.demandaMin', 'number'),
        campoEstacion('Demanda máxima (L/s)', 'destino.demandaMax', 'number'),
        campoEstacion('Nivel mínimo (m)', 'destino.nivelMinimo', 'number'),
        campoEstacion('Nivel máximo (m)', 'destino.nivelMaximo', 'number'),
      ]),
      seccion('DINÁMICA DE EQUIPOS', 'Comportamiento de arranque, parada y succión', [
        campoEstacion('Tiempo de arranque (s)', 'dinamica.tiempoArranque', 'number'),
        campoEstacion('Tiempo de parada (s)', 'dinamica.tiempoParada', 'number'),
        campoEstacion('Pico de arranque (×In)', 'dinamica.impulsoCorriente', 'number'),
        campoEstacion('Constante de impulso (s)', 'dinamica.constanteImpulso', 'number'),
        campoEstacion('Corriente en vacío (×In)', 'dinamica.corrienteNoCarga', 'number'),
        campoEstacion('Suavizado de caudal (s)', 'dinamica.ventanaCaudal', 'number'),
        campoEstacion('Nivel de succión máximo (m)', 'dinamica.nivelSuccionMax', 'number'),
        campoEstacion('Factor de succión mínimo', 'dinamica.succionMinima', 'number'),
      ]),
      seccion('ALARMAS', 'Umbrales y retardos del sistema de alarmas', [
        campoEstacion('Tensión mínima (V)', 'alarmas.tensionMinima', 'number'),
        campoEstacion('Tensión máxima (V)', 'alarmas.tensionMaxima', 'number'),
        campoEstacion('Nivel bajo (m)', 'alarmas.nivelBajo', 'number'),
        campoEstacion('Nivel crítico (m)', 'alarmas.nivelCritico', 'number'),
        campoEstacion('Nivel alto (m)', 'alarmas.nivelAlto', 'number'),
        campoEstacion('Nivel de desborde (m)', 'alarmas.nivelCriticoAlto', 'number'),
        campoEstacion('Caudal relativo mínimo', 'alarmas.caudalRelativoMinimo', 'number'),
        campoEstacion('Umbral de sobrecarga', 'alarmas.sobrecarga', 'number'),
        campoEstacion('Umbral de disparo', 'alarmas.sobrecargaTrip', 'number'),
        campoEstacion('Umbral de sobrecorriente', 'alarmas.sobrecorriente', 'number'),
        campoEstacion('Retardo de caudal (s)', 'alarmas.retardoCaudal', 'number'),
        campoEstacion('Retardo de nivel (s)', 'alarmas.retardoNivel', 'number'),
        campoEstacion('Retardo de tensión (s)', 'alarmas.retardoTension', 'number'),
        campoEstacion('Nivel mínimo de succión (m)', 'alarmas.nivelSuccion', 'number'),
      ]),
    ];

    cfg.motores.forEach((motor, indice) => {
      const quitar = crear('button', { class: 'boton boton--peligro boton--compacto', type: 'button', texto: 'RETIRAR EQUIPO' });
      quitar.addEventListener('click', () => {
        const resultado = sim.quitarMotor(motor.id);
        avisar(resultado);
        if (resultado.ok) construir();
      });
      secciones.push(
        seccion(`EQUIPO ${motor.id}`, motor.descripcion, [
          campoMotor(indice, 'Identificador', 'id', 'text'),
          campoMotor(indice, 'Descripción', 'descripcion', 'text'),
          campoMotor(indice, 'Potencia (HP)', 'hp', 'number'),
          campoMotor(indice, 'Voltaje (V)', 'voltaje', 'number'),
          campoMotor(indice, 'Fases', 'etapas', 'select', [1, 3]),
          campoMotor(indice, 'Eficiencia de bomba', 'eficiencia', 'number'),
          campoMotor(indice, 'Cos φ nominal', 'factorPotencia', 'number'),
          campoMotor(indice, 'Altura de cierre (m)', 'alturaCierre', 'number'),
          campoMotor(indice, 'Caudal de diseño (L/s)', 'caudalDiseno', 'number'),
          campoMotor(indice, 'Estado inicial', 'estadoInicial', 'select', ['PARADO', 'OPERATIVO']),
          campoMotor(indice, 'Carga inicial (%)', 'cargaInicial', 'number'),
          campoMotor(indice, 'Horas iniciales', 'horasIniciales', 'number'),
          campoMotor(indice, 'Válvula asociada', 'valvula.id', 'text'),
          campoMotor(indice, 'Estado inicial de válvula', 'valvula.estadoInicial', 'select', ['CERRADA', 'ABIERTA']),
          campoMotor(indice, 'Tiempo de recorrido (s)', 'valvula.tiempoRecorrido', 'number'),
          crear('div', { class: 'campo' }, [quitar]),
        ]),
      );
    });

    secciones.push(
      seccion('FLOTA DE EQUIPOS', 'La estación admite cualquier cantidad de motores', [
        crear('label', { class: 'campo' }, [
          crear('span', { class: 'campo__etiqueta', texto: 'Potencia del nuevo equipo (HP)' }),
          hpNuevo,
        ]),
        crear('div', { class: 'campo' }, [botonAgregar]),
      ]),
    );

    for (const seccion of secciones) cuerpo.appendChild(seccion);
    cuerpo.appendChild(crear('div', { class: 'config-acciones' }, [botonGuardar, botonReiniciar, botonAlarmas]));
    sincronizar(cfg);
  }

  function sincronizar(cfg) {
    for (const campo of campos) {
      const valor = leer(cfg, campo.ruta);
      campo.entrada.value = valor === undefined || valor === null ? '' : String(valor);
    }
    for (const campo of camposMotor) {
      const motor = cfg.motores[campo.indice];
      if (!motor) continue;
      const valor = leer(motor, campo.ruta);
      campo.entrada.value = valor === undefined || valor === null ? '' : String(valor);
    }
  }

  function actualizar() {
    const cfg = sim.config();
    const firma = `${cfg.motores.map((m) => m.id).join(',')}|${cfg.estacion.id}|${cfg.motores.length}`;
    if (firma === firmas) return;
    firmas = firma;
    construir();
  }

  return { actualizar, construir };
}