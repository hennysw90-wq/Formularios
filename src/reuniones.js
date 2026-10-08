import { collection, onSnapshot } from "firebase/firestore";
import { dbAsistencia as db } from "./firebaseAsistencia.js";

// Trae el listado de reuniones y actividades creadas en Asistencia QR.
// Es solo lectura: aquí nunca se crean ni se modifican, únicamente se
// eligen para asignarlas dentro de un formulario.
export function listarReunionesAsistencia(callback, onError) {
  return onSnapshot(
    collection(db, "sesionesAsistencia"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.activa !== false)
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo reuniones de Asistencia:", error);
      if (onError) onError(error);
    }
  );
}
