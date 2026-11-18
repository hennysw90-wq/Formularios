// Escuchas compartidas: varias pantallas que piden lo mismo (ej. todas las evaluaciones enviadas, las asignaciones)
// usan UNA sola conexión a Firestore y reciben el último resultado al instante. Antes cada pantalla abría la suya y
// descargaba todo de nuevo (más lento, sobre todo en el celular y con fotos).
const hubs = new Map();

/**
 * @param clave   identifica la consulta (ej. "enviadas")
 * @param abrir   (emitir, fallar) => apagar — abre la escucha real (onSnapshot)
 */
export function escucharCompartido(clave, abrir, callback, onError) {
  let h = hubs.get(clave);
  if (!h) {
    h = { subs: new Set(), valor: undefined, error: null, apagar: null, timer: null };
    hubs.set(clave, h);
  }
  if (h.timer) {
    clearTimeout(h.timer);
    h.timer = null;
  }
  const sub = { callback, onError };
  h.subs.add(sub);
  if (!h.apagar) {
    h.apagar = abrir(
      (valor) => {
        h.valor = valor;
        h.error = null;
        h.subs.forEach((s) => s.callback(valor));
      },
      (e) => {
        h.error = e;
        h.subs.forEach((s) => s.onError && s.onError(e));
      }
    );
  } else if (h.valor !== undefined) {
    // Ya hay datos: se entregan de inmediato (sin volver a descargar).
    Promise.resolve().then(() => h.subs.has(sub) && callback(h.valor));
  } else if (h.error && onError) {
    Promise.resolve().then(() => onError(h.error));
  }
  return () => {
    h.subs.delete(sub);
    if (h.subs.size === 0 && !h.timer) {
      // Se mantiene abierta un rato por si otra pantalla la pide al navegar.
      h.timer = setTimeout(() => {
        h.timer = null;
        if (h.subs.size === 0 && h.apagar) {
          h.apagar();
          h.apagar = null;
          h.valor = undefined;
        }
      }, 60000);
    }
  };
}

/** Último valor recibido de una escucha compartida que sigue abierta (o undefined). */
export function valorCompartido(clave) {
  const h = hubs.get(clave);
  return h && h.apagar ? h.valor : undefined;
}
