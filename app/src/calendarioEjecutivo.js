// Calendario Ejecutivo del portal (app "Calendario de Turnos"): las asignaciones programadas al azar que se
// "anclan" aparecen ahí, día por día, con quién evalúa. Se escribe solo en un documento propio
// (app_data/formularios_programados), sin tocar las actividades del calendario.
export const CALENDARIO_EJECUTIVO = {
  apiKey: "AIzaSyAVFPItuXFeQF8u3HKgFlhrviHFCtauNns",
  authDomain: "calendario-turnos-oems.firebaseapp.com",
  projectId: "calendario-turnos-oems",
  storageBucket: "calendario-turnos-oems.firebasestorage.app",
  messagingSenderId: "600455008831",
  appId: "1:600455008831:web:dc8363a5ffd9a990ef1e8a",
};

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

// «LB-SS-SOM-0035 · Operación de vaciado…» → «Operación de vaciado…» (el código queda en el detalle).
const sinCodigo = (t) => String(t || "").split(" · ").slice(-1)[0].trim();
function textoAlcance(al) {
  const op = al?.opciones || [];
  if (op.length === 1) return sinCodigo(op[0]);
  if (op.length > 1) return `${op.length} estándares`;
  if ((al?.subareas || []).length) return al.subareas.join(", ");
  return "";
}

/** Lo que se muestra en el calendario: cada día programado con quiénes evalúan. */
export function itemCalendario(a, formularioNombre = "") {
  const porDia = {};
  (a.personas || []).forEach((p) => (p.fechas || []).forEach((f) => (porDia[f] = [...(porDia[f] || []), p.nombre])));
  const sigla = a.formularioSigla && a.formularioSigla !== "evaluación" ? a.formularioSigla : (String(formularioNombre || a.formularioNombre || "").match(/^(C[a-z][A-Z])\b/) || [])[1] || "";
  // Sin días sorteados (semanal, mensual, una sola vez…): cada persona con su periodo; el calendario lo muestra
  // arriba de cada día del periodo (ej. «1 asignación · jue 19 – dom 22»).
  const sinSorteo = !Object.keys(porDia).length;
  const desdeAsig = a.vigenteDesde || String(a.creado || "").slice(0, 10) || "";
  return {
    sigla,
    // Asignadas por listado: qué estándar (u opción) le toca a cada persona.
    estandarDe: Object.fromEntries((a.personas || []).map((p) => [p.nombre, textoAlcance(p.alcance || a.planComun?.alcance)]).filter(([, t]) => t)),
    ...(sinSorteo
      ? {
          personas: (a.personas || []).map((p) => ({
            nombre: p.nombre,
            frecuencia: p.frecuencia || "semanal",
            cantidad: Math.max(1, Number(p.cantidad) || 1),
            desde: p.desde || desdeAsig,
            hasta: p.hasta || "",
          })),
        }
      : {}),
    formulario: formularioNombre || a.formularioNombre || "",
    // Asignadas por listado no tienen reunión propia: se muestra el nombre del formulario.
    reunion: a.campoAsignacion ? "" : a.reunionNombre || "",
    area: a.area || "",
    lideres: a.lideres || [],
    soloDia: a.soloDiaProgramado !== false,
    // Horario en que se muestra en el calendario (se elige al anclar).
    inicio: a.calendarioHorario?.sinHorario ? "" : a.calendarioHorario?.inicio || "",
    fin: a.calendarioHorario?.sinHorario ? "" : a.calendarioHorario?.fin || "",
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
