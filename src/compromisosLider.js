// Compromisos de mejora vistos por quien los recibe (el líder evaluado).
// La CdR enviada queda bloqueada, así que el cierre del compromiso se guarda aparte, en "cdrCompromisos",
// un documento por CdR (mismo id que la evaluación): quién lo marcó como ejecutado, cuándo y su comentario.
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";
import { norm } from "./compromisos.js";
import { fechaCdR } from "./estadisticas.js";

const COLECCION = "cdrCompromisos";

export function listarCierres(callback, onError) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        collection(db, COLECCION),
        (snap) => callback(new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]))),
        (e) => {
          console.error("Error leyendo compromisos:", e);
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

function base(ev) {
  const c = ev.feedback?.compromiso || {};
  return {
    evaluacionId: ev.id,
    formularioId: ev.formularioId || "",
    formularioNombre: ev.formulario?.nombre || "",
    rutinaNombre: ev.rutinaNombre || "",
    lider: ev.lider || "",
    accion: c.accion || "",
    responsable: c.responsable || "",
    fecha: c.fecha || "",
  };
}

/** Guarda un comentario (avance) sin cerrar el compromiso. */
export async function comentarCompromiso(ev, usuario, comentario) {
  await asegurarSesionCdR();
  await setDoc(doc(db, COLECCION, ev.id), { ...base(ev), comentario: String(comentario || "").trim(), comentadoPor: usuario.nombreUsuario || "", comentadoFecha: new Date().toISOString() }, { merge: true });
}

/** El líder marca el compromiso como ejecutado, con un comentario. */
export async function cerrarCompromiso(ev, usuario, comentario) {
  await asegurarSesionCdR();
  await setDoc(doc(db, COLECCION, ev.id), {
    ...base(ev),
    estado: "ejecutado",
    comentario: String(comentario || "").trim(),
    cerradoPorUid: usuario.uid || "",
    cerradoPorNombre: usuario.nombreUsuario || "",
    cerradoFecha: new Date().toISOString(),
  }, { merge: true });
}

/** Vuelve a dejarlo pendiente (por si se marcó por error). */
export async function reabrirCompromiso(ev, usuario) {
  await asegurarSesionCdR();
  await setDoc(doc(db, COLECCION, ev.id), { ...base(ev), estado: "pendiente", reabiertoPor: usuario.nombreUsuario || "", reabiertoFecha: new Date().toISOString() }, { merge: true });
}

const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** CdR enviadas (no anuladas) en que esta persona fue el líder evaluado, de la más reciente a la más antigua. */
export function evaluacionesRecibidas(evals, usuario) {
  const yo = norm(usuario?.nombreUsuario);
  return (evals || [])
    .filter((e) => e.estado === "enviada" && !e.anulada && yo && norm(e.lider) === yo)
    .sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a)));
}

/**
 * Compromisos de mejora que recibió esta persona: uno por CdR con compromiso escrito.
 * estado: "ejecutado" (lo cerró el líder) · "vencido" (pasó la fecha) · "pendiente".
 */
export function compromisosRecibidos(evals, usuario, cierres) {
  const hoy = hoyLocal();
  return evaluacionesRecibidas(evals, usuario)
    .filter((e) => (e.feedback?.compromiso?.accion || "").trim())
    .map((e) => {
      const c = e.feedback.compromiso;
      const cierre = cierres?.get ? cierres.get(e.id) : null;
      const ejecutado = cierre?.estado === "ejecutado";
      return {
        ev: e,
        accion: c.accion,
        responsable: c.responsable || e.lider || "",
        fecha: c.fecha || "",
        cierre,
        estado: ejecutado ? "ejecutado" : c.fecha && c.fecha < hoy ? "vencido" : "pendiente",
      };
    })
    .sort((a, b) => (a.estado === "ejecutado") - (b.estado === "ejecutado") || (a.fecha || "9999").localeCompare(b.fecha || "9999"));
}
