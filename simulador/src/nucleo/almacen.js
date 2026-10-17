export function crearAlmacen(estadoInicial) {
  let estado = estadoInicial;
  const canales = new Map();
  const globales = new Set();

  function obtener() {
    return estado;
  }

  function establecer(parcial) {
    estado = typeof parcial === 'function' ? parcial(estado) : { ...estado, ...parcial };
    return estado;
  }

  function reemplazar(nuevo) {
    estado = nuevo;
    return estado;
  }

  function suscribir(canal, fn) {
    if (canal === '*') {
      globales.add(fn);
      return () => globales.delete(fn);
    }
    if (!canales.has(canal)) canales.set(canal, new Set());
    canales.get(canal).add(fn);
    return () => canales.get(canal).delete(fn);
  }

  function notificar(canal, carga) {
    const especificos = canales.get(canal);
    if (especificos) {
      for (const fn of especificos) fn(carga, canal);
    }
    for (const fn of globales) fn(carga, canal);
  }

  return { obtener, establecer, reemplazar, suscribir, notificar };
}

export function crearBus() {
  const escuchas = new Map();

  function on(evento, fn) {
    if (!escuchas.has(evento)) escuchas.set(evento, new Set());
    escuchas.get(evento).add(fn);
    return () => off(evento, fn);
  }

  function off(evento, fn) {
    const set = escuchas.get(evento);
    if (set) set.delete(fn);
  }

  function emit(evento, carga) {
    const set = escuchas.get(evento);
    if (!set) return;
    for (const fn of Array.from(set)) fn(carga);
  }

  function una(evento, fn) {
    const envoltorio = (carga) => {
      off(evento, envoltorio);
      fn(carga);
    };
    return on(evento, envoltorio);
  }

  return { on, off, emit, una };
}
