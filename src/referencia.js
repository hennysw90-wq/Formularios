// "De qué es" una evaluación: en las CdR es la reunión; en los formularios que se asignan por un listado
// (ej. Estándar) es el valor elegido de ese listado. Se usa para mostrar y agrupar (resultados, compromisos).
// Sin dependencias, para poder usarlo en cualquier módulo.

const normRef = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** El valor del campo asignable (ej. el estándar) de una evaluación, o "" si el formulario no se asigna por listado. */
export function valorAsignado(e) {
  const campo = (e?.formulario?.seccionA || []).find((c) => c.asignable && (c.tipo === "busqueda" || c.tipo === "seleccion"));
  return campo ? String(e?.datos?.[campo.id] || "").trim() : "";
}

/** Texto a mostrar: el estándar (u otro valor del listado) si lo hay; si no, la reunión. */
export function referenciaEval(e, siNoHay = "Sin reunión") {
  return valorAsignado(e) || e?.rutinaNombre || siNoHay;
}

/** Clave para agrupar: por valor del listado en esos formularios; por reunión en el resto (como siempre). */
export function claveReferencia(e) {
  const v = valorAsignado(e);
  return v ? `val:${normRef(v)}` : e?.rutinaSesionId || normRef(e?.rutinaNombre);
}
