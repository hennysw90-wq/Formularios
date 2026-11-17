import { useState } from "react";
import { hechasEnAsignacion, hoyLocalISO } from "./asignaciones.js";
import { useConfirmarConClave } from "./ConfirmarConClave.jsx";

// Calendario de una asignación «Programado al azar»: cada día con quién le toca y si ya está hecha (✓),
// atrasada o por venir. Lo hecho sale de las evaluaciones enviadas (cuenta si la hizo ese día o después,
// antes de su siguiente fecha).

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ESTILO = {
  hecha: { background: "#E1F5EE", color: "#0F6E56", border: "1px solid #9FD8C4" },
  atrasada: { background: "#FAECE7", color: "#993C1D", border: "1px solid #F1C0B4" },
  hoy: { background: "#FAEEDA", color: "#8A5A12", border: "1px solid #F0D3A2" },
  futura: { background: "#F1EFE8", color: "#5F5E5A", border: "1px solid #E2DFD6" },
};
const corto = (n) => { const p = String(n || "").trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ""; };
const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

export default function CalendarioProgramado({ asignacion, evals, usuario = null, onGuardar = null }) {
  const hoy = hoyLocalISO();
  // Modo mover (pide clave): se arrastra un nombre a otro día (o se toca el nombre y luego el día). Solo lo que
  // todavía no está hecho y hacia hoy o después; al guardar queda como cambio de la asignación (con historial).
  const [modalClave, pedirClave] = useConfirmarConClave(usuario);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(null); // personas con fechas en edición
  const [elegido, setElegido] = useState(null); // { clave, fecha }
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const claveDe = (p) => p.uid || `n:${p.nombre}`;
  const base = editando && borrador ? borrador : asignacion.personas || [];
  const personas = base.filter((p) => (p.fechas || []).length);
  const items = personas.flatMap((p) => {
    const hechas = new Set(hechasEnAsignacion(asignacion, p, evals, "programada").map((h) => h.periodo));
    return (p.fechas || []).map((f) => ({ fecha: f, nombre: p.nombre, clave: claveDe(p), estado: hechas.has(f) ? "hecha" : f < hoy ? "atrasada" : f === hoy ? "hoy" : "futura" }));
  });
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [vista, setVista] = useState("calendario"); // "calendario" | "gantt"
  const meses = [...new Set(items.map((i) => i.fecha.slice(0, 7)))].sort();
  const inicial = meses.includes(hoy.slice(0, 7)) ? hoy.slice(0, 7) : meses[0] || hoy.slice(0, 7);
  const [mes, setMes] = useState(inicial);
  const [a, m] = mes.split("-").map(Number);
  const primero = new Date(a, m - 1, 1);
  const offset = (primero.getDay() + 6) % 7; // lunes primero
  const diasMes = new Date(a, m, 0).getDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  const delDia = (d) => items.filter((i) => i.fecha === `${mes}-${String(d).padStart(2, "0")}` && (!soloPendientes || i.estado !== "hecha"));
  const total = (e) => items.filter((i) => i.estado === e).length;
  const mover = (k) => { const i = meses.indexOf(mes); const n = meses[i + k]; if (n) setMes(n); };
  const movible = (it) => editando && it.estado !== "hecha" && it.fecha >= hoy;
  function moverA(destino) {
    if (!elegido || destino < hoy || destino === elegido.fecha) return setElegido(null);
    const p = borrador.find((x) => claveDe(x) === elegido.clave);
    if ((p?.fechas || []).includes(destino)) { setAviso(`${p.nombre} ya tiene ese día.`); return setElegido(null); }
    setBorrador((b) => b.map((x) => (claveDe(x) === elegido.clave ? { ...x, fechas: [...x.fechas.filter((f) => f !== elegido.fecha), destino].sort() } : x)));
    setAviso("");
    setElegido(null);
  }
  async function empezarEdicion() {
    if (!(await pedirClave("Mover días del calendario", "Para cambiar a alguien de día confirma con tu clave."))) return;
    setBorrador(JSON.parse(JSON.stringify(asignacion.personas || [])));
    setEditando(true);
    setAviso("");
  }
  async function guardar() {
    setGuardando(true);
    try {
      await onGuardar(borrador);
      setEditando(false);
      setBorrador(null);
      setAviso("✓ Calendario guardado.");
    } catch (e) {
      setAviso(`No se pudo guardar (${e.code || e.message}).`);
    } finally {
      setGuardando(false);
    }
  }
  const cambios = editando && borrador && JSON.stringify(borrador.map((p) => p.fechas || [])) !== JSON.stringify((asignacion.personas || []).map((p) => p.fechas || []));

  return (
    <div style={{ marginTop: 10, border: "1px solid #EEECE6", borderRadius: 10, padding: 10, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button style={btn} onClick={() => mover(-1)} disabled={meses.indexOf(mes) <= 0} aria-label="Mes anterior">‹</button>
        <b style={{ textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>{MESES[m - 1]} {a}</b>
        <button style={btn} onClick={() => mover(1)} disabled={meses.indexOf(mes) >= meses.length - 1} aria-label="Mes siguiente">›</button>
        <span style={{ ...ESTILO.hecha, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>✓ Hechas {total("hecha")}</span>
        <span style={{ ...ESTILO.atrasada, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Atrasadas {total("atrasada")}</span>
        <span style={{ ...ESTILO.futura, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Por venir {total("futura") + total("hoy")}</span>
        <div style={{ marginLeft: "auto", display: "flex", border: "1px solid var(--borde, #D3D1C7)", borderRadius: 8, overflow: "hidden" }}>
          {[["calendario", "📅 Calendario"], ["gantt", "▤ Gantt"]].map(([v, t]) => (
            <button key={v} type="button" onClick={() => setVista(v)} style={{ border: "none", padding: "5px 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: vista === v ? "var(--verde, #009899)" : "#fff", color: vista === v ? "#fff" : "inherit" }}>{t}</button>
          ))}
        </div>
        {onGuardar && !editando && <button type="button" style={btn} onClick={empezarEdicion}>✋ Mover días (pide clave)</button>}
        {editando && <>
          <button type="button" style={{ ...btn, background: "var(--verde, #009899)", color: "#fff", borderColor: "var(--verde, #009899)" }} disabled={!cambios || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
          <button type="button" style={btn} disabled={guardando} onClick={() => { setEditando(false); setBorrador(null); setElegido(null); setAviso(""); }}>Cancelar</button>
        </>}
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Ocultar las hechas
        </label>
      </div>
      {modalClave}
      {editando && <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600, color: "#8A5A12" }}>Modo mover: arrastra un nombre a otro día, o tócalo y luego toca el día (en Gantt, la casilla de su fila). Solo se mueve lo que no está hecho, a hoy o después.</p>}
      {aviso && <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: aviso.startsWith("✓") ? "#0F6E56" : "#993C1D" }}>{aviso}</p>}
      {vista === "gantt" ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left", padding: "2px 8px 2px 0", minWidth: 140 }}>Evaluador</th>
                {Array.from({ length: diasMes }, (_, i) => {
                  const dia = new Date(a, m - 1, i + 1);
                  const iso = `${mes}-${String(i + 1).padStart(2, "0")}`;
                  return (
                    <th key={i} style={{ width: 24, minWidth: 24, textAlign: "center", fontWeight: 700, color: iso === hoy ? "#8A5A12" : [0, 6].includes(dia.getDay()) ? "#B4B2A9" : "var(--texto-suave)" }}>
                      <div>{"DLMMJVS"[dia.getDay()]}</div><div>{i + 1}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.uid || p.nombre}>
                  <td style={{ position: "sticky", left: 0, background: "#fff", fontWeight: 700, fontSize: 12, padding: "2px 8px 2px 0", whiteSpace: "nowrap" }}>{p.nombre}</td>
                  {Array.from({ length: diasMes }, (_, i) => {
                    const iso = `${mes}-${String(i + 1).padStart(2, "0")}`;
                    const it = items.find((x) => x.nombre === p.nombre && x.fecha === iso && (!soloPendientes || x.estado !== "hecha"));
                    const finde = [0, 6].includes(new Date(a, m - 1, i + 1).getDay());
                    const sel = elegido && elegido.clave === claveDe(p) && elegido.fecha === iso;
                    const destino = editando && elegido && elegido.clave === claveDe(p) && !it && iso >= hoy;
                    return (
                      <td key={i} onClick={() => { if (!editando) return; if (it && movible(it)) setElegido(sel ? null : { clave: claveDe(p), fecha: iso }); else if (destino) moverA(iso); }}
                        title={it ? `${p.nombre} · ${iso.split("-").reverse().join("-")} · ${it.estado === "hecha" ? "hecha" : it.estado === "atrasada" ? "atrasada" : it.estado === "hoy" ? "le toca hoy" : "por venir"}` : ""}
                        style={{ height: 22, borderRadius: 4, textAlign: "center", fontWeight: 800, cursor: editando && ((it && movible(it)) || destino) ? "pointer" : "default", ...(it ? ESTILO[it.estado] : { background: destino ? "#E9F6F4" : finde ? "#F4F3EF" : "#FAFAF7" }), ...(sel ? { outline: "2px solid #009899" } : {}) }}>
                        {it ? (it.estado === "hecha" ? "✓" : "●") : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} style={{ fontSize: 11, fontWeight: 800, color: "var(--texto-suave)", textAlign: "center" }}>{d}</div>)}
        {celdas.map((d, i) => (
          <div key={i}
            onClick={() => d && elegido && moverA(`${mes}-${String(d).padStart(2, "0")}`)}
            onDragOver={(e) => { if (d && editando) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (d && elegido) moverA(`${mes}-${String(d).padStart(2, "0")}`); }}
            style={{ minHeight: 64, borderRadius: 8, padding: 4, cursor: elegido && d ? "pointer" : "default", background: d ? (`${mes}-${String(d).padStart(2, "0")}` === hoy ? "#FFFBF3" : elegido && `${mes}-${String(d).padStart(2, "0")}` >= hoy ? "#F4FBF9" : "#FAFAF7") : "transparent", border: d ? "1px solid #F1EFE8" : "none" }}>
            {d && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--texto-suave)" }}>{d}</div>}
            {d && delDia(d).map((it) => (
              <div key={it.nombre}
                draggable={movible(it)}
                onDragStart={() => setElegido({ clave: it.clave, fecha: it.fecha })}
                onClick={(e) => { if (!movible(it)) return; e.stopPropagation(); setElegido(elegido && elegido.clave === it.clave && elegido.fecha === it.fecha ? null : { clave: it.clave, fecha: it.fecha }); }}
                title={`${it.nombre} · ${it.estado === "hecha" ? "hecha" : it.estado === "atrasada" ? "atrasada" : it.estado === "hoy" ? "le toca hoy" : "por venir"}`}
                style={{ ...ESTILO[it.estado], borderRadius: 6, padding: "1px 4px", fontSize: 11, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: movible(it) ? "grab" : "default", ...(elegido && elegido.clave === it.clave && elegido.fecha === it.fecha ? { outline: "2px solid #009899" } : {}) }}>
                {it.estado === "hecha" ? "✓ " : ""}{corto(it.nombre)}
              </div>
            ))}
          </div>
        ))}
      </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {personas.map((p) => {
          const mias = items.filter((i) => i.nombre === p.nombre);
          return <span key={p.uid || p.nombre} className="ca-chip" style={{ fontSize: 12 }}>{p.nombre}: ✓ {mias.filter((i) => i.estado === "hecha").length} de {mias.length}{mias.some((i) => i.estado === "atrasada") ? ` · ${mias.filter((i) => i.estado === "atrasada").length} atrasada(s)` : ""}</span>;
        })}
      </div>
    </div>
  );
}
