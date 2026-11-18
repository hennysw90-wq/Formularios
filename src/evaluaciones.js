// Acceso a "formularios publicados" y "evaluaciones" en la base propia de la CdR.
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";
import { elegirCompromisoAnterior } from "./compromisos.js";
import { valorAsignado } from "./referencia.js";
import { escucharCompartido } from "./compartir.js";

function escuchar(consulta, callback, onError, etiqueta) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        consulta(),
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => {
          console.error(`Error leyendo ${etiqueta}:`, e);
          if (onError) onError(e);
        }
      );
    })
    .catch((e) => {
      console.error("No se pudo abrir sesión en la base de la CdR:", e);
      if (onError) onError(e);
    });
  return () => {
    cancelado = true;
    apagar();
  };
}

export function listarFormulariosPublicados(callback, onError) {
  return escucharCompartido("formulariosPublicados", (ok, mal) => escuchar(() => query(collection(db, "cdrFormularios"), where("estado", "==", "publicado")), ok, mal, "formularios"), callback, onError);
}

/**
 * Las CdR que registró esta persona (registradoPorUid) más aquellas donde figura como evaluador
 * (evaluadorUid). Las CdR antiguas no tienen registradoPorUid y se encuentran por evaluadorUid.
 */
export function listarMisEvaluaciones(uid, callback, onError) {
  const registradas = new Map();
  const comoEvaluador = new Map();
  const emitir = () => callback([...new Map([...registradas, ...comoEvaluador]).values()]);
  const llenar = (mapa) => (lista) => {
    mapa.clear();
    lista.forEach((e) => mapa.set(e.id, e));
    emitir();
  };
  const c1 = escuchar(() => query(collection(db, "cdrEvaluaciones"), where("registradoPorUid", "==", uid)), llenar(registradas), onError, "evaluaciones");
  const c2 = escuchar(() => query(collection(db, "cdrEvaluaciones"), where("evaluadorUid", "==", uid)), llenar(comoEvaluador), onError, "evaluaciones");
  return () => {
    c1();
    c2();
  };
}

export async function guardarEvaluacion(ev) {
  await asegurarSesionCdR();
  const { id, ...resto } = JSON.parse(JSON.stringify(ev)); // sin valores "undefined"
  try {
    await setDoc(doc(db, "cdrEvaluaciones", id), resto);
  } catch (e) {
    // Sin sesión (o vencida): se renueva y se reintenta una vez antes de avisar el error.
    if (e?.code !== "permission-denied" && e?.code !== "unauthenticated") throw e;
    await asegurarSesionCdR({ renovar: true });
    await setDoc(doc(db, "cdrEvaluaciones", id), resto);
  }
}

/**
 * Compromiso que `actual.evaluador` acordó con `actual.lider` en su última CdR enviada de esta rutina
 * (para hacerle seguimiento). No devuelve compromisos de otros evaluadores ni de CdR anuladas.
 */
export async function buscarCompromisoAnterior(actual) {
  await asegurarSesionCdR();
  // Dónde buscar (pestaña E del formulario): "" = cualquier formulario de la misma reunión (como siempre);
  // "__mismo" = este mismo formulario (misma reunión o mismo valor asignado); otro id = ese formulario.
  const origen = actual.seguimientoFormularioId || "";
  if (!origen) {
    const snap = await getDocs(query(collection(db, "cdrEvaluaciones"), where("rutinaSesionId", "==", actual.rutinaSesionId)));
    return elegirCompromisoAnterior(snap.docs.map((d) => ({ id: d.id, ...d.data() })), actual);
  }
  const formId = origen === "__mismo" ? actual.formularioId : origen;
  const snap = await getDocs(query(collection(db, "cdrEvaluaciones"), where("formularioId", "==", formId)));
  let evs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (origen === "__mismo") evs = evs.filter((e) => e.rutinaSesionId === actual.rutinaSesionId);
  // De otro formulario: el líder solo se exige si esta evaluación tiene líder.
  return elegirCompromisoAnterior(evs, actual, { exigirLider: origen === "__mismo" || !!String(actual.lider || "").trim() });
}

/**
 * La CdR enviada más reciente de un líder con este formulario (cualquier reunión y cualquier evaluador),
 * para mostrar su última oportunidad de mejora y su compromiso al empezar una nueva.
 */
export async function buscarUltimaDelLider({ id, formularioId, lider, valor = "" }) {
  const nl = normLider(lider);
  if (!formularioId || !nl) return null;
  await asegurarSesionCdR();
  const snap = await getDocs(query(collection(db, "cdrEvaluaciones"), where("formularioId", "==", formularioId)));
  const lista = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.estado === "enviada" && !e.anulada && e.id !== id && normLider(e.lider) === nl && (!valor || normLider(valorAsignado(e)) === normLider(valor)))
    .sort((a, b) => (b.fechaEnvio || "").localeCompare(a.fechaEnvio || ""));
  return lista[0] || null;
}
const normLider = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Un formulario por su id (para la pantalla a la que llega quien escanea el QR). */
/** ¿Cuántas evaluaciones (enviadas o en curso) tiene este formulario? Sirve para saber si ya está en uso. */
export async function contarEvaluacionesDeFormulario(formularioId) {
  await asegurarSesionCdR();
  const snap = await getDocs(query(collection(db, "cdrEvaluaciones"), where("formularioId", "==", formularioId)));
  return snap.size;
}

export async function obtenerFormulario(id) {
  await asegurarSesionCdR();
  const snap = await getDoc(doc(db, "cdrFormularios", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Una evaluación por su id (para retomar un borrador iniciado desde el QR sin sesión). */
export async function obtenerEvaluacion(id) {
  await asegurarSesionCdR();
  const snap = await getDoc(doc(db, "cdrEvaluaciones", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Elimina una CdR para siempre (solo el Master, después de confirmar su clave). No se puede deshacer. */
export async function eliminarEvaluacion(id) {
  await asegurarSesionCdR();
  await deleteDoc(doc(db, "cdrEvaluaciones", id));
}

/** Todas las CdR enviadas (para Excelencia Operacional: registros y estadísticas). */
export function listarEvaluacionesEnviadas(callback, onError) {
  // Una sola escucha para toda la app (inicio, estadísticas, agenda, QR, avance del plan…).
  return escucharCompartido("enviadas", (ok, mal) => escuchar(() => query(collection(db, "cdrEvaluaciones"), where("estado", "==", "enviada")), ok, mal, "evaluaciones"), callback, onError);
}

/**
 * Una CdR enviada no se puede editar, pero sí marcarse como anulada (p. ej. una prueba): deja de contar en
 * las estadísticas y se puede restaurar. Solo cambia estos tres campos (las reglas no permiten otros).
 */
export async function anularEvaluacion(id, motivo) {
  await asegurarSesionCdR();
  await updateDoc(doc(db, "cdrEvaluaciones", id), { anulada: true, anuladaMotivo: motivo || "", anuladaFecha: new Date().toISOString() });
}

export async function restaurarEvaluacion(id) {
  await asegurarSesionCdR();
  await updateDoc(doc(db, "cdrEvaluaciones", id), { anulada: false, anuladaMotivo: "", anuladaFecha: "" });
}

/**
 * CdR enviadas desde una fecha en adelante (por ejemplo, los últimos meses para el resumen del plan).
 * Solo las CdR enviadas tienen "fechaEnvio", así que los borradores no aparecen. Una sola condición de rango
 * no necesita índice especial.
 */
export function listarEvaluacionesDesde(desdeIso, callback, onError) {
  // Usa la misma escucha compartida de las enviadas y filtra por fecha aquí (las enviadas son las que tienen fechaEnvio).
  return listarEvaluacionesEnviadas((lista) => callback(lista.filter((e) => (e.fechaEnvio || "") >= desdeIso)), onError);
}
