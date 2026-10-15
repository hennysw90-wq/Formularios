import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase.js";

// ─── Frecuencias de asignación ──────────────────────────────────────────────
// Cada asignación dentro de un formulario dice: tal reunión, tales personas,
// tantas veces (cantidad) por tal periodo (frecuencia).
export const FRECUENCIAS = [
  { valor: "diaria", etiqueta: "Al día" },
  { valor: "semanal", etiqueta: "A la semana" },
  { valor: "quincenal", etiqueta: "A la quincena" },
  { valor: "mensual", etiqueta: "Al mes" },
  { valor: "unica", etiqueta: "Una sola vez" },
];

export function etiquetaFrecuencia(valor) {
  return FRECUENCIAS.find((f) => f.valor === valor)?.etiqueta || valor;
}

// Texto legible de una asignación: "2 veces a la semana", "1 vez al día".
export function etiquetaCadencia(cantidad, frecuencia) {
  const n = Number(cantidad) || 1;
  const veces = n === 1 ? "1 vez" : `${n} veces`;
  if (frecuencia === "unica") return n === 1 ? "Una sola vez" : `${veces} en total`;
  return `${veces} ${etiquetaFrecuencia(frecuencia).toLowerCase()}`;
}

// ─── Periodo vigente ────────────────────────────────────────────────────────
// Clave del periodo actual según la frecuencia. Las respuestas se cuentan
// contra esta clave, así "2 veces a la semana" se reinicia cada semana.

function claveSemana(fecha) {
  // Semana ISO: lunes como primer día.
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export function periodoVigente(frecuencia, ahora = new Date()) {
  const a = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  if (frecuencia === "diaria") return `${a}-${m}-${d}`;
  if (frecuencia === "semanal") return claveSemana(ahora);
  if (frecuencia === "quincenal") {
    // Dos quincenas por mes: días 1–15 y 16 en adelante.
    return `${a}-${m}-Q${ahora.getDate() <= 15 ? 1 : 2}`;
  }
  if (frecuencia === "mensual") return `${a}-${m}`;
  return "unica";
}

// ─── Tipos de pregunta ──────────────────────────────────────────────────────
export const TIPOS_PREGUNTA = [
  { valor: "cumple", etiqueta: "Cumple / No cumple" },
  { valor: "texto", etiqueta: "Texto corto" },
  { valor: "parrafo", etiqueta: "Texto largo" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "si_no", etiqueta: "Sí / No" },
  { valor: "seleccion", etiqueta: "Alternativas (una)" },
  { valor: "multiple", etiqueta: "Alternativas (varias)" },
  { valor: "escala", etiqueta: "Escala 1 a 5" },
  { valor: "fecha", etiqueta: "Fecha" },
  { valor: "hora", etiqueta: "Hora" },
  { valor: "imagen", etiqueta: "Foto / imagen" },
  { valor: "usuario", etiqueta: "Usuario (destinatario)" },
];

// Pregunta cuya respuesta es una persona del directorio. Se usa para el
// destinatario: a quién va dirigida la evaluación. Quien responde no puede
// elegirse a sí mismo.
export function esPreguntaUsuario(pregunta) {
  return pregunta?.tipo === "usuario";
}

// La primera pregunta de tipo usuario es la que manda: su respuesta queda
// también en la raíz de la respuesta, como destinatario, para poder buscar
// después "lo que recibí" sin recorrer las preguntas.
export function preguntaDestinatario(formulario) {
  return (formulario?.preguntas || []).find(esPreguntaUsuario) || null;
}

// Quiénes pueden ser elegidos como destinatario en este formulario. Si la
// lista está vacía, no hay restricción y vale cualquier usuario. Nunca se
// incluye a quien está respondiendo: el destinatario es siempre otra
// persona.
// La lista vive dentro de cada asignación: cada reunión define a quién se
// le puede dirigir la evaluación. Los formularios antiguos la tenían a
// nivel de formulario, así que esa se usa como respaldo.
export function listaDestinatarios(asignacion, formulario) {
  const deLaAsignacion = asignacion?.destinatarios || [];
  if (deLaAsignacion.length > 0) return deLaAsignacion;
  return formulario?.destinatariosPermitidos || [];
}

export function destinatariosPermitidos(asignacion, formulario, excluirUid) {
  return listaDestinatarios(asignacion, formulario).filter((p) => p.uid !== excluirUid);
}

export function hayRestriccionDeDestinatarios(asignacion, formulario) {
  return listaDestinatarios(asignacion, formulario).length > 0;
}

// Texto legible de cualquier respuesta, incluidas las de tipo usuario, que
// se guardan como objeto { uid, nombre, area }.
export function textoRespuesta(valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  if (Array.isArray(valor)) return valor.join(", ");
  if (typeof valor === "object") return valor.nombre || "";
  return String(valor);
}

export function necesitaOpciones(tipo) {
  return tipo === "seleccion" || tipo === "multiple";
}

// Las dos únicas respuestas posibles de una pregunta Cumple / No cumple.
export const CUMPLE = "Cumple";
export const NO_CUMPLE = "No cumple";

// Una pregunta con dimensión siempre es Cumple / No cumple: es lo que
// permite sumarla dentro del porcentaje de su dimensión.
export function tieneDimension(pregunta) {
  return !!(pregunta?.dimension || "").trim();
}

export function esPreguntaTexto(pregunta) {
  return pregunta?.tipo === "texto" || pregunta?.tipo === "parrafo";
}

// Todas las dimensiones distintas que usa un formulario, en el orden en que
// aparecen sus preguntas.
export function dimensionesDe(formulario) {
  const vistas = [];
  for (const p of formulario?.preguntas || []) {
    const d = (p.dimension || "").trim();
    if (d && !vistas.includes(d)) vistas.push(d);
  }
  return vistas;
}

export function etiquetaTipoPregunta(tipo) {
  return TIPOS_PREGUNTA.find((t) => t.valor === tipo)?.etiqueta || tipo;
}

// URL del QR: uno solo por formulario. Al abrirlo, la persona se identifica
// y ve sus asignaciones pendientes del periodo.
export function linkRespuesta(formularioId) {
  return `${window.location.origin}${window.location.pathname}?formulario=${formularioId}`;
}

// ─── CRUD Formularios ───────────────────────────────────────────────────────

export function listarFormularios(callback, onError) {
  return onSnapshot(
    collection(db, "formularios"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo formularios:", error);
      if (onError) onError(error);
    }
  );
}

export async function obtenerFormulario(id) {
  const snap = await getDoc(doc(db, "formularios", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// datos.asignaciones: [{ id, reunionId, reunionNombre, personas: [{uid,nombre}],
//                        cantidad, frecuencia }]
export async function crearFormulario(datos) {
  const ref = doc(collection(db, "formularios"));
  await setDoc(ref, {
    titulo: (datos.titulo || "").trim(),
    descripcion: (datos.descripcion || "").trim(),
    preguntas: datos.preguntas || [],
    asignaciones: datos.asignaciones || [],
    destinatariosPermitidos: datos.destinatariosPermitidos || [],
    destinatario: datos.destinatario || DESTINATARIO_POR_DEFECTO,
    activo: true,
    creado: new Date().toISOString(),
  });
  return ref.id;
}

// Campo "destinatario": a quién va dirigido el formulario que la persona
// está ejecutando (el líder de la sesión, el supervisor de la actividad,
// etc.). La etiqueta la define quien arma el formulario; al responder se
// elige de los usuarios registrados, menos uno mismo.
export const DESTINATARIO_POR_DEFECTO = {
  activo: true,
  etiqueta: "Destinatario",
  obligatorio: true,
};

export function configDestinatario(formulario) {
  const d = formulario?.destinatario;
  if (!d) return { ...DESTINATARIO_POR_DEFECTO, activo: false };
  return {
    activo: d.activo !== false,
    etiqueta: (d.etiqueta || "").trim() || "Destinatario",
    obligatorio: d.obligatorio !== false,
  };
}

export async function actualizarFormulario(id, datos) {
  await updateDoc(doc(db, "formularios", id), {
    ...datos,
    modificado: new Date().toISOString(),
  });
}

export async function eliminarFormulario(id) {
  await deleteDoc(doc(db, "formularios", id));
}

// ─── Respuestas ─────────────────────────────────────────────────────────────

// Cada respuesta queda amarrada a la asignación, la reunión y el periodo en
// que se ejecutó, para poder contar cuántas lleva la persona en el periodo.
export async function guardarRespuesta({
  formularioId,
  asignacionId,
  reunionId,
  reunionNombre,
  periodo,
  personaUid,
  nombreUsuario,
  area,
  destinatario,
  respuestas,
}) {
  await addDoc(collection(db, "formularios", formularioId, "respuestas"), {
    asignacionId: asignacionId || "",
    reunionId: reunionId || "",
    reunionNombre: reunionNombre || "",
    periodo: periodo || "",
    personaUid: personaUid || "",
    nombreUsuario: nombreUsuario || "Anónimo",
    area: area || "",
    destinatario: destinatario || null, // { uid, nombre, area }
    respuestas: respuestas || {},
    fecha: new Date().toISOString(),
  });
}

export async function eliminarRespuesta(formularioId, respuestaId) {
  await deleteDoc(doc(db, "formularios", formularioId, "respuestas", respuestaId));
}

export function listarRespuestas(formularioId, callback, onError) {
  return onSnapshot(
    collection(db, "formularios", formularioId, "respuestas"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo respuestas:", error);
      if (onError) onError(error);
    }
  );
}

// Respuestas que una persona ya entregó para este formulario, usadas para
// saber cuántas lleva en el periodo vigente de cada asignación.
export async function respuestasDePersona(formularioId, personaUid) {
  const col = collection(db, "formularios", formularioId, "respuestas");
  const snap = await getDocs(query(col, where("personaUid", "==", personaUid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Vistas por persona ─────────────────────────────────────────────────────

// "Cumplimiento de mi plan": todos los formularios donde la persona está
// asignada, con cuántas lleva y cuántas le faltan en el periodo vigente.
// Se recorren los formularios de a uno en vez de hacer una consulta
// transversal, porque así no hace falta crear índices en Firestore.
export async function cumplimientoDePersona(personaUid) {
  const formularios = await getDocs(collection(db, "formularios"));
  const salida = [];
  for (const doc_ of formularios.docs) {
    const formulario = { id: doc_.id, ...doc_.data() };
    if (formulario.activo === false) continue;
    const mias = (formulario.asignaciones || []).filter((a) =>
      (a.personas || []).some((p) => p.uid === personaUid)
    );
    if (mias.length === 0) continue;
    const previas = await respuestasDePersona(formulario.id, personaUid);
    salida.push({ formulario, agenda: agendaDePersona(formulario, personaUid, previas) });
  }
  return salida;
}

// Datos crudos para la matriz mensual: los formularios donde la persona está
// asignada, junto con todas sus respuestas. El cálculo por mes se hace
// después en pantalla, así cambiar de mes no vuelve a pegarle a Firestore.
// Compara personas por id y, como respaldo, por nombre sin tildes ni
// mayúsculas. El respaldo cubre asignaciones guardadas antes de que se
// usara el id, o casos donde la ficha del directorio se volvió a crear.
// Fecha desde la que se le controla el formulario a esta persona dentro de
// una asignación. Vacío significa que se controla desde siempre.
// Cantidad y frecuencia de una persona dentro de una asignación. Cada una
// tiene la suya; si no la tiene guardada (asignaciones de antes de que
// fuera por persona), se usa la de la asignación.
export function cadenciaDePersona(asignacion, usuario) {
  const p = (asignacion?.personas || []).find((x) => esLaMismaPersona(x, usuario));
  return {
    cantidad: Number(p?.cantidad) || Number(asignacion?.cantidad) || 1,
    frecuencia: p?.frecuencia || asignacion?.frecuencia || "semanal",
  };
}

export function desdeDePersona(asignacion, usuario) {
  const p = (asignacion?.personas || []).find((x) => esLaMismaPersona(x, usuario));
  return p?.desde || "";
}

// ¿Este periodo ya cae dentro del control de la persona? Cuenta si el
// periodo termina en la fecha de inicio o después, así la semana (o el mes)
// en que arrancó el control sí se exige.
export function periodoDentroDelControl(periodoCierra, desde) {
  if (!desde) return true;
  const [a, m, d] = desde.split("-").map(Number);
  if (!a || !m || !d) return true;
  return periodoCierra >= new Date(a, m - 1, d);
}

export function esLaMismaPersona(p, usuario) {
  if (!p || !usuario) return false;
  if (p.uid && usuario.uid && p.uid === usuario.uid) return true;
  const limpiar = (t) =>
    (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");
  const nombreP = limpiar(p.nombre || p.nombreUsuario);
  const nombreU = limpiar(usuario.nombreUsuario);
  return !!nombreP && nombreP === nombreU;
}

export async function datosCumplimiento(usuario) {
  const formularios = await getDocs(collection(db, "formularios"));
  const salida = [];
  let totalFormularios = 0;
  let conAsignaciones = 0;

  for (const doc_ of formularios.docs) {
    const formulario = { id: doc_.id, ...doc_.data() };
    if (formulario.activo === false) continue;
    totalFormularios++;
    const asignaciones = formulario.asignaciones || [];
    if (asignaciones.length > 0) conAsignaciones++;
    const mias = asignaciones.filter((a) =>
      (a.personas || []).some((p) => esLaMismaPersona(p, usuario))
    );
    if (mias.length === 0) continue;
    const respuestas = await respuestasDePersona(formulario.id, usuario.uid);
    salida.push({ formulario, asignaciones: mias, respuestas });
  }
  return { filas: salida, totalFormularios, conAsignaciones };
}

// Días del mes, como objetos Date.
export function diasDelMes(anio, mes) {
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return Array.from({ length: ultimo }, (_, i) => new Date(anio, mes, i + 1));
}

// Periodos de una frecuencia que caen dentro del mes, con el día en que
// cada uno cierra. Se arma recorriendo los días y agrupándolos por su clave
// de periodo, así se reutiliza la misma regla que usa el QR.
export function periodosDelMes(frecuencia, anio, mes) {
  if (frecuencia === "unica") return [];
  const porClave = new Map();
  for (const dia of diasDelMes(anio, mes)) {
    const clave = periodoVigente(frecuencia, dia);
    const previo = porClave.get(clave);
    if (!previo || dia > previo.cierra) porClave.set(clave, { clave, cierra: dia });
  }
  return [...porClave.values()];
}

export function mismaFecha(iso, dia) {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === dia.getFullYear() &&
    d.getMonth() === dia.getMonth() &&
    d.getDate() === dia.getDate()
  );
}

// Las evaluaciones de este formulario dirigidas a una persona, es decir
// donde quedó como destinatario. Se leen todas las del formulario y se
// filtran acá para no depender de un índice nuevo en Firestore.
export async function recibidasEnFormulario(formularioId, personaUid) {
  const snap = await getDocs(collection(db, "formularios", formularioId, "respuestas"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.destinatario?.uid === personaUid)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

// Todo lo que una persona ha respondido, en cualquier formulario, con el
// formulario al lado para poder leer sus preguntas. Lo usa el resumen que
// se abre desde el QR en el teléfono.
export async function respuestasDeLaPersonaEnTodos(personaUid) {
  const formularios = await getDocs(collection(db, "formularios"));
  const salida = [];
  for (const doc_ of formularios.docs) {
    const formulario = { id: doc_.id, ...doc_.data() };
    const respuestas = await respuestasDePersona(doc_.id, personaUid);
    respuestas.forEach((r) => salida.push({ formulario, ...r }));
  }
  return salida.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

// Agrupa por dimensión las respuestas Cumple / No cumple dentro de un rango
// de fechas, y junta aparte lo escrito en las preguntas de texto.
export function resumenPorDimension(respuestas, desdeFecha) {
  const dims = new Map();
  const textos = new Map();

  for (const r of respuestas) {
    if (desdeFecha && new Date(r.fecha) < desdeFecha) continue;
    for (const p of r.formulario?.preguntas || []) {
      const valor = r.respuestas?.[p.id];
      if (valor === undefined || valor === null || valor === "") continue;

      const dim = (p.dimension || "").trim();
      if (dim) {
        if (!dims.has(dim)) dims.set(dim, { dimension: dim, cumple: 0, total: 0, preguntas: new Map() });
        const d = dims.get(dim);
        const esCumple = valor === CUMPLE;
        d.total++;
        if (esCumple) d.cumple++;
        if (!d.preguntas.has(p.id)) d.preguntas.set(p.id, { texto: p.texto, cumple: 0, total: 0 });
        const q = d.preguntas.get(p.id);
        q.total++;
        if (esCumple) q.cumple++;
        continue;
      }

      if (esPreguntaTexto(p)) {
        if (!textos.has(p.id)) textos.set(p.id, { texto: p.texto, entradas: [] });
        textos.get(p.id).entradas.push({
          valor: String(valor),
          fecha: r.fecha,
          reunionNombre: r.reunionNombre || "",
          formulario: r.formulario?.titulo || "",
        });
      }
    }
  }

  const dimensiones = [...dims.values()]
    .map((d) => ({
      ...d,
      porcentaje: d.total > 0 ? Math.round((d.cumple / d.total) * 100) : null,
      preguntas: [...d.preguntas.values()].sort((a, b) => a.cumple / a.total - b.cumple / b.total),
    }))
    .sort((a, b) => (a.porcentaje ?? 101) - (b.porcentaje ?? 101));

  const totalCumple = dimensiones.reduce((s, d) => s + d.cumple, 0);
  const totalPreguntas = dimensiones.reduce((s, d) => s + d.total, 0);

  return {
    dimensiones,
    totalCumple,
    totalPreguntas,
    porcentajeGeneral: totalPreguntas > 0 ? Math.round((totalCumple / totalPreguntas) * 100) : null,
    textos: [...textos.values()].map((t) => ({
      ...t,
      entradas: t.entradas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
    })),
  };
}

// Fecha de corte: hace N meses desde hoy.
export function haceMeses(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

// Todas las respuestas de todos los formularios, con su formulario al lado.
// Lo usa el reporte de dimensiones, que necesita cruzar preguntas con
// respuestas; el filtro por persona y por fecha se hace después en pantalla.
export async function todasLasRespuestas() {
  const formularios = await getDocs(collection(db, "formularios"));
  const salida = [];
  for (const doc_ of formularios.docs) {
    const formulario = { id: doc_.id, ...doc_.data() };
    const respuestas = await getDocs(collection(db, "formularios", doc_.id, "respuestas"));
    respuestas.docs.forEach((r) => salida.push({ id: r.id, formulario, ...r.data() }));
  }
  return salida.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

// "Feedbacks y confirmaciones recibidas": respuestas de cualquier formulario
// en las que esta persona quedó como destinatario.
export async function recibidasDePersona(personaUid) {
  const formularios = await getDocs(collection(db, "formularios"));
  const salida = [];
  for (const doc_ of formularios.docs) {
    const formulario = { id: doc_.id, ...doc_.data() };
    const respuestas = await getDocs(collection(db, "formularios", doc_.id, "respuestas"));
    respuestas.docs.forEach((r) => {
      const datos = r.data();
      if (datos.destinatario?.uid === personaUid) {
        salida.push({ id: r.id, formulario, ...datos });
      }
    });
  }
  return salida.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}

// Arma la agenda que ve la persona al leer el QR: una tarjeta por cada
// asignación donde está incluida, con cuántas lleva y cuántas le faltan en
// el periodo vigente.
export function agendaDePersona(formulario, personaUid, respuestas, usuario = null) {
  const hechas = respuestas || [];
  const quien = usuario || { uid: personaUid };
  const hoy = new Date();
  return (formulario.asignaciones || [])
    .filter((a) => (a.personas || []).some((p) => esLaMismaPersona(p, quien)))
    // Si el control de esta persona todavía no empieza, la asignación no se
    // le muestra como pendiente.
    .filter((a) => {
      const desde = desdeDePersona(a, quien);
      if (!desde) return true;
      const [y, m, d] = desde.split("-").map(Number);
      return !y || new Date(y, m - 1, d) <= hoy;
    })
    .map((a) => {
      // La cadencia es la de esta persona dentro de la asignación.
      const { cantidad, frecuencia } = cadenciaDePersona(a, quien);
      const periodo = periodoVigente(frecuencia);
      const yaHechas = hechas.filter(
        (r) => r.asignacionId === a.id && r.periodo === periodo
      ).length;
      const total = cantidad;
      return {
        asignacion: a,
        cantidad,
        frecuencia,
        periodo,
        hechas: yaHechas,
        total,
        pendientes: Math.max(0, total - yaHechas),
        completa: yaHechas >= total,
      };
    });
}
