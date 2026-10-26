import { useEffect, useState } from "react";
import { escucharPlan } from "./planes.js";
import { listarEvaluacionesDesde } from "./evaluaciones.js";
import { hoyISO } from "./estadisticas.js";
import { tienePlan, cumplimientoMes, historialPlan, desdeHistorial, mesDe, etiquetaMes, etiquetaMesCorta, ETIQUETA_ESTADO } from "./plan.js";

export const CLASE_ESTADO_PLAN = { cumplido: "ca-pill-verde", al_dia: "ca-pill-verde", atrasado: "ca-pill-ambar", no_cumplido: "ca-pill-rojo", pendiente: "", sin_plan: "" };
const COLOR_ESTADO = { cumplido: "#0f6e56", al_dia: "#0f6e56", atrasado: "#ba7517", no_cumplido: "#993c1d", pendiente: "#8b8a85", sin_plan: "#8b8a85" };

export function BarraPlan({ pct, estado, alto = 10 }) {
  return (
    <div style={{ height: alto, background: "var(--fondo)", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, height: "100%", borderRadius: 6, background: COLOR_ESTADO[estado] || COLOR_ESTADO.pendiente }} />
    </div>
  );
}

/** Texto corto del avance de un mes: "2 de 4 CdR" o, si el plan es solo de rutinas, "1 de 2 rutinas". */
const rutinasTexto = (n) => `${n} ${n === 1 ? "rutina" : "rutinas"}`;
export function textoAvance(c) {
  return c.meta > 0 ? `${c.hechas} de ${c.meta} CdR` : `${c.cubiertas} de ${rutinasTexto(c.rutinas.length)}`;
}

/**
 * Resumen del plan de cumplimiento de quien evalúa: cuántas CdR lleva este mes frente a su meta,
 * qué rutinas le faltan y cómo le fue los meses anteriores. Si la persona no tiene plan, no muestra nada.
 */
export default function ResumenPlan({ usuario, compacto = false, onHacerCdR }) {
  const [plan, setPlan] = useState(undefined); // undefined = cargando
  const [evals, setEvals] = useState([]);
  const hoy = hoyISO();
  const activo = tienePlan(plan);

  useEffect(() => escucharPlan(usuario.uid, setPlan, () => setPlan(null)), [usuario.uid]);
  useEffect(() => {
    if (!activo) return undefined; // solo se leen las CdR si la persona tiene plan
    return listarEvaluacionesDesde(desdeHistorial(hoy), setEvals, () => {});
  }, [activo, usuario.uid, hoy]);

  if (!activo) return null;
  const c = cumplimientoMes(plan, evals, mesDe(hoy), hoy);
  const etiqueta = ETIQUETA_ESTADO[c.estado];
  const pill = <span className={`ca-pill ${CLASE_ESTADO_PLAN[c.estado]}`}>{c.estado === "cumplido" ? "✓ " : ""}{etiqueta}</span>;
  const mes = etiquetaMes(c.mes).split(" ")[0];

  if (compacto) {
    return (
      <div className="ca-card" style={{ marginBottom: 14, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <b>Mi plan de {mes}</b>
        <span style={{ fontSize: 14 }}>{textoAvance(c)}</span>
        <div style={{ flex: "1 1 120px", minWidth: 100 }}><BarraPlan pct={c.meta > 0 ? c.pct : c.rutinas.length ? (c.cubiertas * 100) / c.rutinas.length : 0} estado={c.estado} /></div>
        {pill}
      </div>
    );
  }

  const historial = historialPlan(plan, evals, hoy, 3);
  return (
    <div className="ca-card">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Mi plan de {etiquetaMes(c.mes)}</p>
        {pill}
      </div>

      {c.meta > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{c.hechas}</span>
            <span style={{ fontSize: 16, color: "var(--texto-suave)" }}>de {c.meta} CdR este mes</span>
          </div>
          <div style={{ margin: "10px 0 6px" }}><BarraPlan pct={c.pct} estado={c.estado} /></div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--texto-suave)" }}>
            {c.faltan > 0 ? `Te ${c.faltan === 1 ? "falta" : "faltan"} ${c.faltan} CdR` : "Meta de CdR cumplida"}
            {c.diasRestantes > 0 ? ` · ${c.diasRestantes === 1 ? "queda" : "quedan"} ${c.diasRestantes} día${c.diasRestantes === 1 ? "" : "s"} del mes` : ""}
          </p>
        </>
      )}

      {c.rutinas.length > 0 && (
        <div style={{ marginTop: c.meta > 0 ? 14 : 0 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13.5 }}>Rutinas que debes cubrir este mes ({c.cubiertas} de {c.rutinas.length})</p>
          <div style={{ display: "grid", gap: 4 }}>
            {c.rutinas.map((r) => (
              <div key={r.sesionId || r.nombre} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 14, color: r.hecha ? "#0f6e56" : "var(--texto)" }}>
                <span style={{ flexShrink: 0, fontWeight: 800 }}>{r.hecha ? "✓" : "○"}</span>
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{r.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>Meses anteriores:</span>
        {historial.map((h) => (
          <span key={h.mes} className={`ca-pill ${CLASE_ESTADO_PLAN[h.estado]}`} title={`${etiquetaMes(h.mes)}: ${ETIQUETA_ESTADO[h.estado]}`}>
            {etiquetaMesCorta(h.mes)} · {h.meta > 0 ? `${h.hechas}/${h.meta}` : `${h.cubiertas}/${rutinasTexto(h.rutinas.length)}`} {h.estado === "cumplido" ? "✓" : "✗"}
          </span>
        ))}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--texto-suave)" }}>Los meses anteriores se miden con tu plan actual.</p>

      {onHacerCdR && (
        <div style={{ marginTop: 14 }}>
          <button className="cdr-nav-btn prim" onClick={onHacerCdR}>Hacer una CdR →</button>
        </div>
      )}
    </div>
  );
}
