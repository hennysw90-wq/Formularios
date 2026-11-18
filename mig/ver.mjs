const KEY = "AIzaSyDgLm6b2mXz50ITTKmgkO7Ia0qloZXypJw";
const B = "https://firestore.googleapis.com/v1/projects/cdr-reuniones/databases/(default)/documents";
const tok = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) })).json()).idToken;
const H = { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" };
const de = (v) => { if (!v) return null; if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, de(x)])); if ("arrayValue" in v) return (v.arrayValue.values || []).map(de); if ("integerValue" in v) return Number(v.integerValue); if ("doubleValue" in v) return v.doubleValue; if ("nullValue" in v) return null; return Object.values(v)[0]; };
const r = await fetch(`${B}:runQuery`, { method: "POST", headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "evaluaciones" }], where: { fieldFilter: { field: { fieldPath: "rutinaNombre" }, op: "EQUAL", value: { stringValue: "Reunión Especial Lixiviación" } } } } }) });
const docs = (await r.json()).filter((x) => x.document).map((x) => ({ id: x.document.name.split("/").pop(), upd: x.document.updateTime, ...Object.fromEntries(Object.entries(x.document.fields).map(([k, v]) => [k, de(v)])) }));
for (const d of docs.filter((x) => (x.upd || "") >= "2026-11-18" || /aguiar/i.test(JSON.stringify(x)))) {
  console.log("DOC", d.id, d.estado, "| form", d.formularioId, d.formulario?.nombre, "| rutina", d.rutinaNombre, "| lider", d.lider, "| paso", d.paso, "| actualizado", d.actualizado, "| updateTime", d.upd, "| creado", d.creado);
  console.log("  respuestas", Object.keys(d.respuestas || {}).length, "notas", (d.notas || []).length, "feedback", JSON.stringify(d.feedback || {}).slice(0, 400));
  console.log("  datos", JSON.stringify(d.datos || {}).slice(0, 300), "| liderTomo", d.liderTomoConocimiento, "| uid", d.evaluadorUid, d.registradoPorUid);
}
const rp = await fetch(`${B}:runQuery`, { method: "POST", headers: H, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "evaluaciones" }], where: { fieldFilter: { field: { fieldPath: "prueba" }, op: "EQUAL", value: { booleanValue: true } } } } }) });
for (const x of (await rp.json()).filter((x) => x.document)) { const id = x.document.name.split("/").pop(); if (id.startsWith("zz_prueba_permiso_")) console.log("DELETE prueba", id, (await fetch(`${B}/evaluaciones/${id}`, { method: "DELETE", headers: H })).status); }
// prueba de permisos: ¿se puede crear una evaluación borrador?
