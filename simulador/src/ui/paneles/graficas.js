import { crear, vaciar, todos } from '../dom.js';
import { numero, porcentaje } from '../../nucleo/formato.js';

const VARIABLES = [
  {
    clave: 'nivel',
    titulo: 'Nivel del reservorio',
    unidad: 'm',
    decimales: 2,
    decimalesEje: 1,
    eje: 'm',
    ambito: 'estacion',
    banda: (cfg) => [
      [cfg.alarmas.nivelBajo, cfg.tanque.altura, 'banda--ok'],
      [0, cfg.alarmas.nivelBajo, 'banda--baja'],
      [cfg.alarmas.nivelCriticoAlto, cfg.tanque.altura, 'banda--alta'],
    ],
    limites: (cfg) => [0, cfg.tanque.altura],
  },
  {
    clave: 'voltaje',
    titulo: 'Voltaje de barras',
    unidad: 'V',
    decimales: 1,
    decimalesEje: 0,
    eje: 'V',
    ambito: 'estacion',
    banda: (cfg) => [[cfg.alarmas.tensionMinima, cfg.alarmas.tensionMaxima, 'banda--ok']],
    limites: () => [205, 235],
  },
  {
    clave: 'amperaje',
    titulo: 'Amperaje de motor',
    unidad: 'A',
    decimales: 1,
    decimalesEje: 0,
    eje: 'A',
    ambito: 'motor',
    equipo: true,
  },
  {
    clave: 'caudal',
    titulo: 'Caudal de impulsión',
    unidad: 'L/s',
    decimales: 1,
    decimalesEje: 0,
    eje: 'L/s',
    ambito: 'motor',
    equipo: true,
  },
  {
    clave: 'potencia',
    titulo: 'Potencia activa',
    unidad: 'kW',
    decimales: 2,
    decimalesEje: 0,
    eje: 'kW',
    ambito: 'motor',
    equipo: true,
  },
  {
    clave: 'nivel_destino',
    titulo: 'Nivel de destino',
    unidad: 'm',
    decimales: 2,
    decimalesEje: 1,
    eje: 'm',
    ambito: 'estacion',
    banda: () => [],
    limites: () => [0, 7],
  },
];

function escalaBonita(maximo, minimo) {
  const rango = Math.max(0.0001, maximo - minimo);
  const pasos = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const paso = pasos.find((p) => rango / p <= 6) || 1000;
  return {
    min: Math.floor(minimo / paso) * paso,
    max: Math.ceil(maximo / paso) * paso,
    paso,
  };
}

export function crearPanelGraficas(contenedor, sim) {
  const controles = crear('div', { class: 'filtros filtros--graficas' });
  const cuadricula = crear('div', { class: 'graficas' });
  vaciar(contenedor).appendChild(controles);
  vaciar(contenedor).appendChild(cuadricula);

  const selectorEquipo = crear('select', { class: 'selector selector--compacto' });
  const selectorVentana = crear('select', { class: 'selector selector--compacto' }, [
    crear('option', { value: '60', texto: '60 s' }),
    crear('option', { value: '120', texto: '2 min' }),
    crear('option', { value: '300', texto: '5 min' }),
    crear('option', { value: '900', texto: '15 min' }),
  ]);
  selectorVentana.value = String(sim.config().simulacion.ventanaGraficas);
  controles.appendChild(crear('span', { class: 'filtros__etiqueta', texto: 'Serie de equipos' }));
  controles.appendChild(selectorEquipo);
  controles.appendChild(crear('span', { class: 'filtros__etiqueta', texto: 'Ventana temporal' }));
  controles.appendChild(selectorVentana);

  let equipoSeleccionado = '';
  let ventana = Number(selectorVentana.value);
  selectorVentana.addEventListener('change', () => {
    ventana = Number(selectorVentana.value);
    dibujar();
  });
  selectorEquipo.addEventListener('change', () => {
    equipoSeleccionado = selectorEquipo.value;
    dibujar();
  });

  const tarjetas = VARIABLES.map((definicion) => {
    const lienzo = crear('canvas', { class: 'grafica__lienzo' });
    const valor = crear('span', { class: 'grafica__actual mono', texto: '—' });
    const minimo = crear('span', { class: 'grafica__estadistica mono', texto: 'min —' });
    const maximo = crear('span', { class: 'grafica__estadistica mono', texto: 'máx —' });
    const promedio = crear('span', { class: 'grafica__estadistica mono', texto: 'prom —' });
    const nodo = crear('article', { class: 'grafica' }, [
      crear('header', { class: 'grafica__cabecera' }, [
        crear('span', { class: 'grafica__titulo', texto: `${definicion.titulo} (${definicion.unidad})` }),
        valor,
      ]),
      lienzo,
      crear('footer', { class: 'grafica__pie' }, [minimo, maximo, promedio]),
    ]);
    cuadricula.appendChild(nodo);
    return { definicion, lienzo, valor, minimo, maximo, promedio, nodo, contexto: lienzo.getContext('2d') };
  });

  function opcionesEquipos(motores) {
    const actual = selectorEquipo.value;
    vaciar(selectorEquipo);
    selectorEquipo.appendChild(crear('option', { value: '', texto: 'TODOS LOS EQUIPOS' }));
    for (const motor of motores) selectorEquipo.appendChild(crear('option', { value: motor.id, texto: motor.id }));
    selectorEquipo.appendChild(crear('option', { value: '__total__', texto: 'TOTAL ESTACIÓN' }));
    selectorEquipo.value = actual && Array.from(selectorEquipo.options).some((o) => o.value === actual) ? actual : '';
    equipoSeleccionado = selectorEquipo.value;
  }

  function serie(registros, definicion, ahora) {
    const total = equipoSeleccionado === '__total__';
    const clave =
      total && definicion.ambito === 'motor'
        ? definicion.clave === 'caudal'
          ? 'caudal_total'
          : definicion.clave === 'potencia'
            ? 'potencia_total'
            : 'corriente_total'
        : definicion.clave;
    const limite = ahora - ventana;
    const enVentana = registros.filter((r) => r.tiempo >= limite && typeof r[clave] === 'number');
    if (!enVentana.length) return [];
    const primerMotor = enVentana[0].motor_id;
    const filtrados = enVentana.filter((r) => {
      if (definicion.ambito === 'estacion') return r.motor_id === primerMotor;
      if (!equipoSeleccionado || total) return r.motor_id === primerMotor;
      return r.motor_id === equipoSeleccionado;
    });
    return filtrados.map((r) => ({ t: r.tiempo, v: r[clave] }));
  }

  function dibujar() {
    const estado = sim.estado();
    const cfg = sim.config();
    const ahora = estado.tiempo;
    const registros = sim.historial.ventana(ventana + 5, ahora);
    if (!registros.length) return;
    for (const tarjeta of tarjetas) {
      const datos = serie(registros, tarjeta.definicion, ahora);
      if (!datos.length) continue;
      dibujarGrafica(tarjeta, datos, ahora, cfg);
    }
  }

  function dibujarGrafica(tarjeta, datos, ahora, cfg) {
    const { definicion, lienzo, contexto } = tarjeta;
    const caja = lienzo.getBoundingClientRect();
    const ancho = Math.max(120, Math.floor(caja.width));
    const alto = Math.max(70, Math.floor(caja.height));
    const dpr = window.devicePixelRatio || 1;
    if (lienzo.width !== Math.floor(ancho * dpr) || lienzo.height !== Math.floor(alto * dpr)) {
      lienzo.width = Math.floor(ancho * dpr);
      lienzo.height = Math.floor(alto * dpr);
    }
    contexto.setTransform(dpr, 0, 0, dpr, 0, 0);
    contexto.clearRect(0, 0, ancho, alto);

    const relleno = contexto.createLinearGradient(0, 0, 0, alto);
    relleno.addColorStop(0, 'rgba(63,169,229,.28)');
    relleno.addColorStop(1, 'rgba(63,169,229,0)');

    let minimo = Infinity;
    let maximo = -Infinity;
    let suma = 0;
    for (const punto of datos) {
      minimo = Math.min(minimo, punto.v);
      maximo = Math.max(maximo, punto.v);
      suma += punto.v;
    }
    const promedio = suma / datos.length;
    let limites = definicion.limites ? definicion.limites(cfg) : null;
    if (!limites) {
      const escala = escalaBonita(maximo * 1.12 + 0.0001, Math.max(0, minimo * 0.88));
      limites = [escala.min, escala.max];
    }
    const yMin = limites[0];
    const yMax = limites[1] === limites[0] ? limites[0] + 1 : limites[1];
    const margen = { izquierda: 46, derecha: 10, arriba: 8, abajo: 18 };
    const w = ancho - margen.izquierda - margen.derecha;
    const h = alto - margen.arriba - margen.abajo;
    const t0 = ahora - ventana;
    const px = (t) => margen.izquierda + ((t - t0) / ventana) * w;
    const py = (v) => margen.arriba + h - ((v - yMin) / (yMax - yMin)) * h;

    contexto.fillStyle = 'rgba(255,255,255,.02)';
    contexto.fillRect(margen.izquierda, margen.arriba, w, h);

    if (definicion.banda) {
      for (const [desde, hasta, clase] of definicion.banda(cfg)) {
        const y1 = py(Math.min(hasta, yMax));
        const y2 = py(Math.max(desde, yMin));
        contexto.fillStyle = colorBanda(clase);
        contexto.fillRect(margen.izquierda, y1, w, Math.max(0, y2 - y1));
      }
    }

    contexto.strokeStyle = 'rgba(126,166,196,.16)';
    contexto.lineWidth = 1;
    contexto.font = '10px "JetBrains Mono", Consolas, monospace';
    contexto.fillStyle = 'rgba(160,190,210,.65)';
    const lineasEje = 4;
    for (let i = 0; i <= lineasEje; i += 1) {
      const valor = yMin + ((yMax - yMin) * i) / lineasEje;
      const y = Math.round(py(valor)) + 0.5;
      contexto.beginPath();
      contexto.moveTo(margen.izquierda, y);
      contexto.lineTo(margen.izquierda + w, y);
      contexto.stroke();
      contexto.textAlign = 'right';
      contexto.fillText(numero(valor, definicion.decimalesEje), margen.izquierda - 6, y + 3);
    }
    contexto.textAlign = 'center';
    const marcas = Math.max(2, Math.min(6, Math.floor(w / 90)));
    for (let i = 0; i <= marcas; i += 1) {
      const t = t0 + (ventana * i) / marcas;
      const x = Math.round(px(t)) + 0.5;
      contexto.beginPath();
      contexto.moveTo(x, margen.arriba);
      contexto.lineTo(x, margen.arriba + h);
      contexto.strokeStyle = 'rgba(126,166,196,.10)';
      contexto.stroke();
      contexto.fillStyle = 'rgba(160,190,210,.55)';
      contexto.fillText(`-${Math.round(ahora - t)}s`, x, alto - 5);
    }

    contexto.beginPath();
    contexto.moveTo(px(datos[0].t), py(Math.max(yMin, Math.min(yMax, datos[0].v))));
    for (const punto of datos) {
      contexto.lineTo(px(punto.t), py(Math.max(yMin, Math.min(yMax, punto.v))));
    }
    const ultimo = datos[datos.length - 1];
    const xUltimo = px(ultimo.t);
    const yUltimo = py(Math.max(yMin, Math.min(yMax, ultimo.v)));
    contexto.lineTo(xUltimo, margen.arriba + h);
    contexto.lineTo(px(datos[0].t), margen.arriba + h);
    contexto.closePath();
    contexto.fillStyle = relleno;
    contexto.fill();

    contexto.beginPath();
    contexto.moveTo(px(datos[0].t), py(Math.max(yMin, Math.min(yMax, datos[0].v))));
    for (const punto of datos) {
      contexto.lineTo(px(punto.t), py(Math.max(yMin, Math.min(yMax, punto.v))));
    }
    contexto.strokeStyle = colorLinea(tarjeta.definicion.clave);
    contexto.lineWidth = 1.8;
    contexto.lineJoin = 'round';
    contexto.stroke();

    contexto.beginPath();
    contexto.arc(xUltimo, yUltimo, 3, 0, Math.PI * 2);
    contexto.fillStyle = colorLinea(tarjeta.definicion.clave);
    contexto.fill();
    contexto.beginPath();
    contexto.arc(xUltimo, yUltimo, 6, 0, Math.PI * 2);
    contexto.strokeStyle = `${colorLinea(tarjeta.definicion.clave)}66`;
    contexto.lineWidth = 1.5;
    contexto.stroke();

    tarjeta.valor.textContent = `${numero(ultimo.v, definicion.decimales)} ${definicion.unidad}`;
    tarjeta.minimo.textContent = `min ${numero(minimo, definicion.decimales)}`;
    tarjeta.maximo.textContent = `máx ${numero(maximo, definicion.decimales)}`;
    tarjeta.promedio.textContent = `prom ${numero(promedio, definicion.decimales)}`;
  }

  function colorLinea(clave) {
    if (clave === 'nivel') return '#3fa9e5';
    if (clave === 'voltaje') return '#f5c451';
    if (clave === 'amperaje') return '#7ee08a';
    if (clave === 'caudal') return '#4fd1c5';
    if (clave === 'potencia') return '#c48cf0';
    return '#9fb3c8';
  }

  function colorBanda(clase) {
    if (clase === 'banda--baja') return 'rgba(230,74,74,.10)';
    if (clase === 'banda--alta') return 'rgba(245,196,81,.10)';
    return 'rgba(126,224,138,.07)';
  }

  function actualizar() {
    opcionesEquipos(sim.estado().motores);
    dibujar();
  }

  return { actualizar, redimensionar: dibujar };
}