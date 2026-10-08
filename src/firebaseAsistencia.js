// Conexión aparte, de SOLO LECTURA, al proyecto de Control de Asistencia
// ("asistenciatracker"). Se usa únicamente para traer el listado de
// reuniones (colección "sesionesAsistencia") y poder asignarlas dentro de
// un formulario. Esta app nunca escribe en ese proyecto: las reuniones se
// siguen creando y editando solo desde Asistencia QR.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const configAsistencia = {
  apiKey: "AIzaSyAc8B3plwDo76yTFUvBECeqrCBu5mdzJSQ",
  authDomain: "asistenciatracker.firebaseapp.com",
  projectId: "asistenciatracker",
  storageBucket: "asistenciatracker.firebasestorage.app",
  messagingSenderId: "1011667358934",
  appId: "1:1011667358934:web:a0f10d5e43623aeb5f6577",
};

const appAsistencia = initializeApp(configAsistencia, "asistencia");

export const dbAsistencia = getFirestore(appAsistencia);
