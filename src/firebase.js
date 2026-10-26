// Base de datos de la CdR en Henny (proyecto "formularios-7f89a", el mismo de
// Formularios; las colecciones de la CdR llevan prefijo "cdr"). Aquí viven los
// formularios, asignaciones, evaluaciones y compromisos. Las personas y su
// acceso NO están acá — se leen del directorio compartido (firebaseDirectorio.js).
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBTrJuMQAdOtYJVxVcqxZYgCSkijgaCB3k",
  authDomain: "formularios-7f89a.firebaseapp.com",
  projectId: "formularios-7f89a",
  storageBucket: "formularios-7f89a.firebasestorage.app",
  messagingSenderId: "325241702490",
  appId: "1:325241702490:web:3a110a95bc5e80902a7063",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
const auth = getAuth(app);

// Sesión anónima: no identifica a nadie (la identidad sale del directorio),
// solo permite que las reglas de Firestore exijan "request.auth != null".
let promesaSesion = null;
export function asegurarSesionCdR() {
  if (!promesaSesion) {
    promesaSesion = new Promise((resolve, reject) => {
      const apagar = onAuthStateChanged(auth, (u) => {
        if (u) {
          apagar();
          resolve(u);
        }
      });
      signInAnonymously(auth).catch((e) => {
        // En Henny las reglas no exigen sesión: si el login anónimo no está
        // habilitado en el proyecto, se sigue igual en vez de bloquear la app.
        console.warn("Login anónimo no disponible; se continúa sin sesión:", e?.code || e);
        apagar();
        resolve(null);
      });
    });
  }
  return promesaSesion;
}
