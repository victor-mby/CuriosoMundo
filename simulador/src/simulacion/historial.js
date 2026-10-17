export function crearHistorial(maximo = 7200) {
  let registros = [];
  let limite = maximo;
  let acumulado = 0;
  let anterior = null;

  function agregar(captura) {
    registros.push(captura);
    acumulado += 1;
    if (registros.length > limite) {
      registros.splice(0, registros.length - limite);
    }
    anterior = captura;
    return captura;
  }

  function intervalo(dt, intervaloMuestra) {
    if (anterior === null) {
      acumulado = 0;
      return true;
    }
    acumulado += dt;
    if (acumulado >= intervaloMuestra) {
      acumulado -= intervaloMuestra;
      return true;
    }
    return false;
  }

  function listar(limiteConsulta) {
    if (!limiteConsulta) return registros;
    return registros.slice(Math.max(0, registros.length - limiteConsulta));
  }

  function ultimo() {
    return registros.length ? registros[registros.length - 1] : null;
  }

  function porMotor(id) {
    return registros.filter((r) => r.motor_id === id);
  }

  function ventana(segundos, ahora) {
    if (!registros.length) return [];
    const limite = ahora - segundos;
    let inicio = 0;
    for (let i = registros.length - 1; i >= 0; i -= 1) {
      if (registros[i].tiempo < limite) {
        inicio = i;
        break;
      }
      inicio = i;
    }
    return registros.slice(inicio);
  }

  function estadisticas(campo, lista) {
    const datos = lista || registros;
    if (!datos.length) return { minimo: 0, maximo: 0, promedio: 0, ultimo: 0, cuenta: 0 };
    let minimo = Infinity;
    let maximo = -Infinity;
    let suma = 0;
    let cuenta = 0;
    for (const registro of datos) {
      const v = registro[campo];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      minimo = Math.min(minimo, v);
      maximo = Math.max(maximo, v);
      suma += v;
      cuenta += 1;
    }
    if (cuenta === 0) return { minimo: 0, maximo: 0, promedio: 0, ultimo: 0, cuenta: 0 };
    return {
      minimo,
      maximo,
      promedio: suma / cuenta,
      ultimo: datos[datos.length - 1][campo],
      cuenta,
    };
  }

  function limpiar() {
    registros = [];
    acumulado = 0;
    anterior = null;
  }

  function fijarLimite(nuevo) {
    limite = Math.max(50, nuevo);
    if (registros.length > limite) registros.splice(0, registros.length - limite);
  }

  return {
    agregar,
    intervalo,
    listar,
    ultimo,
    porMotor,
    ventana,
    estadisticas,
    limpiar,
    fijarLimite,
    total: () => registros.length,
    capacidad: () => limite,
  };
}

const COLUMNAS = [
  { clave: 'fecha', titulo: 'Fecha' },
  { clave: 'hora', titulo: 'Hora' },
  { clave: 'tiempo_simulacion', titulo: 'Tiempo simulación' },
  { clave: 'motor_id', titulo: 'Motor' },
  { clave: 'nivel', titulo: 'Nivel (m)' },
  { clave: 'nivel_porcentaje', titulo: 'Nivel (%)' },
  { clave: 'voltaje', titulo: 'Voltaje (V)' },
  { clave: 'amperaje', titulo: 'Amperaje (A)' },
  { clave: 'caudal', titulo: 'Caudal (L/s)' },
  { clave: 'potencia', titulo: 'Potencia (kW)' },
  { clave: 'estado_motor', titulo: 'Estado motor' },
  { clave: 'estado_valvula', titulo: 'Estado válvula' },
  { clave: 'caudal_total', titulo: 'Caudal total (L/s)' },
  { clave: 'potencia_total', titulo: 'Potencia total (kW)' },
  { clave: 'nivel_destino', titulo: 'Nivel destino (m)' },
  { clave: 'demanda', titulo: 'Demanda (L/s)' },
];

function celda(registro, clave) {
  const valor = registro[clave];
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return Number.isInteger(valor) ? String(valor) : valor.toFixed(3);
  return String(valor).replace(/[\r\n]+/g, ' ');
}

function escapar(valor) {
  const texto = String(valor);
  if (/[";\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function construirCSV(registros) {
  const cabecera = COLUMNAS.map((c) => c.titulo).join(',');
  const filas = registros.map((registro) => COLUMNAS.map((c) => escapar(celda(registro, c.clave))).join(','));
  return [cabecera, ...filas].join('\r\n');
}

export const COLUMNAS_CSV = COLUMNAS;

export function descargarCSV(nombre, contenido) {
  const marca = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const archivo = `${nombre}_${marca.getFullYear()}${p(marca.getMonth() + 1)}${p(marca.getDate())}_${p(marca.getHours())}${p(marca.getMinutes())}${p(marca.getSeconds())}.csv`;
  const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return archivo;
}
