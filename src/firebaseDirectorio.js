// Conexión aparte, exclusiva para el directorio compartido de usuarios y
// áreas (proyecto Firebase "directorio-usuarios-dd278"). Los datos
// propios de esta app (sesiones, asistencia) siguen viviendo en su
// proyecto de siempre (ver firebase.js) — solo "usuarios" y "areas" se
// comparten con otras apps (ej. RdP Tracker).
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const configDirectorio = {
  apiKey: "AIzaSyBIH6lfEKmyofzrFzLW-ypTNOvpfVhBRQQ",
  authDomain: "directorio-usuarios-dd278.firebaseapp.com",
  projectId: "directorio-usuarios-dd278",
  storageBucket: "directorio-usuarios-dd278.firebasestorage.app",
  messagingSenderId: "331770849408",
  appId: "1:331770849408:web:f8fef0bb42ee164310de65",
};

const appDirectorio = initializeApp(configDirectorio, "directorio");

export const dbDirectorio = getFirestore(appDirectorio);
