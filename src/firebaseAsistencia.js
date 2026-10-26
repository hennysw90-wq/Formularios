// Conexión de SOLO LECTURA al catálogo de reuniones de Control de Asistencia
// (proyecto asistenciatracker, Henny). La CdR no escribe nada allí.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";

const configAsistencia = {
  apiKey: "AIzaSyAc8B3plwDo76yTFUvBECeqrCBu5mdzJSQ",
  authDomain: "asistenciatracker.firebaseapp.com",
  projectId: "asistenciatracker",
  storageBucket: "asistenciatracker.firebasestorage.app",
  messagingSenderId: "1011667358934",
  appId: "1:1011667358934:web:a0f10d5e43623aeb5f6577",
};

const appAsistencia = initializeApp(configAsistencia, "asistencia");
const dbAsistencia = getFirestore(appAsistencia);

const DIAS = { lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom" };

/** Texto corto de cuándo ocurre una reunión (ayuda a distinguir reuniones de nombre parecido). */
export function describirFrecuencia(s) {
  const hora = s.horaInicio ? ` · ${s.horaInicio}${s.horaFin ? "–" + s.horaFin : ""}` : "";
  if (s.frecuencia === "unica") return `Única${s.fechaUnica ? " · " + s.fechaUnica : ""}${hora}`;
  if (s.frecuencia === "dias") return `${(s.dias || []).map((d) => DIAS[d] || d).join(", ") || "Días específicos"}${hora}`;
  if (s.frecuencia === "mensual_dia_semana") {
    const ord = { 1: "1er", 2: "2do", 3: "3er", 4: "4to", ultimo: "Último" }[s.ordinalSemana] || "";
    return `Mensual (${ord} ${DIAS[s.diaSemanaMensual] || ""})${hora}`;
  }
  if (s.frecuencia === "mensual") return `Mensual · día ${s.diaMes || 1}${hora}`;
  return `Todos los días${hora}`;
}

/** Reuniones activas (sin las "actividades"), ordenadas por nombre. */
export function listarRutinasAsistencia(callback, onError) {
  return onSnapshot(
    collection(dbAsistencia, "sesionesAsistencia"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.tipo !== "actividad" && s.activa !== false)
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
      callback(lista);
    },
    (e) => {
      console.error("Error leyendo reuniones de Asistencia:", e);
      if (onError) onError(e);
    }
  );
}

/** Personas del directorio de Control de Asistencia (quienes registran asistencia), ordenadas por nombre. */
export function listarPersonasAsistencia(callback, onError) {
  return onSnapshot(
    collection(dbAsistencia, "personasAsistencia"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => (p.nombre || "").trim())
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      callback(lista);
    },
    (e) => {
      console.error("Error leyendo personas de Asistencia:", e);
      if (onError) onError(e);
    }
  );
}
