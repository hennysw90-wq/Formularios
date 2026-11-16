import { useState } from "react";
import { FRECUENCIAS, etiquetaCadencia, esLaPersona } from "./asignaciones.js";
import AlcanceEvaluador from "./AlcanceEvaluador.jsx";

// Asignación masiva: un mismo plan (cantidad, frecuencia, desde y, si el formulario se asigna por listado, su
// alcance) para varias personas a la vez. Las que ya están en la asignación quedan con el plan nuevo.
// Opcionalmente habilita el acceso a la app a quienes no lo tengan.

const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const mini = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--texto-suave)", marginBottom: 3 };
const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnPrim = { ...btn, background: "var(--verde, #009899)", borderColor: "var(--verde, #009899)", color: "#fff" };

export default function PlanMasivo({ activos, elegidos, campo, datosCampo, tieneAcceso, onAplicar, onCerrar, soloPersonas = false }) {
  const [plan, setPlan] = useState({ cantidad: 1, frecuencia: "semanal", desde: "", hasta: "", alcance: { opciones: [], subareas: [] } });
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState([]); // uids
  const [habilitar, setHabilitar] = useState(true);
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const q = sinTildes(busca.trim());
  const resultados = q.length >= 2 ? activos.filter((u) => sinTildes(`${u.nombreUsuario} ${u.area || ""} ${u.cargo || ""}`).includes(q)).slice(0, 200) : [];
  const porUid = new Map(activos.map((u) => [u.uid, u]));
  const seleccion = marcados.map((uid) => porUid.get(uid)).filter(Boolean);
  const yaEstan = seleccion.filter((u) => elegidos.some((p) => esLaPersona(p, u)));
  const sinAcceso = seleccion.filter((u) => !tieneAcceso(u));
  const alterna = (uid) => setMarcados((m) => (m.includes(uid) ? m.filter((x) => x !== uid) : [...m, uid]));

  async function aplicar() {
    setError("");
    if (!seleccion.length) return setError("Marca al menos una persona.");
    if (soloPersonas) {
      setTrabajando(true);
      try {
        await onAplicar(seleccion, null, habilitar);
        setMarcados([]);
        setBusca("");
      } finally {
        setTrabajando(false);
      }
      return;
    }
    if (!(Number(plan.cantidad) >= 1)) return setError("Pon una cantidad válida.");
    if (plan.frecuencia === "unica" && !plan.hasta) return setError("Pon hasta qué fecha tienen para ejecutarlo (plazo).");
    if (campo && !plan.alcance.opciones.length && !plan.alcance.subareas.length) return setError(`Elige qué ${campo.etiqueta.toLowerCase()} les tocan.`);
    setTrabajando(true);
    try {
      await onAplicar(seleccion, { ...plan, cantidad: Math.max(1, Math.floor(Number(plan.cantidad)) || 1), hasta: plan.frecuencia === "unica" ? plan.hasta : "", ...(campo ? {} : { alcance: undefined }) }, habilitar);
      setMarcados([]);
      setBusca("");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div style={{ border: "1.5px solid var(--verde, #009899)", borderRadius: 10, padding: 12, margin: "8px 0 12px", background: "#F4FBF9" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <b style={{ flex: 1 }}>{soloPersonas ? "Agregar varios evaluadores (con el plan común)" : "Agregar varios con el mismo plan"}</b>
        <button style={{ ...btn, padding: "4px 10px" }} onClick={onCerrar}>Cerrar</button>
      </div>

      {!soloPersonas && (<>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 86px" }}>
          <label style={mini}>Cantidad</label>
          <input className="rp-input" type="number" min="1" value={plan.cantidad} onChange={(e) => setPlan({ ...plan, cantidad: e.target.value })} aria-label="Cantidad del plan masivo" />
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <label style={mini}>Frecuencia</label>
          <select className="rp-select" value={plan.frecuencia} onChange={(e) => setPlan({ ...plan, frecuencia: e.target.value })} aria-label="Frecuencia del plan masivo">
            {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label style={mini}>{plan.frecuencia === "unica" ? "Ejecutar desde" : "Controlar desde"}</label>
          <input className="rp-input" type="date" value={plan.desde} onChange={(e) => setPlan({ ...plan, desde: e.target.value })} aria-label="Desde del plan masivo" />
        </div>
        {plan.frecuencia === "unica" && (
          <div style={{ flex: "0 0 160px" }}>
            <label style={mini}>Hasta (plazo) *</label>
            <input className="rp-input" type="date" value={plan.hasta} min={plan.desde || undefined} onChange={(e) => setPlan({ ...plan, hasta: e.target.value })} aria-label="Hasta del plan masivo" />
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#0f6e56", fontWeight: 600, marginTop: 4 }}>{etiquetaCadencia(plan.cantidad || 1, plan.frecuencia, plan.frecuencia === "unica" ? plan.hasta : "")}</div>
      {campo && <AlcanceEvaluador etiqueta={campo.etiqueta} nombre="el plan masivo" datos={datosCampo} alcance={plan.alcance} onCambiar={(al) => setPlan({ ...plan, alcance: al })} />}
      </>)}

      <div style={{ marginTop: 12 }}>
        <label style={mini}>Personas ({seleccion.length} marcada{seleccion.length === 1 ? "" : "s"})</label>
        {seleccion.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            {seleccion.map((u) => (
              <span key={u.uid} className="ca-chip" style={{ fontWeight: 600 }}>
                {u.nombreUsuario}{!tieneAcceso(u) ? " · sin acceso" : ""}{elegidos.some((p) => esLaPersona(p, u)) ? " · ya está" : ""}
                <button style={{ border: "none", background: "none", cursor: "pointer", marginLeft: 4 }} aria-label={`Desmarcar ${u.nombreUsuario}`} onClick={() => alterna(u.uid)}>✕</button>
              </span>
            ))}
          </div>
        )}
        <input className="rp-input" style={{ maxWidth: 420 }} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por nombre, área o cargo…" aria-label="Buscar personas para el plan masivo" />
        {q.length >= 2 && (
          <div style={{ maxWidth: 520, border: "1px solid #D3D1C7", borderRadius: 8, marginTop: 4, background: "#fff", maxHeight: 260, overflowY: "auto" }}>
            {resultados.length > 1 && (
              <button style={{ ...btn, border: "none", borderBottom: "1px solid #EEECE6", borderRadius: 0, width: "100%", textAlign: "left", color: "var(--verde-oscuro, #0F6E56)" }}
                onClick={() => setMarcados((m) => [...new Set([...m, ...resultados.map((u) => u.uid)])])}>
                ✓ Marcar los {resultados.length} resultados
              </button>
            )}
            {resultados.map((u) => (
              <label key={u.uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 13.5, cursor: "pointer", borderBottom: "1px solid #F3F1EC" }}>
                <input type="checkbox" checked={marcados.includes(u.uid)} onChange={() => alterna(u.uid)} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}><b>{u.nombreUsuario}</b>{u.area ? <span style={{ color: "var(--texto-suave)" }}> · {u.area}</span> : null}</span>
                {!tieneAcceso(u) && <span className="ca-pill ca-pill-ambar" style={{ fontSize: 11 }}>Sin acceso</span>}
              </label>
            ))}
            {resultados.length === 0 && <div style={{ padding: "8px 10px", fontSize: 13, color: "var(--texto-suave)" }}>Nadie coincide con esa búsqueda.</div>}
          </div>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13.5, marginTop: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={habilitar} onChange={(e) => setHabilitar(e.target.checked)} style={{ flexShrink: 0, marginTop: 3 }} />
        Habilitar acceso a la app a quienes no lo tengan{sinAcceso.length ? ` (${sinAcceso.length})` : ""}
      </label>
      {error && <p style={{ color: "var(--rojo)", fontSize: 13.5, fontWeight: 600, margin: "8px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button style={btnPrim} disabled={trabajando || !seleccion.length} onClick={aplicar}>
          {trabajando ? "Aplicando…" : soloPersonas ? `Agregar ${seleccion.length} persona${seleccion.length === 1 ? "" : "s"}` : `Aplicar plan a ${seleccion.length} persona${seleccion.length === 1 ? "" : "s"}`}
        </button>
        {yaEstan.length > 0 && <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{yaEstan.length} ya está{yaEstan.length === 1 ? "" : "n"} en la asignación{soloPersonas ? "" : ": se les actualiza el plan"}.</span>}
      </div>
    </div>
  );
}
