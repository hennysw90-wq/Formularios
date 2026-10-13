// Búsqueda de personas con la misma lógica que el panel de Administración
// de RdP y Asistencia: primero las coincidencias directas, y después los
// nombres parecidos (errores de tipeo, tildes, mayúsculas), para que no se
// escriba mal un nombre que ya existe.

export function normalizarComparacion(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

// Distancia de edición (Levenshtein), igual a la de Administración.
export function distanciaEdicion(a, b) {
  const m = a.length;
  const n = b.length;
  const fila = new Array(n + 1);
  for (let j = 0; j <= n; j++) fila[j] = j;
  for (let i = 1; i <= m; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = fila[j];
      fila[j] = a[i - 1] === b[j - 1] ? anterior : 1 + Math.min(anterior, fila[j], fila[j - 1]);
      anterior = temp;
    }
  }
  return fila[n];
}

// Sugerencias para un texto escrito a mano. Devuelve, en orden:
//   1. quienes contienen lo escrito en su nombre o en su área
//   2. quienes se escriben parecido (mismo umbral que Administración:
//      hasta 2 letras de diferencia, o un 22% del largo si es más largo)
// Con menos de 2 caracteres escritos no sugiere nada, para no volcar la
// lista completa de golpe.
export function sugerirUsuarios(texto, lista, { excluirUid, max = 8 } = {}) {
  const objetivo = normalizarComparacion(texto);
  if (objetivo.length < 2) return [];

  const candidatos = (lista || []).filter(
    (u) => u.rol !== "deshabilitado" && u.uid !== excluirUid
  );

  const directas = [];
  const parecidas = [];

  for (const u of candidatos) {
    const nombre = normalizarComparacion(u.nombreUsuario);
    const area = normalizarComparacion(u.area);

    if (nombre.includes(objetivo) || (area && area.includes(objetivo))) {
      directas.push({ u, orden: nombre.startsWith(objetivo) ? 0 : 1 });
      continue;
    }

    const largo = Math.max(objetivo.length, nombre.length);
    const dist = distanciaEdicion(objetivo, nombre);
    if (dist <= Math.max(2, Math.round(largo * 0.22))) {
      parecidas.push({ u, dist });
    }
  }

  directas.sort(
    (a, b) =>
      a.orden - b.orden ||
      (a.u.nombreUsuario || "").localeCompare(b.u.nombreUsuario || "")
  );
  parecidas.sort((a, b) => a.dist - b.dist);

  return [
    ...directas.map((x) => ({ ...x.u, parecido: false })),
    ...parecidas.map((x) => ({ ...x.u, parecido: true })),
  ].slice(0, max);
}
