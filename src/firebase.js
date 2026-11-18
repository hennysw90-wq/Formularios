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
/**
 * Sesión anónima. Si no se pudo iniciar (ej. sin señal al abrir la página), NO queda guardado el fallo:
 * la próxima lectura o guardado lo vuelve a intentar, así una CdR a medias puede guardarse cuando vuelve la señal.
 */
export function asegurarSesionCdR({ renovar = false } = {}) {
  if (auth.currentUser && !renovar) return Promise.resolve(auth.currentUser);
  if (!promesaSesion || renovar) {
    promesaSesion = new Promise((resolve) => {
      const apagar = onAuthStateChanged(auth, (u) => {
        if (u) {
          apagar();
          resolve(u);
        }
      });
      signInAnonymously(auth).catch((e) => {
        console.warn("Login anónimo no disponible por ahora; se reintentará:", e?.code || e);
        apagar();
        promesaSesion = null; // no se recuerda el fallo: se reintenta en el próximo uso
        resolve(null);
      });
    });
  }
  return promesaSesion;
}
