import { crear, vaciar, reemplazar } from '../dom.js';
import { numero, porcentaje, horaSegundos, entero, duracion } from '../../nucleo/formato.js';

export function crearPanelAlarmas(contenedor, sim, avisar) {
  const cuerpo = crear('div', { class: 'panel__cuerpo panel__cuerpo--scroll' });
  const cabecera = crear('div', { class: 'panel__cuerpo panel__cabecera-alarmas' });
  vaciar(contenedor).appendChild(cabecera);
  vaciar(contenedor).appendChild(cuerpo);

  const contador = crear('span', { class: 'pastilla', texto: '0' });
  const criticas = crear('span', { class: 'pastilla pastilla--alarma', texto: '0' });
  const btnConfirmar = crear('button', { class: 'boton boton--compacto', type: 'button', texto: 'CONFIRMAR' });
  const btnHistorial = crear('button', { class: 'boton boton--compacto boton--fantasma', type: 'button', texto: 'HISTORIAL' });

  cabecera.appendChild(
    crear('div', { class: 'alarma-cabecera' }, [
      crear('span', { class: 'pastilla-grupo' }, [crear('span', { class: 'pastilla__etiqueta', texto: 'ACTIVAS' }), contador]),
      crear('span', { class: 'pastilla-grupo' }, [crear('span', { class: 'pastilla__etiqueta', texto: 'CRÍTICAS' }), criticas]),
      crear('div', { class: 'alarma-cabecera__acciones' }, [btnConfirmar, btnHistorial]),
    ]),
  );

  let mostrandoHistorico = false;
  btnConfirmar.addEventListener('click', () => {
    sim.confirmarAlarmas();
    avisar({ ok: true, mensaje: 'Alarmas confirmadas.' });
  });
  btnHistorial.addEventListener('click', () => {
    mostrandoHistorico = !mostrandoHistorico;
    btnHistorial.textContent = mostrandoHistorico ? 'ACTIVAS' : 'HISTORIAL';
    btnHistorial.classList.toggle('boton--activo', mostrandoHistorico);
    actualizar();
  });

  const listaVacia = crear('div', { class: 'vacio' }, [crear('span', { texto: 'Sin alarmas activas' })]);

  function actualizar() {
    const gestor = sim.alarmas();
    const activas = gestor.listar();
    contador.textContent = String(activas.length);
    criticas.textContent = String(gestor.contar().criticas);
    contador.className = `pastilla ${activas.length ? 'pastilla--aviso' : ''}`;
    if (mostrandoHistorico) {
      const items = gestor.historico();
      if (!items.length) {
        reemplazar(cuerpo, crear('div', { class: 'vacio' }, [crear('span', { texto: 'Sin historial de alarmas' })]));
        return;
      }
      const filas = items.slice(0, 80).map((a) =>
        crear('tr', { class: a.activa ? 'fila--activa' : '' }, [
          crear('td', { class: 'mono', texto: a.activa ? 'ACTIVA' : 'RECUPERADA' }),
          crear('td', { texto: horaSegundos(a.inicio) }),
          crear('td', { texto: a.equipo }),
          crear('td', { class: `mono severidad-${a.severidad.toLowerCase()}`, texto: a.severidad }),
          crear('td', { texto: a.mensaje }),
          crear('td', { class: 'mono', texto: `${duracion(a.inicio ? (a.fin || a.inicio) - a.inicio : 0)}` }),
        ]),
      );
      reemplazar(cuerpo, tabla(['Estado', 'Hora', 'Equipo', 'Severidad', 'Descripción', 'Duración'], filas, 'tabla tabla--alarmas'));
      return;
    }
    if (!activas.length) {
      if (!cuerpo.contains(listaVacia)) reemplazar(cuerpo, listaVacia);
      return;
    }
    const filas = activas.map((a) =>
      crear('tr', { class: `fila--activa ${a.acknowledge ? 'fila--confirmada' : ''}` }, [
        crear('td', { class: 'mono severidad-' + a.severidad.toLowerCase(), texto: a.severidad }),
        crear('td', { class: 'mono', texto: horaSegundos(a.inicio) }),
        crear('td', { texto: a.equipo }),
        crear('td', { texto: a.mensaje }),
        crear('td', { class: 'mono', texto: `${numero(a.valor, 1)} / ${numero(a.limite, 1)}` }),
        crear('td', {}, [
          crear('button', {
            class: 'boton boton--mini',
            type: 'button',
            texto: a.acknowledge ? 'OK' : 'CONF.',
            on: { click: () => sim.confirmarAlarma(a.id) },
          }),
        ]),
      ]),
    );
    reemplazar(cuerpo, tabla(['Sev.', 'Hora', 'Equipo', 'Descripción', 'Valor / Límite', ''], filas, 'tabla tabla--alarmas tabla--activa'));
  }

  return { actualizar };
}

export function crearPanelEventos(contenedor, sim, avisar) {
  const controles = crear('div', { class: 'filtros' });
  const cuerpo = crear('div', { class: 'panel__cuerpo panel__cuerpo--scroll' });
  vaciar(contenedor).appendChild(controles);
  vaciar(contenedor).appendChild(cuerpo);

  const filtroTipo = crear('select', { class: 'selector selector--compacto' });
  const filtroEquipo = crear('select', { class: 'selector selector--compacto' });
  const btnExportar = crear('button', { class: 'boton boton--compacto', type: 'button', texto: 'EXPORTAR CSV' });
  const contador = crear('span', { class: 'pastilla', texto: '0' });
  controles.appendChild(filtroTipo);
  controles.appendChild(filtroEquipo);
  controles.appendChild(contador);
  controles.appendChild(btnExportar);
  btnExportar.addEventListener('click', () => avisar(sim.exportarEventosCSV()));

  let tipoSeleccionado = '';
  let equipoSeleccionado = '';
  filtroTipo.addEventListener('change', () => {
    tipoSeleccionado = filtroTipo.value;
    actualizar();
  });
  filtroEquipo.addEventListener('change', () => {
    equipoSeleccionado = filtroEquipo.value;
    actualizar();
  });

  let firmas = '';

  function actualizarOpciones() {
    const eventos = sim.eventos.listar();
    const tipos = Array.from(new Set(eventos.map((e) => e.tipo))).sort();
    const equipos = Array.from(new Set(eventos.flatMap((e) => [e.equipo, ...sim.estado().motores.map((m) => m.id)]))).sort();
    const firma = `${tipos.join(',')}|${equipos.join(',')}`;
    if (firma === firmas) return;
    firmas = firma;
    vaciar(filtroTipo).appendChild(crear('option', { value: '', texto: 'TODOS LOS TIPOS' }));
    for (const tipo of tipos) filtroTipo.appendChild(crear('option', { value: tipo, texto: tipo }));
    vaciar(filtroEquipo).appendChild(crear('option', { value: '', texto: 'TODOS LOS EQUIPOS' }));
    for (const equipo of equipos) filtroEquipo.appendChild(crear('option', { value: equipo, texto: equipo }));
    filtroTipo.value = tipoSeleccionado;
    filtroEquipo.value = equipoSeleccionado;
  }

  function actualizar() {
    actualizarOpciones();
    const eventos = sim.eventos.listar();
    contador.textContent = entero(eventos.length);
    const filtrados = eventos.filter(
      (e) => (!tipoSeleccionado || e.tipo === tipoSeleccionado) && (!equipoSeleccionado || e.equipo === equipoSeleccionado),
    );
    const filas = filtrados.slice(0, 300).map((e) =>
      crear('tr', {}, [
        crear('td', { class: 'mono', texto: horaSegundos(e.hora) }),
        crear('td', { class: `mono tipo-${e.tipo.toLowerCase().replace('ó', 'o').replace(' ', '-')}`, texto: e.tipo }),
        crear('td', { texto: e.equipo }),
        crear('td', { texto: e.texto }),
      ]),
    );
    reemplazar(cuerpo, tabla(['Hora', 'Tipo', 'Equipo', 'Descripción'], filas, 'tabla tabla--eventos'));
  }

  return { actualizar };
}

export function tabla(cabeceras, filas, clase) {
  return crear('div', { class: 'tabla-envoltura' }, [
    crear('table', { class: clase || 'tabla' }, [
      crear('thead', {}, [crear('tr', {}, cabeceras.map((h) => crear('th', { texto: h })))]),
      crear('tbody', {}, filas),
    ]),
  ]);
}