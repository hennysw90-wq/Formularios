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
console.log("== COMPROMISOS (acciones) ==");
const env = E.filter((e) => e.estado === "enviada");
const comps = todosLosCompromisos(env, C);
for (const c of comps) console.log("COMP", c.ev.id, "·", c.ev.rutinaNombre, "·", c.ev.formularioId === F1 ? "CdR F-1" : c.ev.formularioId === F1A ? "CdR F-1A" : c.ev.formulario?.nombre, "· evaluó", c.ev.evaluadorNombre, (c.ev.fechaEnvio || "").slice(0, 10), "· líder", c.ev.lider, "· resp", c.responsable, "· plazo", c.fecha, "· estado", c.estado, c.cierre ? `· cierre: ${c.cierre.estado || "comentado"} ${JSON.stringify(c.cierre.comentario || "")}` : "", "· acción:", JSON.stringify(c.accion || ""));
