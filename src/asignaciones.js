// Asignaciones de la CdR, con la misma lógica que tenía la app Formularios:
// un formulario NO está atado a reuniones; cada asignación dice
//   este formulario · en esta reunión · a estos líderes · lo hacen estas
//   personas, cada una con su cantidad, frecuencia y fecha "desde".
// Se guardan en la colección "cdrAsignaciones" (tipo "asignacion").
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";
import { mismaPersona } from "./compromisos.js";
import { fechaCdR } from "./estadisticas.js";

// ─── Frecuencias ────────────────────────────────────────────────────────────
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

/** "2 veces a la semana", "1 vez al día", "Una sola vez". */
export function etiquetaCadencia(cantidad, frecuencia) {
  const n = Number(cantidad) || 1;
  const veces = n === 1 ? "1 vez" : `${n} veces`;
  if (frecuencia === "unica") return n === 1 ? "Una sola vez" : `${veces} en total`;
  return `${veces} ${etiquetaFrecuencia(frecuencia).toLowerCase()}`;
}

// ─── Periodos ───────────────────────────────────────────────────────────────
function claveSemana(fecha) {
  // Semana ISO: lunes como primer día.
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioAnio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

/** Clave del periodo al que pertenece una fecha según la frecuencia. */
export function periodoVigente(frecuencia, ahora = new Date()) {
  const a = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  if (frecuencia === "diaria") return `${a}-${m}-${d}`;
  if (frecuencia === "semanal") return claveSemana(ahora);
  if (frecuencia === "quincenal") return `${a}-${m}-Q${ahora.getDate() <= 15 ? 1 : 2}`;
  if (frecuencia === "mensual") return `${a}-${m}`;
  return "unica";
}

export function diasDelMes(anio, mes) {
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return Array.from({ length: ultimo }, (_, i) => new Date(anio, mes, i + 1));
}

/** Periodos que caen en un mes, cada uno con el día en que cierra dentro de ese mes. */
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

/** ¿Este periodo ya cae dentro del control de la persona? (vacío = desde siempre) */
export function periodoDentroDelControl(periodoCierra, desde) {
  if (!desde) return true;
  const [a, m, d] = desde.split("-").map(Number);
  if (!a || !m || !d) return true;
  return periodoCierra >= new Date(a, m - 1, d);
}

/** "AAAA-MM-DD" → fecha local a mediodía (evita saltos por zona horaria). */
export function fechaLocal(iso) {
  const [a, m, d] = String(iso || "").slice(0, 10).split("-").map(Number);
  return a && m && d ? new Date(a, m - 1, d, 12) : null;
}

/**
 * Cuánto le corresponde a una persona en un mes dentro de UNA asignación y cuánto lleva.
 *   exigido        → todo lo del mes, incluido el periodo en curso
 *   exigidoVencido → solo los periodos que ya cerraron (lo que ya se debe)
 * `hechas` = lista de { periodo, fecha } (una por CdR enviada).
 */
export function celdaDelMes(frecuencia, cantidad, desde, hechas, anio, mes, ahora = new Date()) {
  const lista = hechas || [];
  const periodos = periodosDelMes(frecuencia, anio, mes);

  // "Una sola vez": se cuenta lo ejecutado en el mes contra la cantidad pedida.
  if (periodos.length === 0) {
    const n = lista.filter((r) => {
      const f = fechaLocal(r.fecha);
      return f && f.getFullYear() === anio && f.getMonth() === mes;
    }).length;
    const exigido = n > 0 ? cantidad : 0;
    return { hechas: Math.min(n, cantidad), exigido, exigidoVencido: exigido };
  }

  const actual = periodoVigente(frecuencia, ahora);
  const considerados = periodos.filter(
    (p) => (p.cierra <= ahora || p.clave === actual) && periodoDentroDelControl(p.cierra, desde)
  );
  const cerrados = considerados.filter((p) => p.cierra <= ahora && p.clave !== actual);
  const contar = (ps) =>
    ps.reduce((s, p) => s + Math.min(lista.filter((r) => r.periodo === p.clave).length, cantidad), 0);
  return {
    hechas: contar(considerados),
    exigido: considerados.length * cantidad,
    exigidoVencido: cerrados.length * cantidad,
  };
}

export const ETIQUETA_ESTADO = {
  cumplido: "Cumplido",
  al_dia: "Al día",
  atrasado: "Atrasado",
  no_cumplido: "No cumplido",
  pendiente: "Pendiente",
  sin_exigencia: "Nada exigido",
  sin_plan: "Sin asignaciones",
};

/**
 * Estado de un mes. El periodo en curso nunca cuenta en contra hasta que termina, así que
 * "vas atrasado" (te falta de periodos ya cerrados) se distingue de "no cumpliste" (el mes terminó).
 */
export function estadoDelPlan({ exigido, exigidoVencido, hechas, anio, mes, ahora = new Date() }) {
  const esteAnio = ahora.getFullYear();
  const esteMes = ahora.getMonth();
  if (anio > esteAnio || (anio === esteAnio && mes > esteMes)) return "pendiente";
  if (!exigido) return "sin_exigencia";
  if (hechas >= exigido) return "cumplido";
  if (!(anio === esteAnio && mes === esteMes)) return "no_cumplido";
  return hechas >= exigidoVencido ? "al_dia" : "atrasado";
}

// ─── Firestore ──────────────────────────────────────────────────────────────
const COLECCION = "cdrAsignaciones";

export function nuevoIdAsignacion() {
  return `asig_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Todas las asignaciones, en vivo. */
export function listarAsignaciones(callback, onError) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        query(collection(db, COLECCION), where("tipo", "==", "asignacion")),
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => {
          console.error("Error leyendo asignaciones:", e);
          if (onError) onError(e);
        }
      );
    })
    .catch((e) => {
      console.error("No se pudo abrir sesión en la base de la CdR:", e);
      if (onError) onError(e);
    });
  return () => {
    cancelado = true;
    apagar();
  };
}

/** Las asignaciones de un formulario, una sola vez (para quien llega por QR). */
export async function asignacionesDeFormulario(formularioId) {
  await asegurarSesionCdR();
  const snap = await getDocs(query(collection(db, COLECCION), where("formularioId", "==", formularioId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.tipo === "asignacion");
}

export async function guardarAsignacion(a) {
  await asegurarSesionCdR();
  const { id, ...resto } = JSON.parse(JSON.stringify(a)); // Firestore no acepta "undefined"
  await setDoc(doc(db, COLECCION, id), {
    ...resto,
    tipo: "asignacion",
    personas: (resto.personas || []).map((p) => ({
      uid: p.uid || "",
      nombre: p.nombre || "",
      cantidad: Math.max(1, Math.floor(Number(p.cantidad)) || 1),
      frecuencia: p.frecuencia || "semanal",
      desde: p.desde || "",
    })),
    lideres: (resto.lideres || []).map((l) => String(l).trim()).filter(Boolean),
    actualizado: new Date().toISOString(),
  });
}

export async function eliminarAsignacion(id) {
  await asegurarSesionCdR();
  await deleteDoc(doc(db, COLECCION, id));
}

// ─── Personas y asignaciones ────────────────────────────────────────────────
const comoPersona = (u) => ({ uid: u?.uid || "", personaId: u?.personaId || "", nombre: u?.nombre || u?.nombreUsuario || "" });

/** ¿La persona `p` de una asignación es este usuario? (por uid o por nombre, sin tildes ni mayúsculas) */
export function esLaPersona(p, usuario) {
  return !!usuario && mismaPersona(comoPersona(p), comoPersona(usuario));
}

/** Las asignaciones donde este usuario es evaluador. */
export function asignacionesDe(asignaciones, usuario) {
  return (asignaciones || []).filter((a) => (a.personas || []).some((p) => esLaPersona(p, usuario)));
}

/**
 * El formulario "visto desde las asignaciones": sus reuniones (con sus líderes) y sus evaluadores salen de las
 * asignaciones, no del formulario. Con `usuario`, solo las reuniones de las asignaciones de esa persona.
 * El resto de la CdR (evaluar, QR, estadísticas) trabaja sobre este resultado sin cambios.
 */
export function proyectarFormulario(form, asignaciones, usuario = null) {
  const propias = (asignaciones || []).filter((a) => a.formularioId === form.id && a.reunionId);
  const visibles = usuario ? asignacionesDe(propias, usuario) : propias;
  const rutinas = new Map();
  visibles.forEach((a) => {
    const r = rutinas.get(a.reunionId) || {
      sesionId: a.reunionId,
      nombre: a.reunionNombre || "",
      area: a.area || "",
      horaInicio: a.horaInicio || "",
      horaFin: a.horaFin || "",
      lideres: [],
    };
    (a.lideres || []).forEach((l) => {
      if (!r.lideres.includes(l)) r.lideres.push(l);
    });
    rutinas.set(a.reunionId, r);
  });
  const asignados = new Map();
  propias.forEach((a) =>
    (a.personas || []).forEach((p) => {
      const k = p.uid || `n:${p.nombre}`;
      if (!asignados.has(k)) asignados.set(k, { uid: p.uid || "", nombre: p.nombre || "" });
    })
  );
  const lista = [...asignados.values()];
  return {
    ...form,
    rutinas: [...rutinas.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, "es")),
    asignados: lista,
    asignadosUids: lista.map((p) => p.uid).filter(Boolean),
  };
}

// ─── Cumplimiento ───────────────────────────────────────────────────────────
/**
 * Las CdR enviadas que cuentan para una persona en una asignación: mismo formulario, misma reunión y
 * hechas por esa persona. Cada una se ubica en su periodo según la fecha de la CdR.
 */
export function hechasEnAsignacion(asignacion, persona, evals, frecuencia) {
  return (evals || [])
    .filter(
      (e) =>
        e.estado === "enviada" &&
        !e.anulada &&
        e.formularioId === asignacion.formularioId &&
        e.rutinaSesionId === asignacion.reunionId &&
        mismaPersona({ uid: e.evaluadorUid, personaId: e.evaluadorPersonaId, nombre: e.evaluadorNombre }, comoPersona(persona))
    )
    .map((e) => {
      const fecha = fechaCdR(e);
      const f = fechaLocal(fecha);
      return { id: e.id, fecha, periodo: f ? periodoVigente(frecuencia, f) : "" };
    });
}

/** Lo que le toca a la persona ahora mismo, asignación por asignación (periodo vigente). */
export function agendaDePersona(asignaciones, usuario, evals, ahora = new Date()) {
  return asignacionesDe(asignaciones, usuario)
    .map((a) => {
      const p = a.personas.find((x) => esLaPersona(x, usuario));
      const cantidad = Math.max(1, Number(p.cantidad) || 1);
      const frecuencia = p.frecuencia || "semanal";
      const desde = p.desde || "";
      const empezo = !desde || (fechaLocal(desde) || ahora) <= ahora;
      const hechas = hechasEnAsignacion(a, p, evals, frecuencia);
      const periodo = periodoVigente(frecuencia, ahora);
      const enPeriodo = frecuencia === "unica" ? hechas.length : hechas.filter((h) => h.periodo === periodo).length;
      return {
        asignacion: a,
        cantidad,
        frecuencia,
        desde,
        empezo,
        hechasEnPeriodo: Math.min(enPeriodo, cantidad),
        pendientes: empezo ? Math.max(0, cantidad - enPeriodo) : 0,
        completa: enPeriodo >= cantidad,
        hechas,
      };
    })
    .sort((x, y) => y.pendientes - x.pendientes || (x.asignacion.reunionNombre || "").localeCompare(y.asignacion.reunionNombre || "", "es"));
}

/** Una fila por persona para un mes: el detalle de cada asignación y el total. */
export function filaDeEvaluador(persona, asignaciones, evals, anio, mes, ahora = new Date()) {
  const detalle = asignacionesDe(asignaciones, persona).map((a) => {
    const p = a.personas.find((x) => esLaPersona(x, persona));
    const cantidad = Math.max(1, Number(p.cantidad) || 1);
    const frecuencia = p.frecuencia || "semanal";
    const hechas = hechasEnAsignacion(a, p, evals, frecuencia);
    const c = celdaDelMes(frecuencia, cantidad, p.desde || "", hechas, anio, mes, ahora);
    const periodo = periodoVigente(frecuencia, ahora);
    const enCurso = frecuencia === "unica" ? hechas.length : hechas.filter((h) => h.periodo === periodo).length;
    return {
      asignacion: a,
      cantidad,
      frecuencia,
      desde: p.desde || "",
      ...c,
      estado: estadoDelPlan({ ...c, anio, mes, ahora }),
      pendienteAhora: Math.max(0, cantidad - enCurso),
    };
  });
  const exigido = detalle.reduce((s, d) => s + d.exigido, 0);
  const exigidoVencido = detalle.reduce((s, d) => s + d.exigidoVencido, 0);
  const hechas = detalle.reduce((s, d) => s + d.hechas, 0);
  return {
    uid: persona.uid || "",
    nombre: persona.nombre || persona.nombreUsuario || "",
    area: persona.area || "",
    detalle,
    exigido,
    exigidoVencido,
    hechas,
    porcentaje: exigido > 0 ? Math.round((hechas / exigido) * 100) : null,
    estado: detalle.length === 0 ? "sin_plan" : estadoDelPlan({ exigido, exigidoVencido, hechas, anio, mes, ahora }),
  };
}

export function resumenDeFilas(filas) {
  const r = { personas: filas.length, cumplido: 0, al_dia: 0, atrasado: 0, no_cumplido: 0, pendiente: 0, sin_exigencia: 0, sin_plan: 0 };
  filas.forEach((f) => {
    r[f.estado] = (r[f.estado] || 0) + 1;
  });
  return r;
}
