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

/**
 * Nombre a mostrar de un dato de A · Datos generales. Si el formulario personalizó «Quién recibe la evaluación» o
 * «Qué se evalúa» (pestaña General), los campos automáticos de líder y de reunión usan esos nombres.
 */
export function etiquetaCampo(c, form) {
  const may = (t) => String(t || "").trim().replace(/^./, (x) => x.toUpperCase());
  if (c?.tipo === "lider" && String(form?.receptor || "").trim()) return may(form.receptor);
  if (c?.tipo === "rutina" && String(form?.objeto || "").trim()) return may(form.objeto);
  return c?.etiqueta || "";
}

/** Sigla de un formulario (CdR, CdE…): la definida en General, la del inicio del nombre o, si no, CdR / evaluación. */
export function siglaDe(f) {
  const s = String(f?.sigla || "").trim() || (String(f?.nombre || "").trim().match(/^(C[a-z][A-Z])\b/) || [])[1];
  if (s) return s;
  return (f?.seccionA || []).some((c) => c.asignable) ? "evaluación" : (f?.seccionA || []).some((c) => c.tipo === "lider") ? "CdR" : "evaluación";
}
/** Plural para contar: "3 CdE", "3 evaluaciones". */
export const pluralSigla = (f) => (siglaDe(f) === "evaluación" ? "evaluaciones" : siglaDe(f));
