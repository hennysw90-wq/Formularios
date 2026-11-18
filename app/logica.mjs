import { agendaDePersona, filaDeEvaluador } from "./src/asignaciones.js";
import { todosLosCompromisos, estaCerrado } from "./src/compromisosLider.js";
const KEY = "AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw";
const B = "https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents";
const tok = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })).json()).idToken;
const H = { Authorization: `Bearer ${tok}` };
const de = (v) => { if (!v) return null; if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, de(x)])); if ("arrayValue" in v) return (v.arrayValue.values || []).map(de); if ("integerValue" in v) return Number(v.integerValue); if ("doubleValue" in v) return v.doubleValue; if ("nullValue" in v) return null; return Object.values(v)[0]; };
async function all(c) { let out = [], t = ""; do { const r = await (await fetch(`${B}/${c}?pageSize=300${t ? "&pageToken=" + t : ""}`, { headers: H })).json(); out.push(...(r.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, de(v)])) }))); t = r.nextPageToken || ""; } while (t); return out; }
const A = (await all("asignaciones")).filter((a) => a.tipo === "asignacion");
const E = await all("evaluaciones");
const C = new Map((await all("compromisos")).map((c) => [c.id, c]));
const F1 = "f_mwm6ti6tjnd7", F1A = "f_mv9l6hdq4x8t";
const ahora = new Date();
console.log("== CUMPLIMIENTO (noviembre 2026) ==");
const personas = new Map();
A.filter((a) => [F1, F1A].includes(a.formularioId)).forEach((a) => (a.personas || []).forEach((p) => personas.set(p.uid || p.nombre, { uid: p.uid, nombre: p.nombre })));
for (const p of personas.values()) {
  const f = filaDeEvaluador(p, A.filter((a) => [F1, F1A].includes(a.formularioId)), E, 2026, 10, ahora);
  const det = (f.detalle || []).map((d) => `${d.asignacion?.reunionNombre || "?"}[${d.asignacion?.formularioNombre?.slice(-4)}]: ${d.celda?.hechas ?? d.hechas ?? "?"}/${d.celda?.exigido ?? d.exigido ?? "?"}`).join(" · ");
  console.log("CUMPL", p.nombre, "·", JSON.stringify(f.total || {}), "·", det);
}
console.log("== AGENDA HOY ==");
for (const p of personas.values()) {
  const ag = agendaDePersona(A, { uid: p.uid, nombreUsuario: p.nombre, nombre: p.nombre }, E, ahora).filter((it) => [F1, F1A].includes(it.asignacion.formularioId));
  ag.forEach((it) => console.log("AGENDA", p.nombre, "·", it.asignacion.reunionNombre, "·", it.asignacion.formularioId === F1 ? "F-1" : "F-1A", "· hechas", it.hechasEnPeriodo, "/", it.cantidad, "· pendientes", it.pendientes, it.bloqueadaHoy ? "· hoy no le toca" : "", it.fechaProgramada ? "· fecha " + it.fechaProgramada : "", it.proxima ? "· próxima " + it.proxima : ""));
}
console.log("== COMPROMISOS (acciones) ==");
const env = E.filter((e) => e.estado === "enviada");
const comps = todosLosCompromisos(env, C).filter((c) => [F1, F1A].includes(c.ev.formularioId));
for (const c of comps) console.log("COMP", c.ev.id, "·", c.ev.rutinaNombre, "·", c.ev.formulario?.nombre, "· evaluó", c.ev.evaluadorNombre, (c.ev.fechaEnvio || "").slice(0, 10), "· líder", c.ev.lider, "· resp", c.responsable, "· plazo", c.fecha, "· estado", c.estado, c.cierre ? `· cierre: ${c.cierre.estado || "comentado"} ${(c.cierre.comentario || "").slice(0, 60)}` : "", "· acción:", (c.accion || "").slice(0, 90));
console.log("== NOTAS DE TERRENO ==");
for (const e of env.filter((e) => [F1, F1A].includes(e.formularioId))) console.log("NOTAS", e.id, (e.rutinaNombre || "").slice(0, 28), e.evaluadorNombre, "· notas", (e.notas || []).length, (e.notas || []).map((n) => `[${n.hora}] ${(n.texto || "").slice(0, 40)}`).join(" | "));
