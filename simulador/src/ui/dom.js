const NS = 'http://www.w3.org/2000/svg';

function aplicarPropiedades(el, props, hijos) {
  for (const [clave, valor] of Object.entries(props || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class' || clave === 'className') {
      el.setAttribute('class', valor);
    } else if (clave === 'texto') {
      el.textContent = valor;
    } else if (clave === 'html') {
      el.innerHTML = valor;
    } else if (clave === 'estilo') {
      for (const [k, v] of Object.entries(valor)) el.style.setProperty(k, v);
    } else if (clave === 'datos') {
      for (const [k, v] of Object.entries(valor)) el.dataset[k] = v;
    } else if (clave === 'on') {
      for (const [evento, fn] of Object.entries(valor)) el.addEventListener(evento, fn);
    } else if (clave === 'ref') {
      valor(el);
    } else {
      el.setAttribute(clave, valor);
    }
  }
  if (Array.isArray(hijos)) {
    for (const hijo of hijos) {
      if (hijo === null || hijo === undefined || hijo === false) continue;
      el.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
    }
  }
  return el;
}

export function crear(tag, props, hijos) {
  return aplicarPropiedades(document.createElement(tag), props, hijos);
}

export function svg(tag, props, hijos) {
  return aplicarPropiedades(document.createElementNS(NS, tag), props, hijos);
}

export function sel(selector, raiz) {
  return (raiz || document).querySelector(selector);
}

export function todos(selector, raiz) {
  return Array.from((raiz || document).querySelectorAll(selector));
}

export function vaciar(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function reemplazar(el, contenido) {
  vaciar(el);
  if (Array.isArray(contenido)) {
    for (const nodo of contenido) if (nodo) el.appendChild(nodo);
  } else if (contenido) {
    el.appendChild(contenido);
  }
  return el;
}

export function icono(nombre) {
  const rutas = {
    play: 'M5 3l12 7-12 7z',
    pausa: 'M6 3h3v14H6zm5 0h3v14h-3z',
    reinicio: 'M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z',
    flechaArriba: 'M12 4l7 7h-4v9H9v-9H5z',
    flechaAbajo: 'M12 20l-7-7h4V4h6v9h4z',
    check: 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
    cerrar: 'M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z',
    alerta: 'M12 2L1 21h22L12 2zm0 5l7.5 12.5h-15L12 7zm-1 4v4h2v-4h-2zm0 5v2h2v-2h-2z',
    rayo: 'M13 2L4 14h6l-1 8 9-12h-6z',
    descarga: 'M12 3v10l4-4 1.4 1.4L12 16.8 6.6 10.4 8 9l4 4V3zM4 19h16v2H4z',
  };
  return crear('span', {
    class: `icono icono--${nombre}`,
    ref: (el) => {
      el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${rutas[nombre] || ''}"/></svg>`;
    },
  });
}
