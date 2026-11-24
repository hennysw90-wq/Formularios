// Listados reutilizables (ej. "Estándares", "Equipos") para las preguntas "Lista con búsqueda" y "Lista de opciones".
// Se guardan todos juntos en un documento especial ("__listados") de la misma colección de formularios, así no
// hace falta publicar reglas nuevas en Firebase. listarFormularios lo deja fuera de la lista de formularios.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, asegurarSesionCdR } from "./firebase.js";
import { COLECCION_FORMULARIOS, nuevoId } from "./formularios.js";
import { escucharListadoPortalEO } from "./firebasePortalEO.js";
import { escucharCompartido } from "./compartir.js";

export const ID_DOC_LISTADOS = "__listados";

export function escucharListados(callback, onError) {
  return escucharCompartido("listados", (ok, mal) => abrirListados(ok, mal), callback, onError);
}
function abrirListados(callback, onError) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        doc(db, COLECCION_FORMULARIOS, ID_DOC_LISTADOS),
        (snap) => callback(Array.isArray(snap.data()?.listados) ? snap.data().listados : []),
        (e) => {
          console.error("Error leyendo listados:", e);
          if (onError) onError(e);
        }
      );
    })
    .catch((e) => onError && onError(e));
  return () => {
    cancelado = true;
    apagar();
  };
}

/** Los listados vigentes (null mientras cargan). */
export function useListados() {
  const [listados, setListados] = useState(null);
  // Listado sincronizado (solo lectura) con los estándares del Portal EO; se agrega al final si se pudo leer.
  const [portal, setPortal] = useState(null);
  useEffect(() => escucharListados(setListados, () => setListados([])), []);
  useEffect(() => escucharListadoPortalEO(setPortal, () => setPortal({ error: true })), []);
  if (listados === null) return null;
  return portal && !portal.error ? [...listados, portal] : listados;
}

/** ¿Se pudo leer el Portal EO? (para avisarlo en Administración) */
export function useEstadoPortalEO() {
  const [estado, setEstado] = useState("cargando");
  useEffect(() => escucharListadoPortalEO(() => setEstado("ok"), () => setEstado("error")), []);
  return estado;
}

export async function guardarListados(listados, usuario) {
  await asegurarSesionCdR();
  // Los listados sincronizados (Portal EO) no se guardan aquí: se editan en su origen.
  const limpios = listados.filter((l) => !l.sincronizado).map((l) => ({
    id: l.id || nuevoId("l"),
    nombre: String(l.nombre || "").trim(),
    opciones: [...new Set((l.opciones || []).map((o) => String(o).trim()).filter(Boolean))],
    subareas: Object.fromEntries(Object.entries(l.subareas || {}).filter(([o, s]) => (l.opciones || []).includes(o) && String(s || "").trim()).map(([o, s]) => [o, String(s).trim()])),
    // Listado en forma de tabla (Área · Nombre · Líderes): cada opción es «Área: Nombre» y puede tener uno o varios líderes.
    tabla: !!l.tabla,
    lideres: Object.fromEntries(Object.entries(l.lideres || {}).filter(([o, v]) => (l.opciones || []).includes(o) && Array.isArray(v) && v.some((x) => String(x || "").trim())).map(([o, v]) => [o, [...new Set(v.map((x) => String(x).trim()).filter(Boolean))]])),
  }));
  await setDoc(doc(db, COLECCION_FORMULARIOS, ID_DOC_LISTADOS), {
    listados: limpios,
    actualizado: new Date().toISOString(),
    actualizadoPor: usuario?.nombreUsuario || "",
  });
}

/** Opciones de una pregunta: las de su listado si tiene uno elegido; si no, las propias. */
export function opcionesDePregunta(c, listados) {
  const l = c?.listadoId ? (listados || []).find((x) => x.id === c.listadoId) : null;
  // Si el listado ya no existe (o el formulario viene de otro ambiente), se usa la copia guardada en la pregunta.
  return l ? l.opciones || [] : c?.opciones || [];
}

/** Formularios (no el documento de listados) que usan cada listado: { [listadoId]: ["Formulario A", …] }. */
export function usosDeListados(formularios) {
  const usos = {};
  (formularios || []).forEach((f) =>
    (f.seccionA || []).forEach((c) => {
      if (c.listadoId) (usos[c.listadoId] = usos[c.listadoId] || new Set()).add(f.nombre || "Sin nombre");
    })
  );
  return Object.fromEntries(Object.entries(usos).map(([k, v]) => [k, [...v]]));
}

// ---------- Asignar un formulario por un campo (ej. Estándar) en vez de por reunión ----------
// Una pregunta de lista marcada "asignable" hace que el Plan de evaluadores asigne el formulario por sus valores.
// La asignación se guarda con reunionId = "lst:<valor>" (así el resto de la app la trata como una "reunión").
export const PREFIJO_VALOR = "lst:";
export const campoAsignable = (form) => (form?.seccionA || []).find((c) => c.asignable && (c.tipo === "busqueda" || c.tipo === "seleccion")) || null;
export const esAsignacionPorValor = (idReunion) => String(idReunion || "").startsWith(PREFIJO_VALOR);

// ---------- Sub áreas de las opciones y alcance por evaluador ----------
// Cada listado puede tener { subareas: { "<opción>": "<sub área>" } }. En el texto de Administración se escribe
// una opción por línea, y la sub área después de " | " (ej. "EST-01 Bloqueo y etiquetado | Eléctrica").
export function lineasDeListado(l) {
  return (l?.opciones || []).map((o) => (l?.subareas?.[o] ? `${o} | ${l.subareas[o]}` : o));
}
export function parsearLineasListado(texto) {
  const opciones = [];
  const subareas = {};
  String(texto || "")
    .split(/\r?\n/)
    .forEach((linea) => {
      const i = linea.lastIndexOf("|");
      const op = (i >= 0 ? linea.slice(0, i) : linea).trim();
      const sa = i >= 0 ? linea.slice(i + 1).trim() : "";
      if (!op || opciones.includes(op)) return;
      opciones.push(op);
      if (sa) subareas[op] = sa;
    });
  return { opciones, subareas };
}

/** Opciones y sub áreas de una pregunta (de su listado, o la copia guardada en la pregunta). */
export function datosDePregunta(c, listados) {
  const l = c?.listadoId ? (listados || []).find((x) => x.id === c.listadoId) : null;
  return { opciones: l ? l.opciones || [] : c?.opciones || [], subareas: l ? l.subareas || {} : c?.subareas || {}, lideres: l ? l.lideres || {} : c?.lideres || {}, tabla: l ? !!l.tabla || Object.values(l.subareas || {}).some(Boolean) || Object.values(l.lideres || {}).some((x) => x && x.length) : !!c?.tabla };
}

// ---------- Listados en forma de tabla: Área · Nombre (ej. patio) · Líderes ----------
// La opción se sigue guardando como texto «Área: Nombre» (así no cambian las asignaciones ya hechas); el área es además su sub área.
export function separarAreaNombre(opcion, subareas = {}) {
  const o = String(opcion || "");
  const sa = subareas[o];
  if (sa && o.startsWith(`${sa}: `)) return { area: sa, nombre: o.slice(sa.length + 2) };
  if (sa) return { area: sa, nombre: o };
  const i = o.indexOf(": ");
  return i > 0 ? { area: o.slice(0, i).trim(), nombre: o.slice(i + 2).trim() } : { area: "", nombre: o };
}
export const unirAreaNombre = (area, nombre) => (String(area || "").trim() ? `${String(area).trim()}: ${String(nombre || "").trim()}` : String(nombre || "").trim());
/** Filas { area, nombre, lideres, opcion } de un listado (para mostrarlo/editarlo como tabla). */
export function filasDeListado(datos) {
  return (datos?.opciones || []).map((o) => ({ ...separarAreaNombre(o, datos?.subareas), lideres: datos?.lideres?.[o] || [], opcion: o }));
}
export function subareasDe(datos) {
  return [...new Set(Object.values(datos?.subareas || {}).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

/** Las opciones que cubre un alcance { opciones: [...], subareas: [...] }. Sin alcance = todas. */
export function opcionesDelAlcance(alcance, datos) {
  const todas = datos?.opciones || [];
  if (!alcance || (!(alcance.opciones || []).length && !(alcance.subareas || []).length)) return todas;
  const sa = new Set(alcance.subareas || []);
  const op = new Set(alcance.opciones || []);
  return todas.filter((o) => op.has(o) || sa.has(datos?.subareas?.[o]));
}
export function textoAlcance(alcance) {
  const partes = [...(alcance?.subareas || []).map((s) => `Sub área ${s}`), ...(alcance?.opciones || [])];
  return partes.join(" · ");
}

// Asignación por listado con alcance por evaluador: reunionId = "lst:@<id de la asignación>".
export const esAsignacionPorAlcance = (idReunion) => String(idReunion || "").startsWith(PREFIJO_VALOR + "@");

// ---------- Qué opción le toca a un evaluador en cada periodo (al azar, pero fijo) ----------
// Se baraja el alcance de la persona con una semilla fija (asignación + persona) y se recorre periodo a periodo:
// así cada periodo le toca una opción distinta, todas salen antes de repetir y el resultado no cambia al recargar.
function semilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}
function barajar(lista, clave) {
  let s = semilla(clave) || 1;
  const azar = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)), ((s ^= s >>> 16) >>> 0) / 4294967296);
  const a = [...lista].sort((x, y) => x.localeCompare(y, "es"));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Número correlativo del periodo (para ir rotando): días, semanas, quincenas o meses desde 2020. */
export function numeroDePeriodo(frecuencia, fecha = new Date()) {
  const dia = Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86400000);
  const meses = (fecha.getFullYear() - 2020) * 12 + fecha.getMonth();
  if (frecuencia === "diaria" || frecuencia === "programada") return dia;
  if (frecuencia === "semanal") return Math.floor((dia + 3) / 7); // semanas que parten el lunes
  if (frecuencia === "quincenal") return meses * 2 + (fecha.getDate() <= 15 ? 0 : 1);
  if (frecuencia === "mensual") return meses;
  return 0;
}
/** Las opciones que le tocan a la persona en el periodo de `fecha` (tantas como su cantidad, sin repetir). */
export function opcionesQueTocan({ asignacionId, persona, alcance, datos, frecuencia = "semanal", cantidad = 1, fecha = new Date() }) {
  const cubre = opcionesDelAlcance(alcance, datos);
  if (!cubre.length) return [];
  const orden = barajar(cubre, `${asignacionId}|${persona?.uid || persona?.nombre || ""}`);
  const n = Math.max(1, Math.min(Number(cantidad) || 1, orden.length));
  const base = numeroDePeriodo(frecuencia, fecha) * n;
  return Array.from({ length: n }, (_, k) => orden[(base + k) % orden.length]);
}
