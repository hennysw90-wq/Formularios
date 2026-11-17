import { useState } from "react";

// Plan "Programado al azar": se eligen los días de la semana y hasta qué fecha; «Sortear» reparte cada día a un
// evaluador, al azar pero equitativo (todos con la misma cantidad, ±1). Se puede ajustar a mano quién va cada día.

const DIAS = [[1, "L"], [2, "M"], [3, "M"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const NOMBRE_DIA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const mini = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--texto-suave)", marginBottom: 3 };
const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

export const firmaSorteo = (plan, claves) => JSON.stringify([plan.desde || "", plan.hasta || "", [...(plan.dias || [])].sort(), [...claves].sort(), Number(plan.cantidad) || 1, plan.base || "semanal"]);
const fechaTxt = (f) => {
  const [a, m, d] = f.split("-").map(Number);
  return `${NOMBRE_DIA[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
};

/**
 * plan: { desde, hasta, dias }  ·  personas: las que siguen el plan común ({ clave, nombre, fechas })
 * desactualizado: true si cambió algo desde el último sorteo  ·  onSortear()  ·  onMover(fecha, deClave, aClave)
 */
export default function ProgramacionAzar({ plan, personas, desactualizado, onCambiar, onSortear, onMover, bloqueado = false, onDesbloquear }) {
  const [verCalendario, setVerCalendario] = useState(true);
  const dias = plan.dias || [];
  const calendario = personas.flatMap((p) => (p.fechas || []).map((f) => ({ fecha: f, clave: p.clave }))).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ marginTop: 8 }}>
      {bloqueado && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#fff", border: "1px solid #D3D1C7", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>
          <span style={{ flex: 1, fontSize: 13 }}>🔒 <b>Calendario fijo.</b> Se sorteó y guardó; no cambia salvo que lo pidas.</span>
          <button type="button" style={btn} onClick={onDesbloquear}>Cambiar calendario (pide clave)</button>
        </div>
      )}
      <fieldset disabled={bloqueado} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "0 0 80px" }}>
          <label style={mini}>Cantidad</label>
          <input className="rp-input" type="number" min="1" value={plan.cantidad ?? 1} onChange={(e) => onCambiar({ cantidad: e.target.value })} aria-label="Cantidad por periodo" />
        </div>
        <div style={{ flex: "0 0 150px" }}>
          <label style={mini}>Cada</label>
          <select className="rp-select" value={plan.base || "semanal"} onChange={(e) => onCambiar({ base: e.target.value })} aria-label="Frecuencia de la programación">
            <option value="diaria">Día</option>
            <option value="semanal">Semana</option>
            <option value="quincenal">Quincena</option>
            <option value="mensual">Mes</option>
          </select>
        </div>
        <div>
          <label style={mini}>Días de la semana *</label>
          <div style={{ display: "flex", gap: 4 }}>
            {DIAS.map(([n, t], i) => {
              const on = dias.includes(n);
              return (
                <button key={i} type="button" aria-pressed={on} aria-label={NOMBRE_DIA[n]}
                  onClick={() => onCambiar({ dias: on ? dias.filter((x) => x !== n) : [...dias, n] })}
                  style={{ width: 34, height: 34, borderRadius: 8, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", border: on ? "2px solid var(--verde, #009899)" : "1px solid var(--borde, #D3D1C7)", background: on ? "var(--verde, #009899)" : "#fff", color: on ? "#fff" : "inherit" }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label style={mini}>Programar hasta *</label>
          <input className="rp-input" type="date" value={plan.hasta || ""} min={plan.desde || hoy} onChange={(e) => onCambiar({ hasta: e.target.value })} aria-label="Programar hasta" />
        </div>
        <button type="button" style={{ ...btn, background: "var(--verde, #009899)", color: "#fff", borderColor: "var(--verde, #009899)" }} disabled={!plan.hasta || !dias.length || !personas.length} onClick={onSortear}>
          🎲 {calendario.length ? "Volver a sortear" : "Sortear calendario"}
        </button>
      </div>
      {desactualizado && calendario.length > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 700, color: "#BA7517" }}>Cambiaste los días, las fechas o los evaluadores: vuelve a sortear para que el calendario quede al día.</p>
      )}
      {!calendario.length && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--texto-suave)" }}>Elige cuántas veces por periodo, los días permitidos y hasta cuándo, y toca «Sortear calendario»: a cada evaluador le tocan sus días al azar dentro de cada periodo, repartiendo la carga entre los días.</p>}
      {calendario.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
            {personas.map((p) => <span key={p.clave} className="ca-chip" style={{ fontSize: 12 }}>{p.nombre} · {(p.fechas || []).length}</span>)}
            <button type="button" style={{ ...btn, padding: "3px 10px", fontSize: 12.5, marginLeft: "auto" }} onClick={() => setVerCalendario(!verCalendario)}>{verCalendario ? "Ocultar calendario" : `Ver calendario (${calendario.length} días)`}</button>
          </div>
          {verCalendario && (
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #EEECE6", borderRadius: 8, background: "#fff" }}>
              {calendario.map((c) => (
                <div key={c.fecha + c.clave} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 10px", borderBottom: "1px solid #F3F1EC", fontSize: 13, opacity: c.fecha < hoy ? 0.55 : 1 }}>
                  <span style={{ width: 86, fontWeight: 700, textTransform: "capitalize" }}>{fechaTxt(c.fecha)}</span>
                  <select className="rp-select" style={{ maxWidth: 260, padding: "4px 8px", fontSize: 13 }} value={c.clave} onChange={(e) => onMover(c.fecha, c.clave, e.target.value)} aria-label={`Evaluador del ${c.fecha}`}>
                    {personas.filter((p) => p.clave === c.clave || !(p.fechas || []).includes(c.fecha)).map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </fieldset>
    </div>
  );
}
