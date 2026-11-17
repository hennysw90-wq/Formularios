// Calendario Ejecutivo del portal (app "Calendario de Turnos"): las asignaciones programadas al azar que se
// "anclan" aparecen ahí, día por día, con quién evalúa. Se escribe solo en un documento propio
// (app_data/formularios_programados), sin tocar las actividades del calendario.
// Este entorno no tiene Calendario Ejecutivo: el botón no aparece y nada se escribe.
export const CALENDARIO_EJECUTIVO = null;

let dbCal = null;
async function baseCalendario() {
  if (!CALENDARIO_EJECUTIVO) return null;
  if (dbCal) return dbCal;
  const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([import("firebase/app"), import("firebase/firestore")]);
  const app = getApps().find((x) => x.name === "calendarioEjecutivo") || initializeApp(CALENDARIO_EJECUTIVO, "calendarioEjecutivo");
  dbCal = getFirestore(app);
  return dbCal;
}
const DOC = ["app_data", "formularios_programados"];

/** Lo que se muestra en el calendario: cada día programado con quiénes evalúan. */
export function itemCalendario(a, formularioNombre = "") {
  const porDia = {};
  (a.personas || []).forEach((p) => (p.fechas || []).forEach((f) => (porDia[f] = [...(porDia[f] || []), p.nombre])));
  return {
    formulario: formularioNombre || a.formularioNombre || "",
    reunion: a.reunionNombre || "",
    area: a.area || "",
    lideres: a.lideres || [],
    soloDia: a.soloDiaProgramado !== false,
    dias: Object.keys(porDia).sort().map((fecha) => ({ fecha, nombres: porDia[fecha].sort((x, y) => x.localeCompare(y, "es")) })),
    actualizado: new Date().toISOString(),
  };
}

/** Publica (o quita, si ya no está anclada o está desactivada) una asignación en el Calendario Ejecutivo. */
export async function sincronizarCalendarioEjecutivo(a, formularioNombre = "") {
  const db = await baseCalendario();
  if (!db || !a?.id) return;
  const { doc, setDoc, updateDoc, deleteField, FieldPath } = await import("firebase/firestore");
  const ref = doc(db, ...DOC);
  const anclada = a.anclarCalendario && a.activa !== false;
  try {
    await updateDoc(ref, new FieldPath("items", a.id), anclada ? itemCalendario(a, formularioNombre) : deleteField());
  } catch (e) {
    if (!anclada) return; // no había nada que quitar
    await setDoc(ref, { items: { [a.id]: itemCalendario(a, formularioNombre) } }, { merge: true });
  }
}

export async function quitarDelCalendarioEjecutivo(id) {
  const db = await baseCalendario();
  if (!db || !id) return;
  const { doc, updateDoc, deleteField, FieldPath } = await import("firebase/firestore");
  await updateDoc(doc(db, ...DOC), new FieldPath("items", id), deleteField()).catch(() => {});
}
