const TAU = Math.PI * 2;

export function crearGenerador(semilla = 20260420) {
  let estado = semilla >>> 0;
  return function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashEntero(indice, semilla) {
  let h = Math.imul(indice ^ semilla, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function suavizar(x) {
  return x * x * (3 - 2 * x);
}

export function ruido1d(t, semilla = 1) {
  const i = Math.floor(t);
  const f = t - i;
  const a = hashEntero(i, semilla) * 2 - 1;
  const b = hashEntero(i + 1, semilla) * 2 - 1;
  return a + (b - a) * suavizar(f);
}

export function ruidoFraccionario(t, semilla = 1, octavas = 3) {
  let suma = 0;
  let amplitud = 1;
  let frecuencia = 1;
  let normalizacion = 0;
  for (let o = 0; o < octavas; o += 1) {
    suma += ruido1d(t * frecuencia, semilla + o * 7919) * amplitud;
    normalizacion += amplitud;
    amplitud *= 0.5;
    frecuencia *= 2.07;
  }
  return suma / normalizacion;
}

export function onda(t, periodo, fase = 0) {
  return Math.sin((t / periodo + fase) * TAU);
}

export function acotar(valor, minimo, maximo) {
  if (valor < minimo) return minimo;
  if (valor > maximo) return maximo;
  return valor;
}

export function interpolar(valor, desde, hasta) {
  if (hasta === desde) return 0;
  return acotar((valor - desde) / (hasta - desde), 0, 1);
}

export function suavizarRampa(valor, desde, hasta) {
  return suavizar(interpolar(valor, desde, hasta));
}

export function mezclar(a, b, factor) {
  return a + (b - a) * factor;
}
