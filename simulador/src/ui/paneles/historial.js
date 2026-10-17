import { crear, vaciar, reemplazar } from '../dom.js';
import { numero, porcentaje, entero, horaSegundos } from '../../nucleo/formato.js';

const COLUMNAS = [
  ['hora', 'Hora', 1],
  ['motor_id', 'Motor', 0],
  ['nivel', 'Nivel (m)', 2],
  ['voltaje', 'Voltaje (V)', 1],
  ['amperaje', 'Amperaje (A)', 1],
  ['caudal', 'Caudal (L/s)', 1],
  ['potencia', 'Potencia (kW)', 2],
  ['estado_motor', 'Estado motor', 0],
  ['estado_valvula', 'Estado válvula', 0],
  ['carga', 'Carga (%)', 0],
  ['altura', 'Altura (m)', 1],
  ['nivel_destino', 'Destino (m)', 2],
];

export function crearPanelHistorial(contenedor, sim, avisar) {
  const controles = crear('div', { class: 'filtros' });
  const cuerpo = crear('div', { class: 'panel__cuerpo panel__cuerpo--scroll' });
  vaciar(contenedor).appendChild(controles);
  vaciar(contenedor).appendChild(cuerpo);

  const filtroMotor = crear('select', { class: 'selector selector--compacto' });
  const filtroCantidad = crear('select', { class: 'selector selector--compacto' }, [
    crear('option', { value: '50', texto: 'Últimos 50' }),
    crear('option', { value: '150', texto: 'Últimos 150' }),
    crear('option', { value: '400', texto: 'Últimos 400' }),
    crear('option', { value: '1000', texto: 'Últimos 1000' }),
  ]);
  filtroCantidad.value = '150';
  const btnExportar = crear('button', { class: 'boton boton--compacto', type: 'button', texto: 'EXPORTAR CSV' });
  const btnLimpiar = crear('button', { class: 'boton boton--compacto boton--peligro', type: 'button', texto: 'BORRAR HISTORIAL' });
  const info = crear('span', { class: 'filtros__info mono', texto: '0 registros' });

  controles.appendChild(crear('span', { class: 'filtros__etiqueta', texto: 'Equipo' }));
  controles.appendChild(filtroMotor);
  controles.appendChild(crear('span', { class: 'filtros__etiqueta', texto: 'Registros' }));
  controles.appendChild(filtroCantidad);
  controles.appendChild(info);
  controles.appendChild(btnExportar);
  controles.appendChild(btnLimpiar);

  btnExportar.addEventListener('click', () =>
    avisar(sim.exportar({ motor: filtroMotor.value || undefined, limite: Number(filtroCantidad.value) })),
  );
  btnLimpiar.addEventListener('click', () => avisar(sim.limpiarHistorial()));

  let motorSeleccionado = '';
  filtroMotor.addEventListener('change', () => {
    motorSeleccionado = filtroMotor.value;
    actualizar();
  });

  let firmas = '';

  function actualizarOpciones(motores) {
    const actual = motorSeleccionado;
    const nueva = motores.map((m) => m.id).join('|');
    if (nueva === firmas) return;
    firmas = nueva;
    vaciar(filtroMotor).appendChild(crear('option', { value: '', texto: 'TODOS LOS EQUIPOS' }));
    for (const motor of motores) filtroMotor.appendChild(crear('option', { value: motor.id, texto: motor.id }));
    filtroMotor.value = actual;
    motorSeleccionado = actual;
  }

  function actualizar() {
    const motores = sim.estado().motores;
    actualizarOpciones(motores);
    const limite = Number(filtroCantidad.value);
    const registros = sim.historial.listar(limite).filter((r) => !motorSeleccionado || r.motor_id === motorSeleccionado);
    const total = sim.historial.total();
    info.textContent = `${entero(registros.length)} de ${entero(total)} registros · capacidad ${entero(sim.historial.capacidad())}`;
    const filas = registros
      .slice()
      .reverse()
      .map((r) =>
        crear('tr', { class: `estado-fila estado-fila--${r.estado_motor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}` }, [
          crear('td', { class: 'mono', texto: r.hora }),
          crear('td', { class: 'mono', texto: r.motor_id }),
          crear('td', { class: 'mono', texto: numero(r.nivel, 2) }),
          crear('td', { class: 'mono', texto: numero(r.voltaje, 1) }),
          crear('td', { class: 'mono', texto: numero(r.amperaje, 1) }),
          crear('td', { class: 'mono', texto: numero(r.caudal, 1) }),
          crear('td', { class: 'mono', texto: numero(r.potencia, 2) }),
          crear('td', { texto: r.estado_motor }),
          crear('td', { texto: r.estado_valvula }),
          crear('td', { class: 'mono', texto: `${numero(r.carga, 0)} %` }),
          crear('td', { class: 'mono', texto: numero(r.altura, 1) }),
          crear('td', { class: 'mono', texto: numero(r.nivel_destino, 2) }),
        ]),
      );
    reemplazar(
      cuerpo,
      crear('div', { class: 'tabla-envoltura' }, [
        crear('table', { class: 'tabla tabla--historial' }, [
          crear('thead', {}, [
            crear('tr', {}, COLUMNAS.map(([, titulo]) => crear('th', { texto: titulo }))),
          ]),
          crear('tbody', {}, filas),
        ]),
      ]),
    );
  }

  return { actualizar };
}