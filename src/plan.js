// Plan de cada evaluador: una meta mensual de CdR y/o rutinas que debe cubrir cada mes, y su cumplimiento.
import { mismaPersona, norm } from "./compromisos.js";
import { fechaCdR, claveRutina, hoyISO } from "./estadisticas.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export const mesDe = (iso) => String(iso || "").slice(0, 7);
export const diasDelMes = (mes) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
export const etiquetaMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
export const etiquetaMesCorta = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3)} ${mes.slice(2, 4)}`;

/** El mes que está `n` meses antes de `mes` (formato AAAA-MM). */
export function mesAnterior(mes, n = 1) {
  let a = Number(mes.slice(0, 4));
  let m = Number(mes.slice(5, 7)) - n;
  while (m < 1) {
    m += 12;
    a -= 1;
  }
  return `${a}-${String(m).padStart(2, "0")}`;
}

/** Desde cuándo hay que leer CdR para cubrir `meses` meses de historial (con un margen por el cambio de mes). */
export function desdeHistorial(hoy = hoyISO(), meses = 6) {
  const primero = `${mesAnterior(mesDe(hoy), meses - 1)}-01`;
  const d = new Date(`${primero}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const clavePlan = (r) => r.sesionId || norm(r.nombre);

export function tienePlan(plan) {
  return !!plan && ((Math.floor(Number(plan.metaMensual)) || 0) > 0 || (plan.rutinas || []).length > 0);
}

/** CdR enviadas (no anuladas) que hizo esa persona como evaluadora en ese mes. */
export function evaluacionesDe(evals, persona, mes) {
  return evals.filter(
    (e) =>
      e.estado === "enviada" &&
      !e.anulada &&
      mismaPersona(persona, { uid: e.evaluadorUid, personaId: e.evaluadorPersonaId, nombre: e.evaluadorNombre }) &&
      mesDe(fechaCdR(e)) === mes
  );
}

export const ETIQUETA_ESTADO = { cumplido: "Cumplido", al_dia: "Al día", atrasado: "Atrasado", no_cumplido: "No cumplido", pendiente: "Pendiente", sin_plan: "Sin plan" };

/**
 * Cumplimiento de un mes. Estados: cumplido · al_dia (va al ritmo esperado) · atrasado (por debajo del ritmo)
 * · no_cumplido (el mes ya pasó sin completarse) · pendiente (mes futuro) · sin_plan.
 */
export function cumplimientoMes(plan, evals, mes, hoy = hoyISO()) {
  const meta = Math.max(0, Math.floor(Number(plan?.metaMensual)) || 0);
  const rutinasPlan = plan?.rutinas || [];
  const propias = plan ? evaluacionesDe(evals, { uid: plan.uid, nombre: plan.nombre }, mes) : [];
  const claves = new Set(propias.map(claveRutina));
  const nombres = new Set(propias.map((e) => norm(e.rutinaNombre)));
  const rutinas = rutinasPlan.map((r) => ({ ...r, hecha: claves.has(clavePlan(r)) || nombres.has(norm(r.nombre)) }));
  const cubiertas = rutinas.filter((r) => r.hecha).length;
  const hechas = propias.length;
  const mesHoy = mesDe(hoy);
  const esActual = mes === mesHoy;
  const esPasado = mes < mesHoy;
  const dm = diasDelMes(mes);
  const dia = esActual ? Number(hoy.slice(8, 10)) : esPasado ? dm : 0;

  let estado;
  if (!tienePlan(plan)) estado = "sin_plan";
  else if (hechas >= meta && cubiertas >= rutinasPlan.length) estado = "cumplido";
  else if (esPasado) estado = "no_cumplido";
  else if (!esActual) estado = "pendiente";
  else {
    // Ritmo esperado: lo proporcional al día del mes (hacia abajo, para no exigir de más a comienzos de mes).
    const esperadaMeta = Math.floor((meta * dia) / dm);
    const esperadasRutinas = Math.floor((rutinasPlan.length * dia) / dm);
    estado = hechas >= esperadaMeta && cubiertas >= esperadasRutinas ? "al_dia" : "atrasado";
  }
  return {
    mes,
    meta,
    hechas,
    pct: meta > 0 ? Math.min(100, Math.round((hechas * 100) / meta)) : null,
    faltan: Math.max(0, meta - hechas),
    rutinas,
    cubiertas,
    estado,
    diasRestantes: esActual ? dm - dia : 0,
  };
}

/** Los `n` meses anteriores al actual, del más reciente al más antiguo. */
export function historialPlan(plan, evals, hoy = hoyISO(), n = 3) {
  const actual = mesDe(hoy);
  return Array.from({ length: n }, (_, i) => cumplimientoMes(plan, evals, mesAnterior(actual, i + 1), hoy));
}

/** Personas asignadas como evaluadoras en los formularios, con los formularios y las rutinas a las que tienen acceso. */
export function evaluadoresAsignados(formularios) {
  const mapa = new Map();
  formularios.forEach((f) =>
    (f.asignados || []).forEach((a) => {
      if (!a.uid) return;
      const p = mapa.get(a.uid) || { uid: a.uid, nombre: a.nombre, formularios: [], rutinas: new Map() };
      if (!p.formularios.includes(f.nombre)) p.formularios.push(f.nombre);
      (f.rutinas || []).forEach((r) => p.rutinas.set(clavePlan(r), { sesionId: r.sesionId, nombre: r.nombre }));
      mapa.set(a.uid, p);
    })
  );
  return mapa;
}

/**
 * Una fila por evaluador. Si se entrega el directorio de usuarios, la lista sale de ahí: todas las personas que hoy
 * tienen el tick de la CdR en Administración (el Master solo si está asignado a un formulario o ya tiene plan).
 * Sin directorio (no se pudo leer) se usa lo que se sabe: asignados a formularios + quienes tienen plan.
 * `planes` = lista de planes guardados.
 */
export function filasPlan(formularios, planes, evals, mes, hoy = hoyISO(), usuarios = null) {
  const asignados = evaluadoresAsignados(formularios);
  const todasRutinas = new Map();
  formularios.forEach((f) => (f.rutinas || []).forEach((r) => todasRutinas.set(clavePlan(r), { sesionId: r.sesionId, nombre: r.nombre })));
  const porUid = new Map(planes.map((p) => [p.uid, p]));
  let uids;
  let nombreDirectorio = new Map();
  if (Array.isArray(usuarios)) {
    const vigentes = usuarios.filter((u) => tieneAccesoCdR(u) && (u.rol !== "master" || asignados.has(u.uid) || porUid.has(u.uid)));
    uids = new Set(vigentes.map((u) => u.uid));
    nombreDirectorio = new Map(vigentes.map((u) => [u.uid, u.nombreUsuario]));
  } else {
    uids = new Set([...asignados.keys(), ...porUid.keys()]);
  }
  return [...uids]
    .map((uid) => {
      const a = asignados.get(uid);
      const plan = porUid.get(uid) || null;
      return {
        uid,
        nombre: nombreDirectorio.get(uid) || a?.nombre || plan?.nombre || uid,
        asignado: !!a,
        formularios: a ? a.formularios : [],
        rutinasDisponibles: [...(a && a.rutinas.size ? a.rutinas : todasRutinas).values()],
        plan,
        cumplimiento: plan ? cumplimientoMes(plan, evals, mes, hoy) : null,
      };
    })
    .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
}

/**
 * Cuántas personas que estaban asignadas a un formulario o tenían plan ya no tienen acceso a la CdR
 * (para avisar que no se muestran; su plan se conserva por si se les devuelve el acceso).
 */
export function personasSinAcceso(formularios, planes, usuarios) {
  const conAcceso = new Set(usuarios.filter(tieneAccesoCdR).map((u) => u.uid));
  const conocidas = new Set([...evaluadoresAsignados(formularios).keys(), ...planes.map((p) => p.uid)]);
  return [...conocidas].filter((uid) => !conAcceso.has(uid)).length;
}

export function resumenPlanes(filas) {
  const r = { evaluadores: filas.length, conPlan: 0, cumplido: 0, al_dia: 0, atrasado: 0, no_cumplido: 0, pendiente: 0 };
  filas.forEach((f) => {
    if (!f.cumplimiento || f.cumplimiento.estado === "sin_plan") return;
    r.conPlan += 1;
    r[f.cumplimiento.estado] += 1;
  });
  return r;
}

/** ¿Puede esta persona entrar hoy a la CdR? Misma regla que el ingreso y la pestaña Evaluadores. */
export function tieneAccesoCdR(u) {
  return !!u && u.estado !== "pendiente" && u.rol !== "deshabilitado" && (u.rol === "master" || (Array.isArray(u.apps) && u.apps.includes("cdr")));
}
