// Listados reutilizables (ej. "Estándares", "Equipos") para las preguntas "Lista con búsqueda" y "Lista de opciones".
// Se guardan todos juntos en un documento especial ("__listados") de la misma colección de formularios, así no
// hace falta publicar reglas nuevas en Firebase. listarFormularios lo deja fuera de la lista de formularios.
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db, asegurarSesionCdR } from "./firebase.js";
import { COLECCION_FORMULARIOS, nuevoId } from "./formularios.js";

export const ID_DOC_LISTADOS = "__listados";

export function escucharListados(callback, onError) {
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
  useEffect(() => escucharListados(setListados, () => setListados([])), []);
  return listados;
}

export async function guardarListados(listados, usuario) {
  await asegurarSesionCdR();
  const limpios = listados.map((l) => ({
    id: l.id || nuevoId("l"),
    nombre: String(l.nombre || "").trim(),
    opciones: [...new Set((l.opciones || []).map((o) => String(o).trim()).filter(Boolean))],
    subareas: Object.fromEntries(Object.entries(l.subareas || {}).filter(([o, s]) => (l.opciones || []).includes(o) && String(s || "").trim()).map(([o, s]) => [o, String(s).trim()])),
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
  return { opciones: l ? l.opciones || [] : c?.opciones || [], subareas: l ? l.subareas || {} : c?.subareas || {} };
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
  if (frecuencia === "diaria") return dia;
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
