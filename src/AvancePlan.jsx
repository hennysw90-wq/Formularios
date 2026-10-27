import { useEffect, useState } from "react";
import { listarEvaluacionesDesde } from "./evaluaciones.js";
import { listarAsignaciones, agendaDePersona, esLaPersona } from "./asignaciones.js";
import { TEXTO_PERIODO } from "./MiAgenda.jsx";

const desde = () => new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10);

/**
 * Avance de la asignación con que se está evaluando (mismo formulario, misma reunión, mismo evaluador).
 *  - modo "linea": mientras evalúa ("llevas 1 de 2 esta semana; con esta serían 2").
 *  - modo "enviada": al terminar ("con esta CdR llevas 2 de 2 esta semana").
 * Si esa evaluación no corresponde a ninguna asignación, no muestra nada.
 */
export default function AvancePlan({ evaluador, formularioId, rutinaSesionId, modo = "linea" }) {
  const [asignaciones, setAsignaciones] = useState(null);
  const [evals, setEvals] = useState([]);
  useEffect(() => listarAsignaciones(setAsignaciones, () => setAsignaciones([])), []);
  useEffect(() => listarEvaluacionesDesde(desde(), setEvals, () => {}), []);

  if (!asignaciones || !rutinaSesionId || !(evaluador?.nombre || evaluador?.uid)) return null;
  const a = asignaciones.find(
    (x) => x.formularioId === formularioId && x.reunionId === rutinaSesionId && (x.personas || []).some((p) => esLaPersona(p, evaluador))
  );
  if (!a) return null;
  const it = agendaDePersona([a], evaluador, evals)[0];
  if (!it || !it.empezo) return null;

  const periodo = TEXTO_PERIODO[it.frecuencia] || "";
  const lleva = it.hechasReales;
  let mensaje;
  if (modo === "enviada") {
    mensaje = it.completa
      ? <>¡Cumpliste lo de {periodo}! Llevas <b>{lleva} de {it.cantidad}</b> en {a.reunionNombre}.</>
      : <>Con esta CdR llevas <b>{lleva} de {it.cantidad}</b> {periodo} en {a.reunionNombre}. Te {it.pendientes === 1 ? "falta" : "faltan"} {it.pendientes}.</>;
  } else if (it.completa) {
    mensaje = <>{a.reunionNombre}: ya cumpliste lo de {periodo} (<b>{lleva} de {it.cantidad}</b>). Esta es una más.</>;
  } else {
    mensaje = <>{a.reunionNombre}: llevas <b>{lleva} de {it.cantidad}</b> {periodo}. Con esta serían <b>{lleva + 1}</b>{lleva + 1 >= it.cantidad ? " y cumples" : ""}.</>;
  }
  const pct = Math.min(100, (lleva * 100) / it.cantidad);
  return (
    <div className={`cdr-avance ${modo} ${it.completa ? "ok" : ""}`} role="status">
      <div className="msg">{mensaje}</div>
      <div className="barra">
        <div style={{ height: modo === "enviada" ? 10 : 6, background: "var(--fondo)", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: it.completa ? "#0f6e56" : "#ba7517" }} />
        </div>
      </div>
    </div>
  );
}
