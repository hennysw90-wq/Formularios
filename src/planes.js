// Planes de los evaluadores. Se guardan en la colección "asignaciones" (ya permitida en las reglas de Firestore),
// un documento por persona: asignaciones/plan_<uid>.
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";

const idPlan = (uid) => `plan_${uid}`;

function escuchar(crear, alRecibir, onError) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(crear(), alRecibir, (e) => {
        console.error("Error leyendo planes:", e);
        if (onError) onError(e);
      });
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

/** El plan de una persona (o null si no tiene). */
export function escucharPlan(uid, callback, onError) {
  return escuchar(() => doc(db, "cdrAsignaciones", idPlan(uid)), (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

/** Todos los planes (para Excelencia). */
export function listarPlanes(callback, onError) {
  return escuchar(
    () => query(collection(db, "cdrAsignaciones"), where("tipo", "==", "plan")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}

export async function guardarPlan({ uid, nombre, metaMensual, rutinas, actualizadoPor }) {
  await asegurarSesionCdR();
  await setDoc(doc(db, "cdrAsignaciones", idPlan(uid)), {
    tipo: "plan",
    uid,
    nombre,
    metaMensual: Math.max(0, Math.floor(Number(metaMensual)) || 0),
    rutinas: (rutinas || []).map((r) => ({ sesionId: r.sesionId || "", nombre: r.nombre })),
    actualizado: new Date().toISOString(),
    actualizadoPor: actualizadoPor || "",
  });
}

export async function quitarPlan(uid) {
  await asegurarSesionCdR();
  await deleteDoc(doc(db, "cdrAsignaciones", idPlan(uid)));
}
