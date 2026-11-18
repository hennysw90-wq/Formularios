import { calcularResultado } from "./calculo.mjs";
const APLICAR = process.env.APLICAR === "1";
const KEY = "AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw";
const B = "https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents";
const BC = "https://firestore.googleapis.com/v1/projects/calendario-turnos-oems/databases/(default)/documents";
const F1A = "f_mv9l6hdq4x8t", F1 = "f_mwm6ti6tjnd7";
const N1A = "CdR Dialogo de Desempeño F-1A", N1 = "CdR Dialogo de Desempeño F-1";
const LIX_ASIG = ["asig_mvtgrahwr4em", "asig_mwjrnsns17q1"];
const COORD_ASIG = ["asig_mvtgqef7czat", "asig_mwkvpm1hqid2", "asig_mwm3uvlfxpgy"];
const EVS = ["ev_mvy5uj68fuxn", "ev_mw53m5uh3jrs", "ev_mwkoroinas7m", "ev_mwkp0h8do0hr"];
const tok = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })).json()).idToken;
const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
const de = (v) => { if (!v) return null; if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, de(x)])); if ("arrayValue" in v) return (v.arrayValue.values || []).map(de); if ("integerValue" in v) return Number(v.integerValue); if ("doubleValue" in v) return v.doubleValue; if ("nullValue" in v) return null; return Object.values(v)[0]; };
const a = (x) => { if (x === null || x === undefined) return { nullValue: null }; if (Array.isArray(x)) return { arrayValue: { values: x.map(a) } }; if (typeof x === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, a(v)])) } }; if (typeof x === "boolean") return { booleanValue: x }; if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x }; return { stringValue: String(x) }; };
async function get(base, path) { const r = await fetch(`${base}/${path}`, { headers: H }); if (!r.ok) throw new Error(`GET ${path} ${r.status}`); const d = await r.json(); return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, de(v)])); }
async function patch(base, path, campos) {
  const mask = Object.keys(campos).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const fields = {};
  for (const [k, v] of Object.entries(campos)) {
    const partes = k.split(".");
    let o = fields;
    partes.forEach((p, i) => { if (i === partes.length - 1) o[p] = a(v); else { o[p] = o[p] || { mapValue: { fields: {} } }; o = o[p].mapValue.fields; } });
  }
  if (!APLICAR) { console.log("  (simulado) PATCH", path, Object.keys(campos).join(", ")); return; }
  const r = await fetch(`${base}/${path}?${mask}&currentDocument.exists=true`, { method: "PATCH", headers: H, body: JSON.stringify({ fields }) });
  console.log("  PATCH", path, r.status, r.ok ? "OK" : (await r.text()).slice(0, 300));
  if (!r.ok) throw new Error("falló " + path);
}
console.log(APLICAR ? "=== APLICANDO ===" : "=== SIMULACIÓN ===");
const f1 = await get(B, `formularios/${F1}`);
// 1) Evaluaciones de Lixiviación (primero, por si las reglas no lo permiten: así no queda nada a medias)
for (const id of EVS) {
  const e = await get(B, `evaluaciones/${id}`);
  if (e.formularioId !== F1A || e.estado !== "enviada" || !/ixivi/.test(e.rutinaNombre || "")) { console.log("SALTA", id, e.formularioId, e.estado, e.rutinaNombre); continue; }
  const snap = JSON.parse(JSON.stringify(e.formulario));
  snap.bloques = snap.bloques.filter((b) => !/seguridad/i.test(b.nombre));
  snap.bloques.forEach((b) => { const g = (f1.bloques || []).find((x) => x.nombre === b.nombre); if (g) b.peso = g.peso; });
  snap.id = F1; snap.nombre = N1;
  const resp = Object.fromEntries(Object.entries(e.respuestas || {}).filter(([k]) => k !== "C5" && k !== "C6"));
  const niv = Object.fromEntries(Object.entries(resp).filter(([, r]) => r && r.nivel !== undefined && r.nivel !== "").map(([k, r]) => [k, r.nivel]));
  snap.parametros = { umbralEfectiva: 85, umbralDesarrollo: 70, ...(snap.parametros || {}) };
  const res = calcularResultado(snap, niv);
  console.log(id, e.evaluadorNombre, (e.fechaEnvio || "").slice(0, 10), "antes", e.resultado?.indice, e.resultado?.clasificacion, "→", res.indice, res.clasificacion, res.criticosEnCero);
  await patch(B, `evaluaciones/${id}`, {
    formularioId: F1, formulario: snap, respuestas: resp,
    resultado: { indice: res.indice, clasificacion: res.clasificacion, criticosEnCero: res.criticosEnCero, bloques: res.bloques },
    recalculo: { fecha: new Date().toISOString(), motivo: "Se quitó el bloque Seguridad (Reunión Especial Lixiviación): pasa a CdR F-1", formularioAnterior: F1A, indiceAnterior: e.resultado?.indice ?? null, clasificacionAnterior: e.resultado?.clasificacion || "", respuestasQuitadas: { C5: e.respuestas?.C5 || null, C6: e.respuestas?.C6 || null } },
  });
}
// 2) Formularios: nombres y QR compartido
await patch(B, `formularios/${F1A}`, { nombre: N1A });
await patch(B, `formularios/${F1}`, { nombre: N1, qrDe: F1A });
// 3) Asignaciones
for (const id of LIX_ASIG) {
  const x = await get(B, `asignaciones/${id}`);
  const tramos = (x.tramos || []).map((t) => ({ ...t, ...(t.formularioId === F1A ? { formularioId: F1, formularioNombre: N1 } : {}) }));
  console.log(id, x.reunionNombre, "form", x.formularioId, "→", F1, "| tramos", tramos.length);
  await patch(B, `asignaciones/${id}`, { formularioId: F1, formularioNombre: N1, formularioSigla: "CdR", tramos });
}
for (const id of COORD_ASIG) {
  const x = await get(B, `asignaciones/${id}`);
  const tramos = (x.tramos || []).map((t) => ({ ...t, ...(t.formularioId === F1A ? { formularioNombre: N1A } : {}) }));
  console.log(id, x.reunionNombre, "sigue en", x.formularioId);
  await patch(B, `asignaciones/${id}`, { formularioNombre: N1A, tramos });
}
// 4) Cierre de compromiso de la CdR de Lixiviación
try {
  const c = await get(B, `compromisos/ev_mvy5uj68fuxn`);
  const campos = {}; if ("formularioId" in c) campos.formularioId = F1; if ("formularioNombre" in c) campos.formularioNombre = N1;
  if (Object.keys(campos).length) await patch(B, `compromisos/ev_mvy5uj68fuxn`, campos); else console.log("cierre sin campos de formulario");
} catch (err) { console.log("cierre:", err.message); }
// 5) Calendario Ejecutivo: nombre del formulario en lo anclado
const cal = await get(BC, "app_data/formularios_programados");
const camposCal = {};
for (const [id, it] of Object.entries(cal.items || {})) {
  if (LIX_ASIG.includes(id)) camposCal[`items.${id}.formulario`] = N1;
  if (COORD_ASIG.includes(id)) camposCal[`items.${id}.formulario`] = N1A;
}
if (Object.keys(camposCal).length) await patch(BC, "app_data/formularios_programados", camposCal);
console.log("LISTO");
