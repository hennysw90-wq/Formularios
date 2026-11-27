// Papelera: lo que se elimina (evaluaciones ejecutadas y formularios) queda guardado {30} días y se puede restaurar.
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";

export const COLECCION_PAPELERA = "cdrPapelera";
export const DIAS_PAPELERA = 30;
const COLS = { evaluacion: "cdrEvaluaciones", formulario: "cdrFormularios" };

/** Guarda una copia del documento en la papelera (antes de borrarlo). Lanza { code: "sin-papelera" } si no se pudo. */
export async function enviarAPapelera(tipo, id, quien) {
  await asegurarSesionCdR();
  try {
    const snap = await getDoc(doc(db, COLS[tipo], id));
    if (!snap.exists()) return;
    const d = snap.data();
    const nombre = tipo === "evaluacion"
      ? `${d.formulario?.nombre || "Evaluación"}${d.evaluadorNombre ? ` · ${d.evaluadorNombre}` : ""}`
      : d.nombre || "Formulario";
    await setDoc(doc(db, COLECCION_PAPELERA, `${tipo}_${id}`), {
      tipo, origenId: id, nombre,
      detalle: tipo === "evaluacion" ? (d.fechaEnvio || d.actualizado || "") : "",
      datos: JSON.stringify(d),
      eliminadoPor: quien || "",
      eliminadoEn: new Date().toISOString(),
    });
  } catch (e) {
    const err = new Error(e.message); err.code = "sin-papelera"; err.causa = e.code; throw err;
  }
}

/** Lo que hay en la papelera (y borra para siempre lo de más de 30 días). */
export async function listarPapelera() {
  await asegurarSesionCdR();
  const snap = await getDocs(collection(db, COLECCION_PAPELERA));
  const limite = Date.now() - DIAS_PAPELERA * 86400000;
  const vigentes = [];
  for (const d of snap.docs) {
    const x = { id: d.id, ...d.data() };
    if (Date.parse(x.eliminadoEn || "") < limite) deleteDoc(doc(db, COLECCION_PAPELERA, d.id)).catch(() => {});
    else vigentes.push(x);
  }
  return vigentes.sort((a, b) => (b.eliminadoEn || "").localeCompare(a.eliminadoEn || ""));
}

/** Vuelve a crear el documento con su mismo identificador y lo saca de la papelera. */
export async function restaurarDePapelera(item) {
  await asegurarSesionCdR();
  const datos = JSON.parse(item.datos);
  await setDoc(doc(db, COLS[item.tipo], item.origenId), datos);
  await deleteDoc(doc(db, COLECCION_PAPELERA, item.id));
}

/** Borra para siempre una copia de la papelera. */
export async function eliminarDePapelera(id) {
  await asegurarSesionCdR();
  await deleteDoc(doc(db, COLECCION_PAPELERA, id));
}
