import { useState } from "react";
import { hechasEnAsignacion, hoyLocalISO } from "./asignaciones.js";

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

export default function CalendarioProgramado({ asignacion, evals }) {
  const hoy = hoyLocalISO();
  const personas = (asignacion.personas || []).filter((p) => (p.fechas || []).length);
  const items = personas.flatMap((p) => {
    const hechas = new Set(hechasEnAsignacion(asignacion, p, evals, "programada").map((h) => h.periodo));
    return (p.fechas || []).map((f) => ({ fecha: f, nombre: p.nombre, estado: hechas.has(f) ? "hecha" : f < hoy ? "atrasada" : f === hoy ? "hoy" : "futura" }));
  });
  const [soloPendientes, setSoloPendientes] = useState(false);
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

  return (
    <div style={{ marginTop: 10, border: "1px solid #EEECE6", borderRadius: 10, padding: 10, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button style={btn} onClick={() => mover(-1)} disabled={meses.indexOf(mes) <= 0} aria-label="Mes anterior">‹</button>
        <b style={{ textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>{MESES[m - 1]} {a}</b>
        <button style={btn} onClick={() => mover(1)} disabled={meses.indexOf(mes) >= meses.length - 1} aria-label="Mes siguiente">›</button>
        <span style={{ ...ESTILO.hecha, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>✓ Hechas {total("hecha")}</span>
        <span style={{ ...ESTILO.atrasada, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Atrasadas {total("atrasada")}</span>
        <span style={{ ...ESTILO.futura, borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>Por venir {total("futura") + total("hoy")}</span>
        <label style={{ marginLeft: "auto", fontSize: 13, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Ocultar las hechas
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} style={{ fontSize: 11, fontWeight: 800, color: "var(--texto-suave)", textAlign: "center" }}>{d}</div>)}
        {celdas.map((d, i) => (
          <div key={i} style={{ minHeight: 64, borderRadius: 8, padding: 4, background: d ? (`${mes}-${String(d).padStart(2, "0")}` === hoy ? "#FFFBF3" : "#FAFAF7") : "transparent", border: d ? "1px solid #F1EFE8" : "none" }}>
            {d && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--texto-suave)" }}>{d}</div>}
            {d && delDia(d).map((it) => (
              <div key={it.nombre} title={`${it.nombre} · ${it.estado === "hecha" ? "hecha" : it.estado === "atrasada" ? "atrasada" : it.estado === "hoy" ? "le toca hoy" : "por venir"}`}
                style={{ ...ESTILO[it.estado], borderRadius: 6, padding: "1px 4px", fontSize: 11, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.estado === "hecha" ? "✓ " : ""}{corto(it.nombre)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {personas.map((p) => {
          const mias = items.filter((i) => i.nombre === p.nombre);
          return <span key={p.uid || p.nombre} className="ca-chip" style={{ fontSize: 12 }}>{p.nombre}: ✓ {mias.filter((i) => i.estado === "hecha").length} de {mias.length}{mias.some((i) => i.estado === "atrasada") ? ` · ${mias.filter((i) => i.estado === "atrasada").length} atrasada(s)` : ""}</span>;
        })}
      </div>
    </div>
  );
}
