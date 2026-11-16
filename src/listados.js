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
