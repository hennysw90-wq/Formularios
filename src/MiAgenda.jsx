import { useEffect, useMemo, useState } from "react";
import { listarFormulariosPublicados, listarEvaluacionesDesde } from "./evaluaciones.js";
import { listarAsignaciones, agendaDePersona, proyectarFormulario, etiquetaCadencia } from "./asignaciones.js";

export const TEXTO_PERIODO = { diaria: "hoy", semanal: "esta semana", quincenal: "esta quincena", mensual: "este mes", unica: "en total" };

// Las CdR de los últimos ~12 meses bastan para cualquier cadencia (incluida "una sola vez" reciente).
const desdeAgenda = () => new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10);

/** Datos de la agenda de una persona: sus asignaciones, lo que lleva en el periodo y los formularios publicados. */
export function useAgenda(usuario) {
  const [asignaciones, setAsignaciones] = useState(null);
  const [evals, setEvals] = useState([]);
  const [formularios, setFormularios] = useState([]);
  useEffect(() => listarAsignaciones(setAsignaciones, () => setAsignaciones([])), []);
  useEffect(() => listarEvaluacionesDesde(desdeAgenda(), setEvals, () => {}), []);
  useEffect(() => listarFormulariosPublicados(setFormularios, () => {}), []);
  const items = useMemo(() => {
    if (!asignaciones) return null;
    const publicados = new Map(formularios.map((f) => [f.id, f]));
    return agendaDePersona(asignaciones, usuario, evals)
      .filter((it) => publicados.has(it.asignacion.formularioId)) // un formulario en borrador todavía no se le pide
      .map((it) => ({ ...it, formulario: proyectarFormulario(publicados.get(it.asignacion.formularioId), asignaciones, usuario) }));
  }, [asignaciones, evals, formularios, usuario]);
  return items;
}

/**
 * Lo que le toca a la persona en el periodo vigente, asignación por asignación: cuántas lleva, cuántas le faltan
 * y un botón para hacer la CdR con la reunión ya puesta. Si no tiene asignaciones, no muestra nada.
 */
export default function MiAgenda({ usuario, onIniciar, onIrAMisCdR, compacto = false }) {
  const items = useAgenda(usuario);
  if (!items || items.length === 0) return null;
  const pendientes = items.reduce((s, it) => s + it.pendientes, 0);

  return (
    <div className="ca-card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: compacto ? 15 : 16 }}>Mis asignaciones</p>
        <span className={`ca-pill ${pendientes ? "ca-pill-ambar" : "ca-pill-verde"}`}>
          {pendientes ? `${pendientes} pendiente${pendientes === 1 ? "" : "s"}` : "✓ Todo al día"}
        </span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it) => {
          const a = it.asignacion;
          const periodo = TEXTO_PERIODO[it.frecuencia] || "";
          return (
            <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--borde)" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{a.reunionNombre}</div>
                <div style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>
                  {a.formularioNombre || it.formulario.nombre} · {etiquetaCadencia(it.cantidad, it.frecuencia)}
                  {(a.lideres || []).length ? ` · Líder: ${a.lideres.join(", ")}` : ""}
                </div>
              </div>
              <div style={{ flex: "0 0 auto", fontSize: 13.5, fontWeight: 700, color: !it.empezo ? "var(--texto-suave)" : it.completa ? "#0f6e56" : "#ba7517" }}>
                {!it.empezo
                  ? `Empieza el ${it.desde.split("-").reverse().join("-")}`
                  : it.completa
                  ? `✓ ${it.hechasEnPeriodo} de ${it.cantidad} ${periodo}`
                  : `${it.hechasEnPeriodo} de ${it.cantidad} ${periodo} · faltan ${it.pendientes}`}
              </div>
              {onIniciar && (
                <button className={`cdr-nav-btn ${it.pendientes ? "prim" : ""}`} onClick={() => onIniciar(it.formulario, a.reunionId)}>
                  Completar
                </button>
              )}
            </div>
          );
        })}
      </div>
      {onIrAMisCdR && pendientes > 0 && (
        <div style={{ marginTop: 12 }}>
          <button className="cdr-nav-btn prim" onClick={onIrAMisCdR}>Ir a hacer mis CdR →</button>
        </div>
      )}
    </div>
  );
}
