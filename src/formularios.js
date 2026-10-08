import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";

// ─── Constantes ────────────────────────────────────────────────────────────
export const FRECUENCIAS = [
  { valor: "diaria", etiqueta: "Diaria" },
  { valor: "semanal", etiqueta: "Semanal" },
  { valor: "quincenal", etiqueta: "Quincenal" },
  { valor: "mensual", etiqueta: "Mensual" },
  { valor: "unica", etiqueta: "Una sola vez" },
];

export const TIPOS_PREGUNTA = [
  { valor: "texto", etiqueta: "Respuesta de texto" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "si_no", etiqueta: "Sí / No" },
  { valor: "seleccion", etiqueta: "Selección (una opción)" },
  { valor: "multiple", etiqueta: "Selección múltiple" },
];

// URL base para el link del QR de respuesta
export function linkRespuesta(formularioId) {
  return `${window.location.origin}${window.location.pathname}?formulario=${formularioId}`;
}

// ─── CRUD Formularios ───────────────────────────────────────────────────────

// Escucha en tiempo real todos los formularios
export function listarFormularios(callback, onError) {
  return onSnapshot(
    collection(db, "formularios"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo formularios:", error);
      if (onError) onError(error);
    }
  );
}

export async function obtenerFormulario(id) {
  const snap = await getDoc(doc(db, "formularios", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Crea un formulario nuevo y devuelve su id
export async function crearFormulario({ titulo, descripcion, preguntas, responsables, frecuencia, fechaUnica }) {
  const ref = doc(collection(db, "formularios"));
  await setDoc(ref, {
    titulo: titulo.trim(),
    descripcion: (descripcion || "").trim(),
    preguntas: preguntas || [],
    responsables: responsables || [],
    frecuencia: frecuencia || "unica",
    fechaUnica: fechaUnica || "",
    activo: true,
    creado: new Date().toISOString(),
  });
  return ref.id;
}

export async function actualizarFormulario(id, datos) {
  await updateDoc(doc(db, "formularios", id), {
    ...datos,
    modificado: new Date().toISOString(),
  });
}

export async function eliminarFormulario(id) {
  await deleteDoc(doc(db, "formularios", id));
}

// ─── Respuestas ─────────────────────────────────────────────────────────────

// Guarda una respuesta de un formulario
export async function guardarRespuesta({ formularioId, nombreUsuario, area, respuestas }) {
  await addDoc(collection(db, "formularios", formularioId, "respuestas"), {
    nombreUsuario: nombreUsuario || "Anónimo",
    area: area || "",
    respuestas: respuestas || {},
    fecha: new Date().toISOString(),
  });
}

// Escucha las respuestas de un formulario en tiempo real
export function listarRespuestas(formularioId, callback, onError) {
  return onSnapshot(
    collection(db, "formularios", formularioId, "respuestas"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo respuestas:", error);
      if (onError) onError(error);
    }
  );
}
