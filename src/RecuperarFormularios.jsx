import { useEffect, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db, asegurarSesionCdR } from "./firebase.js";

const COL_FORMS = "cdrFormularios";
const COL_EVALS = "cdrEvaluaciones";

// Cada evaluación guarda una copia del formulario con el que se hizo. Con esa copia se reconstruyen los formularios
// borrados por error: se toma, de cada formulario que ya no existe, la copia de su evaluación más reciente.
async function buscarRecuperables() {
  await asegurarSesionCdR();
  const [fs, es] = await Promise.all([getDocs(collection(db, COL_FORMS)), getDocs(collection(db, COL_EVALS))]);
  const existentes = new Set(fs.docs.map((d) => d.id));
  const por = new Map();
  for (const d of es.docs) {
    const e = d.data(), id = e.formularioId, snap = e.formulario;
    if (!id || existentes.has(id) || !snap || !Array.isArray(snap.bloques)) continue;
    const t = e.fechaEnvio || e.actualizado || "";
    const o = por.get(id) || { id, n: 0, ultima: "", snap: null, version: -1 };
    o.n += 1;
    // la copia más nueva: mayor versión; a igual versión, la evaluación más reciente
    if ((snap.version || 1) > o.version || ((snap.version || 1) === o.version && t > o.ultima)) { o.snap = snap; o.version = snap.version || 1; o.ultima = t; }
    else if (t > o.ultima) o.ultima = t;
    por.set(id, o);
  }
  return [...por.values()].sort((a, b) => (b.ultima || "").localeCompare(a.ultima || ""));
}

async function restaurar(o, quien) {
  const { id, evaluadores, ...resto } = JSON.parse(JSON.stringify(o.snap));
  const ahora = new Date().toISOString();
  await setDoc(doc(db, COL_FORMS, o.id), {
    ...resto,
    estado: "publicado",
    version: o.version,
    creado: ahora,
    actualizado: ahora,
    creadoPor: `${quien || "—"} (recuperado)`,
    asignados: evaluadores || [],
    asignadosUids: (evaluadores || []).map((x) => x.uid).filter(Boolean),
  });
}

const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

export default function RecuperarFormularios({ usuario, pedirClave, onCerrar }) {
  const [lista, setLista] = useState(null);
  const [sel, setSel] = useState(() => new Set());
  const [msg, setMsg] = useState("");
  const [haciendo, setHaciendo] = useState(false);
  useEffect(() => {
    buscarRecuperables().then((l) => { setLista(l); setSel(new Set(l.map((x) => x.id))); }).catch((e) => { setLista([]); setMsg(`No se pudo leer (${e.code || e.message}).`); });
  }, []);
  async function hacer() {
    const elegidos = (lista || []).filter((x) => sel.has(x.id));
    if (!elegidos.length) { setMsg("Marca al menos un formulario."); return; }
    if (!(await pedirClave(`Recuperar ${elegidos.length} formulario${elegidos.length > 1 ? "s" : ""}`, "Se vuelven a crear con el mismo identificador, publicados; las asignaciones y los QR que ya existían vuelven a funcionar."))) return;
    setHaciendo(true); setMsg("");
    try {
      await asegurarSesionCdR();
      for (const o of elegidos) await restaurar(o, usuario.nombreUsuario);
      setMsg(`Listo: se recuperaron ${elegidos.length} formulario${elegidos.length > 1 ? "s" : ""}.`);
      setLista((l) => l.filter((x) => !sel.has(x.id))); setSel(new Set());
    } catch (e) { setMsg(`No se pudo recuperar (${e.code || e.message}).`); }
    setHaciendo(false);
  }
  const alternar = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(10,25,22,.55)", display: "grid", placeItems: "center", padding: 12, overflowY: "auto" }} onClick={onCerrar}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 18, width: "min(640px,100%)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <b style={{ fontSize: 18 }}>♻ Recuperar formularios borrados</b>
        <p style={{ fontSize: 13, color: "#4A5C59", margin: "6px 0 10px" }}>Se reconstruyen desde la copia que guardó cada evaluación ya hecha. Solo se pueden recuperar los formularios que tuvieron al menos una evaluación.</p>
        {lista === null && <p style={{ fontSize: 14 }}>Buscando…</p>}
        {lista && !lista.length && !msg && <p style={{ fontSize: 14 }}>No se encontraron formularios para recuperar: o no falta ninguno, o los borrados no tuvieron evaluaciones.</p>}
        {lista && lista.map((o) => (
          <label key={o.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", border: "1px solid #CBD6D3", borderRadius: 10, marginBottom: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={sel.has(o.id)} onChange={() => alternar(o.id)} style={{ width: 20, height: 20 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{o.snap.nombre || "(sin nombre)"}</b>{o.snap.sigla ? ` · ${o.snap.sigla}` : ""}<br />
              <span style={{ fontSize: 12.5, color: "#4A5C59" }}>versión {o.version} · {o.n} evaluación{o.n === 1 ? "" : "es"} · última {fechaCorta(o.ultima)} · {(o.snap.bloques || []).reduce((n, b) => n + (b.criterios || []).length, 0)} criterios</span>
            </span>
          </label>
        ))}
        {msg && <p style={{ fontWeight: 700, fontSize: 13.5, color: /^Listo/.test(msg) ? "#1D7A5F" : "#C0392B" }}>{msg}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
          <button type="button" onClick={onCerrar} style={{ minHeight: 40, padding: "0 14px", border: "1px solid #BFCBC8", borderRadius: 8, background: "#fff", fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
          {lista && lista.length > 0 && <button type="button" disabled={haciendo} onClick={hacer} style={{ minHeight: 40, padding: "0 14px", border: 0, borderRadius: 8, background: "#1D7A5F", color: "#fff", fontWeight: 800, cursor: "pointer" }}>{haciendo ? "Recuperando…" : "Recuperar seleccionados"}</button>}
        </div>
      </div>
    </div>
  );
}
