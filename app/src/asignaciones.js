// Asignaciones de la CdR, con la misma lógica que tenía la app Formularios:
// un formulario NO está atado a reuniones; cada asignación dice
//   este formulario · en esta reunión · a estos líderes · lo hacen estas
//   personas, cada una con su cantidad, frecuencia y fecha "desde".
// Se guardan en la colección "asignaciones" (tipo "asignacion").
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";
import { mismaPersona } from "./compromisos.js";
import { fechaCdR } from "./estadisticas.js";
import { escucharCompartido } from "./compartir.js";
import { sincronizarCalendarioEjecutivo, quitarDelCalendarioEjecutivo } from "./calendarioEjecutivo.js";

// ─── Frecuencias ────────────────────────────────────────────────────────────
export const FRECUENCIAS = [
  { valor: "diaria", etiqueta: "Al día" },
  { valor: "semanal", etiqueta: "A la semana" },
  { valor: "quincenal", etiqueta: "A la quincena" },
  { valor: "mensual", etiqueta: "Al mes" },
  { valor: "unica", etiqueta: "Una sola vez" },
  { valor: "programada", etiqueta: "Programado al azar (días)" },
];

export function etiquetaFrecuencia(valor) {
  return FRECUENCIAS.find((f) => f.valor === valor)?.etiqueta || valor;
}

const ddmmaaaa = (iso) => String(iso || "").slice(0, 10).split("-").reverse().join("-");

/** "2 veces a la semana", "1 vez al día", "Una sola vez", "Una sola vez · hasta 15-11-2026". */
export function etiquetaCadencia(cantidad, frecuencia, hasta = "", base = "") {
  const n = Number(cantidad) || 1;
  const veces = n === 1 ? "1 vez" : `${n} veces`;
  if (frecuencia === "unica") return (n === 1 ? "Una sola vez" : `${veces} en total`) + (hasta ? ` · hasta ${ddmmaaaa(hasta)}` : "");
  if (frecuencia === "programada") return `${base ? `${veces} ${etiquetaFrecuencia(base).toLowerCase()} · ` : ""}al azar${hasta ? ` hasta ${ddmmaaaa(hasta)}` : ""}`;
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

/**
 * Clave del periodo al que pertenece una fecha según la frecuencia.
 * "programada": cada fecha sorteada de la persona es un periodo; una evaluación cuenta para la última fecha
 * programada que ya llegó (si se atrasa, cuenta igual mientras no llegue su siguiente fecha).
 */
export function periodoVigente(frecuencia, ahora = new Date(), fechas = [], estricto = false) {
  if (frecuencia === "programada") {
    const hoy = hoyLocalISO(ahora);
    // Estricto ("solo el día que le toca"): solo cuenta si se hace ese mismo día.
    if (estricto) return (fechas || []).includes(hoy) ? hoy : "";
    return [...(fechas || [])].sort().filter((f) => f <= hoy).pop() || "";
  }
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
export function periodosDelMes(frecuencia, anio, mes, fechas = []) {
  if (frecuencia === "unica") return [];
  if (frecuencia === "programada") {
    const pref = `${anio}-${String(mes + 1).padStart(2, "0")}-`;
    return [...new Set(fechas || [])].filter((f) => f.startsWith(pref)).sort().map((f) => ({ clave: f, cierra: fechaLocal(f) }));
  }
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

/** Fecha local de hoy como "AAAA-MM-DD". */
export function hoyLocalISO(ahora = new Date()) {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

/** "Una sola vez" con plazo: solo cuentan las CdR hechas entre "desde" y "hasta" (ambos incluidos). */
export function dentroDelPlazo(fechaIso, desde, hasta) {
  const f = String(fechaIso || "").slice(0, 10);
  if (!f) return false;
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
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
export function celdaDelMes(frecuencia, cantidad, desde, hechas, anio, mes, ahora = new Date(), hasta = "", controlHasta = "", fechas = [], estricto = false) {
  if (frecuencia === "programada") cantidad = 1; // una evaluación por fecha programada
  // controlHasta (exclusivo): fin de un tramo del historial; los periodos que cierran ese día o después ya no le tocan.
  const tope = controlHasta ? fechaLocal(controlHasta) : null;
  if (tope) tope.setHours(0, 0, 0, 0);
  const lista = hechas || [];
  const periodos = periodosDelMes(frecuencia, anio, mes, fechas);

  // "Una sola vez" con plazo: se exige en el mes en que vence el plazo, contando lo hecho dentro del rango.
  // Mientras el plazo no termina no cuenta como atraso.
  if (periodos.length === 0 && hasta) {
    const h = fechaLocal(hasta);
    if (!h || h.getFullYear() !== anio || h.getMonth() !== mes) return { hechas: 0, reales: 0, exigido: 0, exigidoVencido: 0 };
    const n = lista.filter((r) => dentroDelPlazo(r.fecha, desde, hasta)).length;
    const vencido = hoyLocalISO(ahora) > hasta;
    return { hechas: Math.min(n, cantidad), reales: n, exigido: cantidad, exigidoVencido: vencido ? cantidad : 0 };
  }

  // "Una sola vez" sin plazo (asignaciones antiguas): se cuenta lo ejecutado en el mes contra la cantidad pedida.
  if (periodos.length === 0) {
    const n = lista.filter((r) => {
      const f = fechaLocal(r.fecha);
      return f && f.getFullYear() === anio && f.getMonth() === mes;
    }).length;
    const exigido = n > 0 ? cantidad : 0;
    return { hechas: Math.min(n, cantidad), reales: n, exigido, exigidoVencido: exigido };
  }

  const actual = periodoVigente(frecuencia, ahora, fechas, estricto);
  const considerados = periodos.filter(
    (p) => (p.cierra <= ahora || p.clave === actual) && periodoDentroDelControl(p.cierra, desde) && (!tope || p.cierra < tope)
  );
  const cerrados = considerados.filter((p) => p.cierra <= ahora && p.clave !== actual);
  const contar = (ps, tope = true) =>
    ps.reduce((s, p) => { const n = lista.filter((r) => r.periodo === p.clave).length; return s + (tope ? Math.min(n, cantidad) : n); }, 0);
  // `hechas` (con tope) es lo que cuenta para el %; `reales` es lo que se hizo de verdad, para mostrarlo.
  return {
    hechas: contar(considerados),
    reales: contar(considerados, false),
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
const COLECCION = "asignaciones";

export function nuevoIdAsignacion() {
  return `asig_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Todas las asignaciones, en vivo. */
export function listarAsignaciones(callback, onError) {
  return escucharCompartido("asignaciones", (ok, mal) => abrirAsignaciones(ok, mal), callback, onError);
}
function abrirAsignaciones(callback, onError) {
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
      hasta: ((p.frecuencia === "unica" || p.frecuencia === "programada") && p.hasta) || "",
      // Formularios asignados por listado: qué opciones / sub áreas le tocan a esta persona.
      ...(p.alcance ? { alcance: { opciones: p.alcance.opciones || [], subareas: p.alcance.subareas || [] } } : {}),
      ...(p.personalizado ? { personalizado: true } : {}), // distinto del plan común de la asignación
      // Programado al azar: el calendario sorteado de la persona (queda fijo) y con qué reglas se sorteó.
      ...(p.frecuencia === "programada" ? { fechas: [...new Set(p.fechas || [])].sort(), dias: p.dias || [], base: p.base || "semanal", hastaProgramado: p.hasta || "", ...(p.firmaSorteo ? { firmaSorteo: p.firmaSorteo } : {}) } : {}),
    })),
    lideres: (resto.lideres || []).map((l) => String(l).trim()).filter(Boolean),
    actualizado: new Date().toISOString(),
  });
  // Anclada al Calendario Ejecutivo: el calendario se mantiene al día con cada cambio (y se quita si se desancla o desactiva).
  // (Si no está anclada, se asegura de que no quede en el calendario: por si la desanclaron al editar.)
  sincronizarCalendarioEjecutivo(a).catch((e) => console.error("Calendario ejecutivo:", e));
}

export async function eliminarAsignacion(id) {
  await asegurarSesionCdR();
  await deleteDoc(doc(db, COLECCION, id));
  quitarDelCalendarioEjecutivo(id);
}

// ─── Personas y asignaciones ────────────────────────────────────────────────
/**
 * Desde cuándo se controla a una persona en una asignación: su fecha "desde" o, si la dejaron vacía, el día en
 * que se creó la asignación. Así los meses en que todavía no tenía nada asignado no le cuentan como no cumplidos.
 */
export function desdeEfectivo(asignacion, persona) {
  return persona?.desde || String(asignacion?.creado || "").slice(0, 10);
}

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
  const propias = soloActivas(asignaciones).filter((a) => a.formularioId === form.id && a.reunionId);
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
      evaluadores: [], // quiénes están asignados a evaluar ESTA reunión (todos con usuario)
    };
    (a.lideres || []).forEach((l) => {
      if (!r.lideres.includes(l)) r.lideres.push(l);
    });
    (a.personas || []).forEach((p) => {
      if (!r.evaluadores.some((x) => esLaPersona(x, p))) r.evaluadores.push({ uid: p.uid || "", nombre: p.nombre || "", ...(p.alcance ? { alcance: p.alcance, cantidad: p.cantidad || 1, frecuencia: p.frecuencia || "semanal", asignacionId: a.id, ...(p.fechas ? { fechas: p.fechas } : {}) } : {}) });
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
      // "Solo el día que le toca": vale el día real en que se envió (no la fecha que se escriba en el formulario).
      const fecha = frecuencia === "programada" && soloElDia(asignacion) && e.fechaEnvio ? hoyLocalISO(new Date(e.fechaEnvio)) : fechaCdR(e);
      const f = fechaLocal(fecha);
      return { id: e.id, fecha, periodo: f ? periodoVigente(frecuencia, f, persona?.fechas, soloElDia(asignacion)) : "" };
    });
}

/** Programado al azar: por defecto solo se puede hacer el día que le toca (se desmarca en el plan común). */
export const soloElDia = (a) => a?.soloDiaProgramado !== false;

/** Lo que le toca a la persona ahora mismo, asignación por asignación (periodo vigente). */
export function agendaDePersona(asignaciones, usuario, evals, ahora = new Date()) {
  return asignacionesDe(soloActivas(asignaciones), usuario)
    .map((a) => {
      const p = a.personas.find((x) => esLaPersona(x, usuario));
      const frecuencia = p.frecuencia || "semanal";
      const cantidad = frecuencia === "programada" ? 1 : Math.max(1, Number(p.cantidad) || 1);
      const desde = desdeDelTramo(a, p);
      const hechas = hechasEnAsignacion(a, p, evals, frecuencia);
      const periodo = periodoVigente(frecuencia, ahora, p.fechas, soloElDia(a));
      // Programada: empieza con su primera fecha; "proxima" es la siguiente fecha que le toca.
      const estricto = frecuencia === "programada" && soloElDia(a);
      const empezo = frecuencia === "programada" ? (estricto ? !!periodo : !!periodoVigente("programada", ahora, p.fechas)) : !desde || (fechaLocal(desde) || ahora) <= ahora;
      const proxima = frecuencia === "programada" ? [...(p.fechas || [])].sort().find((f) => f > hoyLocalISO(ahora)) || "" : "";
      const hasta = frecuencia === "unica" ? p.hasta || "" : "";
      const enPeriodo =
        frecuencia === "unica"
          ? hasta ? hechas.filter((h) => dentroDelPlazo(h.fecha, desde, hasta)).length : hechas.length
          : hechas.filter((h) => h.periodo === periodo).length;
      const plazoTerminado = !!hasta && hoyLocalISO(ahora) > hasta;
      const completa = enPeriodo >= cantidad;
      return {
        asignacion: a,
        cantidad,
        frecuencia,
        desde,
        hasta,
        empezo,
        fechaProgramada: frecuencia === "programada" ? periodo : "",
        soloDiaProgramado: estricto,
        // Estricto: hoy no le toca (no se puede hacer hasta su próxima fecha).
        bloqueadaHoy: estricto && !periodo,
        proxima,
        hechasEnPeriodo: Math.min(enPeriodo, cantidad),
        hechasReales: enPeriodo,
        pendientes: empezo && !plazoTerminado ? Math.max(0, cantidad - enPeriodo) : 0,
        completa,
        vencida: plazoTerminado && !completa,
        hechas,
      };
    })
    .sort((x, y) => y.pendientes - x.pendientes || (x.asignacion.reunionNombre || "").localeCompare(y.asignacion.reunionNombre || "", "es"));
}

/** Una fila por persona para un mes: el detalle de cada asignación y el total. */
export function filaDeEvaluador(persona, asignaciones, evals, anio, mes, ahora = new Date()) {
  const detalle = asignacionesConHistorialDe(asignaciones, persona).map((a0) => {
    // Lo vigente hoy (o el último tramo donde estuvo) para mostrar; el cálculo suma tramo por tramo.
    const a = ultimoTramoDe(a0, persona);
    const p = a.personas.find((x) => esLaPersona(x, persona));
    const frecuencia = p.frecuencia || "semanal";
    const cantidad = frecuencia === "programada" ? 1 : Math.max(1, Number(p.cantidad) || 1);
    const hechas = hechasEnAsignacion(a, p, evals, frecuencia);
    const hasta = frecuencia === "unica" ? p.hasta || "" : "";
    const c = celdaConHistorial(a0, persona, evals, anio, mes, ahora);
    const periodo = periodoVigente(frecuencia, ahora, p.fechas, soloElDia(a));
    const enCurso =
      frecuencia === "unica"
        ? hasta ? hechas.filter((h) => dentroDelPlazo(h.fecha, desdeEfectivo(a, p), hasta)).length : hechas.length
        : hechas.filter((h) => h.periodo === periodo).length;
    return {
      asignacion: a0,
      cantidad,
      frecuencia,
      hasta,
      desde: desdeDelTramo(a, p),
      ...c,
      estado: estadoDelPlan({ ...c, anio, mes, ahora }),
      pendienteAhora: estaActiva(a0) && (a0.personas || []).some((x) => esLaPersona(x, persona)) ? Math.max(0, cantidad - enCurso) : 0,
    };
  });
  const exigido = detalle.reduce((s, d) => s + d.exigido, 0);
  const exigidoVencido = detalle.reduce((s, d) => s + d.exigidoVencido, 0);
  const hechas = detalle.reduce((s, d) => s + d.hechas, 0);
  const reales = detalle.reduce((s, d) => s + d.reales, 0);
  return {
    uid: persona.uid || "",
    nombre: persona.nombre || persona.nombreUsuario || "",
    area: persona.area || "",
    detalle,
    exigido,
    exigidoVencido,
    hechas,
    reales,
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

/* ─── Paso desde el modelo anterior de la CdR ───────────────────────────
 * Antes, cada formulario traía sus reuniones (rutinas, con sus líderes) y sus evaluadores (asignados),
 * y cada evaluador podía tener un plan (asignaciones/plan_<uid>, tipo "plan") con las reuniones que le tocaban.
 * Esto propone una asignación por formulario + reunión que todavía no tenga una, para que el Master la cree
 * con un clic y después ajuste la cadencia. No modifica ni borra lo anterior.
 */
export function listarPlanesAnteriores(callback, onError) {
  let apagar = () => {};
  let cancelado = false;
  asegurarSesionCdR()
    .then(() => {
      if (cancelado) return;
      apagar = onSnapshot(
        query(collection(db, COLECCION), where("tipo", "==", "plan")),
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => (onError ? onError(e) : console.error(e))
      );
    })
    .catch((e) => onError && onError(e));
  return () => {
    cancelado = true;
    apagar();
  };
}

export function propuestasDesdeModeloAnterior(formularios, asignaciones, planes = []) {
  const yaExiste = new Set((asignaciones || []).map((a) => `${a.formularioId}|${a.reunionId}`));
  const planPorUid = new Map((planes || []).map((p) => [p.uid, p]));
  const propuestas = [];
  (formularios || []).forEach((f) => {
    (f.rutinas || []).forEach((r) => {
      if (!r.sesionId || yaExiste.has(`${f.id}|${r.sesionId}`)) return;
      const lideres = (r.lideres || []).map((l) => (typeof l === "string" ? l : l?.nombre || "")).filter(Boolean);
      // Evaluadores del formulario; si alguien tenía plan con reuniones, solo en esas.
      const personas = (f.asignados || [])
        .filter((p) => {
          const plan = planPorUid.get(p.uid);
          return !plan || !(plan.rutinas || []).length || plan.rutinas.some((x) => x.sesionId === r.sesionId);
        })
        .map((p) => ({ uid: p.uid || "", nombre: p.nombre || "", cantidad: 1, frecuencia: "mensual", desde: "" }));
      if (!lideres.length || !personas.length) return;
      propuestas.push({
        id: nuevoIdAsignacion(),
        formularioId: f.id,
        formularioNombre: f.nombre || "",
        reunionId: r.sesionId,
        reunionNombre: r.nombre || "",
        area: r.area || "",
        horaInicio: r.horaInicio || "",
        horaFin: r.horaFin || "",
        lideres,
        personas,
      });
    });
  });
  return propuestas;
}


// ─── Historial de una asignación (cumplimiento no retroactivo) ─────────────
// Cada vez que se modifica una asignación, su configuración anterior queda como un "tramo" con fecha de término:
//   tramos: [{ desde, hasta, personas, formularioId, reunionId, lideres }]   (hasta = día del cambio, exclusivo)
//   vigenteDesde: desde cuándo rige la configuración actual (vacío = desde siempre, como las antiguas)
//   activa: false + inactivaDesde → desactivada (no se exige nada desde ese día).
// El cumplimiento de cada periodo se calcula con el tramo vigente en ese momento.
export const estaActiva = (a) => a?.activa !== false;
export const soloActivas = (asignaciones) => (asignaciones || []).filter(estaActiva);

const CAMPOS_CONFIG = ["personas", "formularioId", "formularioNombre", "reunionId", "reunionNombre", "lideres", "area", "campoAsignacion", "soloDiaProgramado"];

/** Los tramos de una asignación como asignaciones "virtuales" con su ventana de control (_desde, _hasta). */
export function tramosDe(a) {
  const pasados = (a.tramos || []).map((t) => ({ ...a, ...t, _desde: t.desde || "", _hasta: t.hasta || "" }));
  const actual = { ...a, _desde: a.vigenteDesde || "", _hasta: estaActiva(a) ? "" : a.inactivaDesde || hoyLocalISO() };
  return [...pasados, actual];
}
/** Desde cuándo se controla a la persona en un tramo: lo más tarde entre su "desde" y el inicio del tramo. */
export function desdeDelTramo(a, p) {
  const inicioTramo = "_desde" in a ? a._desde : a.vigenteDesde || "";
  return [desdeEfectivo(a, p), inicioTramo].filter(Boolean).sort().pop() || "";
}
/** Asignaciones donde la persona está hoy o estuvo en algún tramo (para no perder su historial). */
export function asignacionesConHistorialDe(asignaciones, persona) {
  return (asignaciones || []).filter((a) => tramosDe(a).some((t) => (t.personas || []).some((p) => esLaPersona(p, persona))));
}
/** El tramo más reciente donde aparece la persona. */
export function ultimoTramoDe(a, persona) {
  return [...tramosDe(a)].reverse().find((t) => (t.personas || []).some((p) => esLaPersona(p, persona))) || a;
}
/** Celda del mes sumando todos los tramos donde la persona estuvo, cada uno con sus reglas. */
export function celdaConHistorial(a, persona, evals, anio, mes, ahora = new Date()) {
  const total = { hechas: 0, reales: 0, exigido: 0, exigidoVencido: 0 };
  tramosDe(a).forEach((t) => {
    const p = (t.personas || []).find((x) => esLaPersona(x, persona));
    if (!p) return;
    const cantidad = Math.max(1, Number(p.cantidad) || 1);
    const frecuencia = p.frecuencia || "semanal";
    const hechas = hechasEnAsignacion(t, p, evals, frecuencia);
    let hasta = frecuencia === "unica" ? p.hasta || "" : "";
    if (hasta && t._hasta && hasta >= t._hasta) {
      const d = fechaLocal(t._hasta);
      d.setDate(d.getDate() - 1);
      hasta = hoyLocalISO(d);
    }
    const c = celdaDelMes(frecuencia, cantidad, desdeDelTramo(t, p), hechas, anio, mes, ahora, hasta, t._hasta, p.fechas, soloElDia(t));
    total.hechas += c.hechas;
    total.reales += c.reales;
    total.exigido += c.exigido;
    total.exigidoVencido += c.exigidoVencido;
  });
  return total;
}

const configDe = (a) =>
  JSON.stringify(
    CAMPOS_CONFIG.map((k) =>
      k === "personas"
        ? (a?.personas || []).map((p) => [p.uid || "", p.nombre || "", Math.max(1, Math.floor(Number(p.cantidad)) || 1), p.frecuencia || "semanal", p.desde || "", (p.frecuencia === "unica" && p.hasta) || "", (p.frecuencia === "programada" && [...(p.fechas || [])].sort().join(",")) || "", p.alcance ? [[...(p.alcance.opciones || [])].sort(), [...(p.alcance.subareas || [])].sort()] : null])
        : k === "lideres" ? [...(a?.lideres || [])].map((l) => String(l).trim()).filter(Boolean) : a?.[k] ?? null
    )
  );

/**
 * Al guardar una asignación ya existente: si cambió algo que afecta el cumplimiento, la configuración anterior
 * queda como tramo hasta hoy y la nueva rige desde hoy. (Si se crea y se corrige el mismo día, solo se reemplaza.)
 */
export function versionarAsignacion(anterior, nueva, hoy = hoyLocalISO()) {
  if (!anterior || configDe(anterior) === configDe(nueva)) return { ...nueva, tramos: anterior?.tramos || nueva.tramos || [] };
  const inicio = anterior.vigenteDesde || String(anterior.creado || "").slice(0, 10) || "";
  if (inicio === hoy) return { ...nueva, tramos: anterior.tramos || [], vigenteDesde: anterior.vigenteDesde || "" };
  const tramo = Object.fromEntries(CAMPOS_CONFIG.map((k) => [k, anterior[k] ?? null]));
  return { ...nueva, tramos: [...(anterior.tramos || []), { ...tramo, desde: anterior.vigenteDesde || "", hasta: hoy }], vigenteDesde: hoy };
}

/** Desactivar: desde hoy no se exige nada; el historial queda. */
export async function desactivarAsignacion(a) {
  await guardarAsignacion({ ...a, activa: false, inactivaDesde: hoyLocalISO() });
}
/** Reactivar: lo que rigió hasta que se desactivó queda como tramo; los días desactivada no cuentan. */
export async function reactivarAsignacion(a) {
  const hoy = hoyLocalISO();
  const tramo = Object.fromEntries(CAMPOS_CONFIG.map((k) => [k, a[k] ?? null]));
  await guardarAsignacion({
    ...a,
    tramos: [...(a.tramos || []), { ...tramo, desde: a.vigenteDesde || "", hasta: a.inactivaDesde || hoy }],
    vigenteDesde: hoy,
    activa: true,
    inactivaDesde: "",
  });
}


// ─── Programación al azar ───────────────────────────────────────────────────
/**
 * Programa al azar respetando la frecuencia: a cada persona le tocan `cantidad` días por periodo (semana, quincena,
 * mes o día), elegidos al azar entre los días de la semana permitidos (0 = domingo … 6 = sábado) de `desde` a `hasta`.
 * Para repartir la carga, en cada periodo se prefieren los días que todavía tienen menos personas.
 * Devuelve { [clavePersona]: ["AAAA-MM-DD", …] }.
 */
export function sortearProgramacion(claves, desde, hasta, dias, cantidad = 1, base = "semanal", ocupadas = []) {
  const res = Object.fromEntries(claves.map((k) => [k, []]));
  if (!claves.length || !desde || !hasta || !(dias || []).length) return res;
  const freq = base === "programada" ? "semanal" : base;
  // Días permitidos dentro del rango, por periodo; y cuántos días permitidos tiene cada periodo completo
  // (para que un periodo cortado —ej. solo el lunes 30— pida proporcionalmente menos y no amontone a todos).
  const porPeriodo = new Map();
  const completos = new Map();
  const ini = fechaLocal(desde); ini.setDate(ini.getDate() - 35);
  const fin = fechaLocal(hasta); fin.setDate(fin.getDate() + 35);
  for (let d = ini; d <= fin; d.setDate(d.getDate() + 1)) {
    if (!dias.includes(d.getDay())) continue;
    const k = periodoVigente(freq, d);
    completos.set(k, (completos.get(k) || 0) + 1);
    const iso = hoyLocalISO(d);
    if (iso >= desde && iso <= hasta) {
      if (!porPeriodo.has(k)) porPeriodo.set(k, []);
      porPeriodo.get(k).push(iso);
    }
  }
  const azar = new Map(claves.map((k) => [k, Math.random()]));
  const barajar = (l) => {
    const x = [...l];
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };
  const n = Math.max(1, Math.floor(Number(cantidad)) || 1);
  const carga = new Map();
  (ocupadas || []).forEach((f) => carga.set(f, (carga.get(f) || 0) + 1)); // días ya tomados por otros evaluadores
  const credito = new Map(claves.map((k) => [k, 0])); // lo que a cada uno "le corresponde" acumulado
  [...porPeriodo.keys()].sort().forEach((k) => {
    const fechas = porPeriodo.get(k);
    const fraccion = fechas.length / Math.max(1, completos.get(k) || fechas.length);
    const cuota = n * fraccion;
    claves.forEach((c) => credito.set(c, credito.get(c) + cuota));
    // Cupos del periodo: proporcionales a lo que cubre el rango (redondeado); se dan a quienes más se les debe.
    let cupos = Math.min(Math.round(claves.length * cuota), claves.length * Math.min(n, fechas.length));
    const usados = new Map(claves.map((c) => [c, []]));
    while (cupos > 0) {
      const candidatos = claves
        .filter((c) => usados.get(c).length < Math.min(n, fechas.length))
        .sort((x, y) => credito.get(y) - credito.get(x) || azar.get(x) - azar.get(y));
      if (!candidatos.length) break;
      const c = candidatos[0];
      // El día con menos gente (entre iguales, al azar) que esa persona aún no tenga.
      const dia = barajar(fechas.filter((f) => !usados.get(c).includes(f))).sort((x, y) => (carga.get(x) || 0) - (carga.get(y) || 0))[0];
      if (!dia) break;
      usados.get(c).push(dia);
      res[c].push(dia);
      carga.set(dia, (carga.get(dia) || 0) + 1);
      credito.set(c, credito.get(c) - 1);
      azar.set(c, Math.random());
      cupos--;
    }
  });
  Object.values(res).forEach((l) => l.sort());
  return res;
}
/** Calendario de una asignación programada: [{ fecha, clave }] ordenado por fecha. */
export function calendarioDe(personas, claveDe) {
  return (personas || []).flatMap((p) => (p.fechas || []).map((f) => ({ fecha: f, clave: claveDe(p) }))).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
