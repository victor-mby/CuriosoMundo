export function crearRegistroEventos(limite = 600) {
  const eventos = [];
  let secuencia = 0;

  function agregar(evento) {
    secuencia += 1;
    const registro = {
      id: secuencia,
      tiempo: evento.tiempo,
      hora: new Date(evento.tiempoReal || Date.now()),
      tipo: evento.tipo || 'SISTEMA',
      equipo: evento.equipo || 'ESTACIÓN',
      severidad: evento.severidad || 'INFO',
      texto: evento.texto || '',
      estado: evento.estado || '',
    };
    eventos.unshift(registro);
    if (eventos.length > limite) eventos.length = limite;
    return registro;
  }

  function listar(filtro) {
    if (!filtro) return eventos;
    return eventos.filter((e) => {
      if (filtro.tipo && e.tipo !== filtro.tipo) return false;
      if (filtro.equipo && e.equipo !== filtro.equipo) return false;
      if (filtro.texto && !e.texto.toLowerCase().includes(filtro.texto.toLowerCase())) return false;
      return true;
    });
  }

  function tipos() {
    return Array.from(new Set(eventos.map((e) => e.tipo)));
  }

  function limpiar() {
    eventos.length = 0;
    secuencia = 0;
  }

  return { agregar, listar, tipos, limpiar, total: () => secuencia };
}

export const TIPOS_EVENTO = ['SISTEMA', 'OPERACIÓN', 'VÁLVULA', 'ALARMA', 'COMUNICACIÓN', 'CONFIG'];
