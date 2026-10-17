const locales = { es: 'es-ES' };

function seguro(valor, respaldo) {
  return Number.isFinite(valor) ? valor : respaldo;
}

export function numero(valor, decimales = 1) {
  const v = seguro(valor, 0);
  return v.toLocaleString(locales.es, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function entero(valor) {
  return Math.round(seguro(valor, 0)).toLocaleString(locales.es);
}

export function porcentaje(valor, decimales = 0) {
  return `${numero(seguro(valor, 0) * 100, decimales)} %`;
}

export function hora(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleTimeString(locales.es, { hour12: false });
}

export function horaSegundos(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleTimeString(locales.es, { hour12: false });
}

export function fecha(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleDateString(locales.es);
}

export function fechaHora(fecha) {
  return `${fecha(fecha)} ${hora(fecha)}`;
}

export function selloTemporal(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function duracion(segundos) {
  const total = Math.max(0, Math.floor(seguro(segundos, 0)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export function duracionHoras(segundos) {
  return numero(seguro(segundos, 0) / 3600, 2);
}

export function bytesLegibles(bytes) {
  const b = seguro(bytes, 0);
  if (b < 1024) return `${entero(b)} B`;
  if (b < 1024 * 1024) return `${numero(b / 1024, 1)} KB`;
  return `${numero(b / (1024 * 1024), 2)} MB`;
}

export function claseEstado(estado) {
  return `estado-${String(estado || 'DESCONOCIDO').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
}
