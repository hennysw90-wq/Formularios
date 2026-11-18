// Ponderación y resultado de una CdR.
// Reglas: los pesos de los bloques suman 100% del total, y los pesos de los
// criterios de cada bloque suman 100% de ese bloque.

/** n partes iguales con 1 decimal que suman exactamente 100. */
export function repartirIgual(n) {
  if (n <= 0) return [];
  const q = Math.floor(1000 / n);
  const r = 1000 - q * n;
  return Array.from({ length: n }, (_, i) => (q + (i < r ? 1 : 0)) / 10);
}

/** Partes proporcionales a `cantidades`, con 1 decimal, que suman exactamente 100. */
export function repartirProporcional(cantidades) {
  const total = cantidades.reduce((a, b) => a + b, 0);
  if (total <= 0) return repartirIgual(cantidades.length);
  const exactos = cantidades.map((c) => (1000 * c) / total);
  const base = exactos.map(Math.floor);
  const resto = 1000 - base.reduce((a, b) => a + b, 0);
  const orden = exactos.map((e, i) => [e - base[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < resto; k++) base[orden[k % orden.length][1]] += 1;
  return base.map((t) => t / 10);
}

export function sumar(pesos) {
  return Math.round(pesos.reduce((a, p) => a + (Number(p) || 0), 0) * 10) / 10;
}

/** Completa un formulario antiguo o importado con la estructura vigente. */
export function normalizarFormulario(entrada) {
  const f = JSON.parse(JSON.stringify(entrada));
  f.parametros = { umbralEfectiva: 85, umbralDesarrollo: 70, ...(f.parametros || {}) };
  // Si el QR se puede abrir sin iniciar sesión (la persona elige su nombre de la lista de Asistencia).
  f.accesoSinSesion = f.accesoSinSesion !== false;
  f.seccionA = Array.isArray(f.seccionA) ? f.seccionA : [];
  f.rutinas = Array.isArray(f.rutinas) ? f.rutinas : [];
  // Cada rutina tiene una lista de líderes (antes era uno solo).
  f.rutinas.forEach((r) => {
    if (!Array.isArray(r.lideres)) r.lideres = r.lider ? [r.lider] : [];
    delete r.lider;
  });

  // Sección B: ahora son notas de terreno. Los formularios con el formato anterior
  // (datos estructurados) se convierten en "puntos a observar".
  const b = f.seccionB || {};
  if (Array.isArray(b.campos) && !Array.isArray(b.puntos)) {
    b.puntos = b.campos.map((c) => ({
      id: c.id,
      texto: [c.etiqueta, (c.valores || []).length > 1 ? `(${c.valores.join(" / ")})` : ""].filter(Boolean).join(" "),
      criterio: c.alimenta || "",
    }));
  }
  f.seccionB = { puntos: Array.isArray(b.puntos) ? b.puntos : [], horaAutomatica: b.horaAutomatica !== false };

  f.bloques = Array.isArray(f.bloques) ? f.bloques : [];
  f.bloques.forEach((bl) => (bl.criterios = Array.isArray(bl.criterios) ? bl.criterios : []));
  if (f.bloques.some((bl) => typeof bl.peso !== "number")) {
    const pesos = repartirProporcional(f.bloques.map((bl) => bl.criterios.length || 1));
    f.bloques.forEach((bl, i) => (bl.peso = pesos[i]));
  }
  f.bloques.forEach((bl) => {
    if (bl.criterios.some((c) => typeof c.peso !== "number")) {
      const p = repartirIgual(bl.criterios.length);
      bl.criterios.forEach((c, i) => (c.peso = p[i]));
    }
  });

  f.feedback = { fortalezas: true, oportunidades: true, maxPorTipo: 2, compromisoMejora: true, seguimientoAnterior: true, situacion: false, ...(f.feedback || {}) };
  return f;
}

/** Problemas de ponderación (lista vacía = todo suma 100). */
export function erroresDePesos(form) {
  const errores = [];
  const sb = sumar(form.bloques.map((b) => b.peso));
  if (form.bloques.length && sb !== 100) errores.push(`Los pesos de los bloques suman ${sb}% (deben sumar 100%).`);
  for (const b of form.bloques) {
    if (!b.criterios.length) continue;
    const sc = sumar(b.criterios.map((c) => c.peso));
    if (sc !== 100) errores.push(`En el bloque "${b.nombre}" los criterios suman ${sc}% (deben sumar 100%).`);
  }
  return errores;
}

/**
 * respuestas: { [codigoCriterio]: 2 | 1 | 0 | "NA" }
 * Un criterio N/A deja de contar y su peso se reparte entre los demás criterios del bloque.
 * Un bloque sin criterios aplicables deja de contar y su peso se reparte entre los demás bloques.
 */
export function calcularResultado(form, respuestas) {
  let sumaPesoBloques = 0;
  let acumulado = 0;
  let incompleto = false;
  const criticosEnCero = [];
  const bloques = [];

  for (const b of form.bloques) {
    let sp = 0;
    let ac = 0;
    for (const c of b.criterios) {
      const r = respuestas[c.codigo];
      if (r === undefined || r === null || r === "") {
        incompleto = true;
        continue;
      }
      if (r === "NA") continue;
      sp += Number(c.peso) || 0;
      ac += (Number(c.peso) || 0) * (Number(r) / 2);
      if (c.critico && Number(r) === 0) criticosEnCero.push(c.codigo);
    }
    const puntaje = sp > 0 ? (ac / sp) * 100 : null;
    bloques.push({ nombre: b.nombre, peso: b.peso, puntaje });
    if (puntaje !== null) {
      sumaPesoBloques += Number(b.peso) || 0;
      acumulado += (Number(b.peso) || 0) * (puntaje / 100);
    }
  }

  const indice = sumaPesoBloques > 0 ? Math.round((acumulado / sumaPesoBloques) * 1000) / 10 : 0;
  // Aporte de cada bloque al índice total (en puntos porcentuales): la suma de aportes es el índice.
  bloques.forEach((b) => {
    b.aporte = b.puntaje !== null && sumaPesoBloques > 0 ? Math.round(((Number(b.peso) || 0) * b.puntaje / sumaPesoBloques) * 10) / 10 : 0;
  });
  const { umbralEfectiva, umbralDesarrollo } = form.parametros;
  const clasificacion =
    indice >= umbralEfectiva && criticosEnCero.length === 0 ? "efectiva" : indice >= umbralDesarrollo ? "desarrollo" : "intervencion";
  return { indice, clasificacion, criticosEnCero, bloques, incompleto };
}

export const ETIQUETA_CLASIFICACION = {
  efectiva: "Rutina efectiva",
  desarrollo: "En desarrollo",
  intervencion: "Requiere intervención",
};
