// Conexión de SOLO LECTURA al catálogo de estándares del Portal EO (página "Gestionar Estándares", proyecto
// Firebase "gestionar-mi-agenda", colección "estandares"). Formularios no escribe nada allí: el listado se edita
// en el Portal y aquí se refleja en vivo como "Listado estándares (Portal EO)".
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { escucharCompartido } from "./compartir.js";

const configPortalEO = {
  apiKey: "AIzaSyCI8oXECFRvZLev2__iMGggeAAs4VSjDms",
  authDomain: "gestionar-mi-agenda.firebaseapp.com",
  projectId: "gestionar-mi-agenda",
  storageBucket: "gestionar-mi-agenda.firebasestorage.app",
  messagingSenderId: "807535289431",
  appId: "1:807535289431:web:7befb05f1ddf0f95ab6f12",
};

let app = null;
let promesaSesion = null;
function conexion() {
  if (!app) app = initializeApp(configPortalEO, "portaleo");
  const auth = getAuth(app);
  if (!promesaSesion) {
    // El Portal entra con sesión anónima; aquí igual, solo para poder leer.
    promesaSesion = new Promise((resolve, reject) => {
      const apagar = onAuthStateChanged(auth, (u) => {
        if (u) {
          apagar();
          resolve(u);
        }
      });
      signInAnonymously(auth).catch(reject);
    });
  }
  return { db: getFirestore(app), sesion: promesaSesion };
}

export const ID_LISTADO_PORTAL = "portal-eo-estandares";
export const NOMBRE_LISTADO_PORTAL = "Listado estándares (Portal EO)";

/** Texto de cada opción: "código · nombre" (o solo el nombre si no tiene código). */
export const textoEstandar = (e) => [String(e.codigo || "").trim(), String(e.nombre || "").trim()].filter(Boolean).join(" · ");

/**
 * Escucha los estándares del Portal EO y entrega el listado sincronizado:
 * { id, nombre, opciones: ["código · nombre", …], subareas: { opción: área }, sincronizado: true }.
 */
export function escucharListadoPortalEO(callback, onError) {
  return escucharCompartido("portalEO", (ok, mal) => abrirListadoPortalEO(ok, mal), callback, onError);
}
function abrirListadoPortalEO(callback, onError) {
  let apagar = () => {};
  let cancelado = false;
  const { db, sesion } = conexion();
  sesion
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        collection(db, "estandares"),
        (snap) => {
          const items = snap.docs
            .map((d) => d.data())
            .filter((e) => String(e.nombre || "").trim())
            .sort((a, b) => textoEstandar(a).localeCompare(textoEstandar(b), "es"));
          const opciones = [];
          const subareas = {};
          items.forEach((e) => {
            const t = textoEstandar(e);
            if (!t || opciones.includes(t)) return;
            opciones.push(t);
            const area = String(e.area || "").trim();
            if (area) subareas[t] = area;
          });
          callback({ id: ID_LISTADO_PORTAL, nombre: NOMBRE_LISTADO_PORTAL, opciones, subareas, sincronizado: true });
        },
        (e) => {
          console.error("No se pudo leer el listado de estándares del Portal EO:", e);
          if (onError) onError(e);
        }
      );
    })
    .catch((e) => {
      console.error("No se pudo conectar con el Portal EO:", e);
      if (onError) onError(e);
    });
  return () => {
    cancelado = true;
    apagar();
  };
}
