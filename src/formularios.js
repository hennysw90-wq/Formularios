// Acceso a la colección "formularios" de la base propia de la CdR.
import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";

export function nuevoId(prefijo = "f") {
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function listarFormularios(callback, onError) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        collection(db, "cdrFormularios"),
        (snap) => {
          const lista = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.actualizado || "").localeCompare(a.actualizado || ""));
          callback(lista);
        },
        (error) => {
          console.error("Error leyendo formularios:", error);
          if (onError) onError(error);
        }
      );
    })
    .catch((error) => {
      console.error("No se pudo abrir sesión en la base de la CdR:", error);
      if (onError) onError(error);
    });
  return () => {
    cancelado = true;
    apagar();
  };
}

export async function guardarFormulario(form) {
  await asegurarSesionCdR();
  // JSON ida y vuelta: Firestore no acepta valores "undefined".
  const { id, ...resto } = JSON.parse(JSON.stringify(form));
  await setDoc(doc(db, "cdrFormularios", id), resto);
}

export async function eliminarFormulario(id) {
  await asegurarSesionCdR();
  await deleteDoc(doc(db, "cdrFormularios", id));
}

export function contarCriterios(form) {
  return (form.bloques || []).reduce((n, b) => n + (b.criterios || []).length, 0);
}
