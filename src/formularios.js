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
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";

// ─── Frecuencias de asignación ──────────────────────────────────────────────
// Cada asignación dentro de un formulario dice: tal reunión, tales personas,
// tantas veces (cantidad) por tal periodo (frecuencia).
export const FRECUENCIAS = [
  { valor: "diaria", etiqueta: "Al día" },
  { valor: "semanal", etiqueta: "A la semana" },
  { valor: "quincenal", etiqueta: "A la quincena" },
  { valor: "mensual", etiqueta: "Al mes" },
  { valor: "unica", etiqueta: "Una sola vez" },
];

export function etiquetaFrecuencia(valor) {
  return FRECUENCIAS.find((f) => f.valor === valor)?.etiqueta || valor;
}

// Texto legible de una asignación: "2 veces a la semana", "1 vez al día".
export function etiquetaCadencia(cantidad, frecuencia) {
  const n = Number(cantidad) || 1;
  const veces = n === 1 ? "1 vez" : `${n} veces`;
  if (frecuencia === "unica") return n === 1 ? "Una sola vez" : `${veces} en total`;
  return `${veces} ${etiquetaFrecuencia(frecuencia).toLowerCase()}`;
}

// ─── Periodo vigente ────────────────────────────────────────────────────────
// Clave del periodo actual según la frecuencia. Las respuestas se cuentan
// contra esta clave, así "2 veces a la semana" se reinicia cada semana.

function claveSemana(fecha) {
  // Semana ISO: lunes como primer día.
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export function periodoVigente(frecuencia, ahora = new Date()) {
  const a = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  if (frecuencia === "diaria") return `${a}-${m}-${d}`;
  if (frecuencia === "semanal") return claveSemana(ahora);
  if (frecuencia === "quincenal") {
    // Dos quincenas por mes: días 1–15 y 16 en adelante.
    return `${a}-${m}-Q${ahora.getDate() <= 15 ? 1 : 2}`;
  }
  if (frecuencia === "mensual") return `${a}-${m}`;
  return "unica";
}

// ─── Tipos de pregunta ──────────────────────────────────────────────────────
export const TIPOS_PREGUNTA = [
  { valor: "texto", etiqueta: "Texto corto" },
  { valor: "parrafo", etiqueta: "Texto largo" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "si_no", etiqueta: "Sí / No" },
  { valor: "seleccion", etiqueta: "Alternativas (una)" },
  { valor: "multiple", etiqueta: "Alternativas (varias)" },
  { valor: "escala", etiqueta: "Escala 1 a 5" },
  { valor: "fecha", etiqueta: "Fecha" },
  { valor: "hora", etiqueta: "Hora" },
  { valor: "imagen", etiqueta: "Foto / imagen" },
];

export function necesitaOpciones(tipo) {
  return tipo === "seleccion" || tipo === "multiple";
}

export function etiquetaTipoPregunta(tipo) {
  return TIPOS_PREGUNTA.find((t) => t.valor === tipo)?.etiqueta || tipo;
}

// URL del QR: uno solo por formulario. Al abrirlo, la persona se identifica
// y ve sus asignaciones pendientes del periodo.
export function linkRespuesta(formularioId) {
  return `${window.location.origin}${window.location.pathname}?formulario=${formularioId}`;
}

// ─── CRUD Formularios ───────────────────────────────────────────────────────

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

// datos.asignaciones: [{ id, reunionId, reunionNombre, personas: [{uid,nombre}],
//                        cantidad, frecuencia }]
export async function crearFormulario(datos) {
  const ref = doc(collection(db, "formularios"));
  await setDoc(ref, {
    titulo: (datos.titulo || "").trim(),
    descripcion: (datos.descripcion || "").trim(),
    preguntas: datos.preguntas || [],
    asignaciones: datos.asignaciones || [],
    destinatario: datos.destinatario || DESTINATARIO_POR_DEFECTO,
    activo: true,
    creado: new Date().toISOString(),
  });
  return ref.id;
}

// Campo "destinatario": a quién va dirigido el formulario que la persona
// está ejecutando (el líder de la sesión, el supervisor de la actividad,
// etc.). La etiqueta la define quien arma el formulario; al responder se
// elige de los usuarios registrados, menos uno mismo.
export const DESTINATARIO_POR_DEFECTO = {
  activo: true,
  etiqueta: "Destinatario",
  obligatorio: true,
};

export function configDestinatario(formulario) {
  const d = formulario?.destinatario;
  if (!d) return { ...DESTINATARIO_POR_DEFECTO, activo: false };
  return {
    activo: d.activo !== false,
    etiqueta: (d.etiqueta || "").trim() || "Destinatario",
    obligatorio: d.obligatorio !== false,
  };
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

// Cada respuesta queda amarrada a la asignación, la reunión y el periodo en
// que se ejecutó, para poder contar cuántas lleva la persona en el periodo.
export async function guardarRespuesta({
  formularioId,
  asignacionId,
  reunionId,
  reunionNombre,
  periodo,
  personaUid,
  nombreUsuario,
  area,
  destinatario,
  respuestas,
}) {
  await addDoc(collection(db, "formularios", formularioId, "respuestas"), {
    asignacionId: asignacionId || "",
    reunionId: reunionId || "",
    reunionNombre: reunionNombre || "",
    periodo: periodo || "",
    personaUid: personaUid || "",
    nombreUsuario: nombreUsuario || "Anónimo",
    area: area || "",
    destinatario: destinatario || null, // { uid, nombre, area }
    respuestas: respuestas || {},
    fecha: new Date().toISOString(),
  });
}

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

// Respuestas que una persona ya entregó para este formulario, usadas para
// saber cuántas lleva en el periodo vigente de cada asignación.
export async function respuestasDePersona(formularioId, personaUid) {
  const col = collection(db, "formularios", formularioId, "respuestas");
  const snap = await getDocs(query(col, where("personaUid", "==", personaUid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Arma la agenda que ve la persona al leer el QR: una tarjeta por cada
// asignación donde está incluida, con cuántas lleva y cuántas le faltan en
// el periodo vigente.
export function agendaDePersona(formulario, personaUid, respuestas) {
  const hechas = respuestas || [];
  return (formulario.asignaciones || [])
    .filter((a) => (a.personas || []).some((p) => p.uid === personaUid))
    .map((a) => {
      const periodo = periodoVigente(a.frecuencia);
      const yaHechas = hechas.filter(
        (r) => r.asignacionId === a.id && r.periodo === periodo
      ).length;
      const total = Number(a.cantidad) || 1;
      return {
        asignacion: a,
        periodo,
        hechas: yaHechas,
        total,
        pendientes: Math.max(0, total - yaHechas),
        completa: yaHechas >= total,
      };
    });
}
