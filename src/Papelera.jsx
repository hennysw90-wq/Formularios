import { useEffect, useState } from "react";
import { listarPapelera, restaurarDePapelera, eliminarDePapelera, DIAS_PAPELERA } from "./papelera.js";

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const diasRestantes = (iso) => Math.max(0, Math.ceil((Date.parse(iso || "") + DIAS_PAPELERA * 86400000 - Date.now()) / 86400000));

// Papelera (solo Master): todo lo eliminado de los últimos 30 días, con opción de restaurar o borrar para siempre.
export default function Papelera({ usuario, pedirClave, onCerrar }) {
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState("todo");
  const [msg, setMsg] = useState("");
  const [haciendo, setHaciendo] = useState("");
  const cargar = () => listarPapelera().then(setLista).catch((e) => { setLista([]); setMsg(`No se pudo leer la papelera (${e.code || e.message}). ¿Está publicada su regla en Firestore?`); });
  useEffect(() => { cargar(); }, []);
  const visibles = (lista || []).filter((x) => filtro === "todo" || x.tipo === filtro);
  const n = (t) => (lista || []).filter((x) => x.tipo === t).length;

  async function restaurar(x) {
    if (!(await pedirClave(`Restaurar «${x.nombre}»`, "Vuelve a quedar como estaba antes de eliminarlo."))) return;
    setHaciendo(x.id); setMsg("");
    try { await restaurarDePapelera(x); setLista((l) => l.filter((y) => y.id !== x.id)); setMsg(`Listo: se restauró «${x.nombre}».`); }
    catch (e) { setMsg(`No se pudo restaurar (${e.code || e.message}).`); }
    setHaciendo("");
  }
  async function borrar(x) {
    if (!(await pedirClave(`Borrar para siempre «${x.nombre}»`, "Ya no se podrá recuperar."))) return;
    setHaciendo(x.id); setMsg("");
    try { await eliminarDePapelera(x.id); setLista((l) => l.filter((y) => y.id !== x.id)); setMsg(`Listo: «${x.nombre}» se borró para siempre.`); }
    catch (e) { setMsg(`No se pudo borrar (${e.code || e.message}).`); }
    setHaciendo("");
  }
  const chip = (k, t) => (
    <button key={k} type="button" onClick={() => setFiltro(k)} style={{ minHeight: 34, padding: "0 12px", borderRadius: 99, border: "1px solid #1D7A5F", background: filtro === k ? "#1D7A5F" : "#fff", color: filtro === k ? "#fff" : "#1D7A5F", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t}</button>
  );
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(10,25,22,.55)", display: "grid", placeItems: "center", padding: 12, overflowY: "auto" }} onClick={onCerrar}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 18, width: "min(680px,100%)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <b style={{ fontSize: 18 }}>🗑 Papelera</b>
        <p style={{ fontSize: 13, color: "#4A5C59", margin: "6px 0 10px" }}>Cada vez que se elimina una evaluación ejecutada o un formulario se guarda una copia por {DIAS_PAPELERA} días. Pasado ese plazo se borra sola. Restaurar pide tu clave.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {chip("todo", `Todo (${(lista || []).length})`)}{chip("evaluacion", `Evaluaciones (${n("evaluacion")})`)}{chip("formulario", `Formularios (${n("formulario")})`)}
        </div>
        {lista === null && <p style={{ fontSize: 14 }}>Cargando…</p>}
        {lista && !visibles.length && <p style={{ fontSize: 14, color: "#4A5C59" }}>La papelera está vacía.</p>}
        {visibles.map((x) => (
          <div key={x.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", border: "1px solid #CBD6D3", borderRadius: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}>
              <b>{x.tipo === "evaluacion" ? "Evaluación" : "Formulario"}</b> · {x.nombre}<br />
              <span style={{ fontSize: 12, color: "#4A5C59" }}>eliminada el {fechaHora(x.eliminadoEn)}{x.eliminadoPor ? ` por ${x.eliminadoPor}` : ""}{x.detalle ? ` · enviada el ${fechaHora(x.detalle)}` : ""} · quedan {diasRestantes(x.eliminadoEn)} días</span>
            </span>
            <button type="button" disabled={!!haciendo} onClick={() => restaurar(x)} style={{ minHeight: 36, padding: "0 12px", border: "1px solid #1D7A5F", borderRadius: 8, background: "#fff", color: "#1D7A5F", fontWeight: 800, cursor: "pointer" }}>{haciendo === x.id ? "…" : "Restaurar"}</button>
            <button type="button" disabled={!!haciendo} onClick={() => borrar(x)} title="Borrar para siempre" style={{ minHeight: 36, padding: "0 10px", border: "1px solid #C0392B", borderRadius: 8, background: "#fff", color: "#C0392B", fontWeight: 800, cursor: "pointer" }}>✕</button>
          </div>
        ))}
        {msg && <p style={{ fontWeight: 700, fontSize: 13.5, color: /^Listo/.test(msg) ? "#1D7A5F" : "#C0392B" }}>{msg}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" onClick={onCerrar} style={{ minHeight: 40, padding: "0 14px", border: "1px solid #BFCBC8", borderRadius: 8, background: "#fff", fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
