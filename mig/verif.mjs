const KEY = "AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw";
const B = "https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents";
const BC = "https://firestore.googleapis.com/v1/projects/calendario-turnos-oems/databases/(default)/documents";
const tok = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })).json()).idToken;
const H = { Authorization: `Bearer ${tok}` };
const de = (v) => { if (!v) return null; if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, de(x)])); if ("arrayValue" in v) return (v.arrayValue.values || []).map(de); if ("integerValue" in v) return Number(v.integerValue); if ("doubleValue" in v) return v.doubleValue; if ("nullValue" in v) return null; return Object.values(v)[0]; };
async function all(c) { let out = [], t = ""; do { const r = await (await fetch(`${B}/${c}?pageSize=300${t ? "&pageToken=" + t : ""}`, { headers: H })).json(); out.push(...(r.documents || []).map((d) => ({ id: d.name.split("/").pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, de(v)])) }))); t = r.nextPageToken || ""; } while (t); return out; }
const F = await all("formularios"), A = await all("asignaciones"), E = await all("evaluaciones"), C = await all("compromisos");
const ok = (c, m) => console.log(c ? "OK  " : "MAL ", m);
const f1a = F.find((f) => f.id === "f_mv9l6hdq4x8t"), f1 = F.find((f) => f.id === "f_mwm6ti6tjnd7");
ok(f1a.nombre === "CdR Dialogo de Desempeño F-1A" && f1a.bloques.some((b) => /seguridad/i.test(b.nombre)) && !f1a.qrDe, `F-1A: "${f1a.nombre}" · bloques ${f1a.bloques.map((b) => b.nombre + " " + b.peso).join(" | ")} · estado ${f1a.estado}`);
ok(f1.nombre === "CdR Dialogo de Desempeño F-1" && !f1.bloques.some((b) => /seguridad/i.test(b.nombre)) && f1.qrDe === f1a.id, `F-1: "${f1.nombre}" · qrDe ${f1.qrDe} · bloques ${f1.bloques.map((b) => b.nombre + " " + b.peso).join(" | ")} · estado ${f1.estado}`);
for (const a of A.filter((a) => a.tipo === "asignacion" && [f1a.id, f1.id].includes(a.formularioId))) {
  const lix = /ixivi/.test(a.reunionNombre || "");
  const esperado = lix ? f1.id : f1a.id;
  const tramosOk = (a.tramos || []).every((t) => !t.formularioId || t.formularioId === esperado);
  ok(a.formularioId === esperado && tramosOk, `Asig ${a.id} ${a.reunionNombre} → ${a.formularioNombre} · personas ${(a.personas || []).length} · tramos ${(a.tramos || []).length} ok=${tramosOk} · ancla ${!!a.anclarCalendario} · programados ${(a.personas || []).reduce((n, p) => n + (p.fechas || []).length, 0)}`);
}
const EVS = ["ev_mvy5uj68fuxn", "ev_mw53m5uh3jrs", "ev_mwkoroinas7m", "ev_mwkp0h8do0hr"];
for (const id of EVS) {
  const e = E.find((x) => x.id === id);
  const sinSeg = !e.formulario.bloques.some((b) => /seguridad/i.test(b.nombre)) && !("C5" in e.respuestas) && !("C6" in e.respuestas);
  ok(e.estado === "enviada" && !e.anulada && e.formularioId === f1.id && sinSeg && e.feedback?.compromiso?.accion !== undefined,
    `${id} ${e.evaluadorNombre} ${(e.fechaEnvio || "").slice(0, 10)} · ${e.estado} · ${e.formulario.nombre} · índice ${e.recalculo?.indiceAnterior} → ${e.resultado.indice} (${e.resultado.clasificacion}) · críticos ${JSON.stringify(e.resultado.criticosEnCero)} · respuestas ${Object.keys(e.respuestas).length} · notas ${(e.notas || []).length} · compromiso "${(e.feedback?.compromiso?.accion || "").slice(0, 40)}" · fortalezas ${(e.feedback?.fortalezas || []).length} · oportunidades ${(e.feedback?.oportunidades || []).length}`);
}
const c = C.find((x) => x.id === "ev_mvy5uj68fuxn");
ok(c && c.formularioId === f1.id, `Cierre de compromiso ev_mvy5uj68fuxn: form ${c?.formularioId} · ${JSON.stringify(c).slice(0, 160)}`);
// Coordinación no se toca
for (const e of E.filter((x) => x.formularioId === f1a.id && x.estado === "enviada")) console.log("    F-1A enviada (sin cambios):", e.id, e.rutinaNombre, e.evaluadorNombre, e.resultado?.indice);
// Pendientes que podrían quedar mal: borradores de Lixiviación en F-1A
for (const e of E.filter((x) => x.estado === "borrador" && /ixivi/.test(x.rutinaNombre || ""))) console.log("    Borrador Lixiviación:", e.id, e.formularioId, e.evaluadorNombre, e.actualizado);
for (const e of E.filter((x) => /aguiar/i.test(x.evaluadorNombre || ""))) console.log("    Fernando Aguiar:", e.id, e.estado, e.formularioId, e.rutinaNombre, e.actualizado);
const cal = await (await fetch(`${BC}/app_data/formularios_programados`)).json();
const items = de({ mapValue: { fields: cal.fields } }).items;
for (const [id, it] of Object.entries(items)) console.log("    Calendario", id, "·", it.formulario, "·", it.reunion, "· dias", (it.dias || []).length, "· personas", (it.personas || []).length, "·", it.inicio || "sin hora", it.fin || "");
