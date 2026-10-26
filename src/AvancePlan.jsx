import { useEffect, useState } from "react";
import { listarPlanes } from "./planes.js";
import { listarEvaluacionesDesde } from "./evaluaciones.js";
import { hoyISO } from "./estadisticas.js";
import { mismaPersona } from "./compromisos.js";
import { tienePlan, cumplimientoMes, desdeHistorial, mesDe, etiquetaMes } from "./plan.js";
import { BarraPlan } from "./ResumenPlan.jsx";

/**
 * El plan de quien evalúa (si tiene uno) y cuánto lleva este mes. Se reconoce a la persona por su usuario,
 * por el asistente elegido de la lista o por su nombre (sirve también para quien entró por QR sin iniciar sesión).
 */
export function useAvancePlan(evaluador) {
  const [planes, setPlanes] = useState(null);
  const [evals, setEvals] = useState([]);
  const hoy = hoyISO();
  useEffect(() => listarPlanes(setPlanes, () => setPlanes([])), []);
  const plan = (planes || []).find((p) => tienePlan(p) && mismaPersona({ uid: p.uid, nombre: p.nombre }, evaluador)) || null;
  const uidPlan = plan ? plan.uid : "";
  useEffect(() => {
    if (!uidPlan) return undefined; // solo se leen las CdR del mes si la persona tiene plan
    return listarEvaluacionesDesde(desdeHistorial(hoy, 1), setEvals, () => {});
  }, [uidPlan, hoy]);
  if (!plan) return null;
  return { plan, c: cumplimientoMes(plan, evals, mesDe(hoy), hoy) };
}

const mesCorto = (c) => etiquetaMes(c.mes).split(" ")[0];

/**
 * Mensaje de avance del plan.
 *  - modo "linea": mientras evalúa ("llevas 2 de 4; con esta serían 3").
 *  - modo "enviada": al terminar ("con esta CdR llevas 3 de 4").
 * Si la persona no tiene plan, no muestra nada.
 */
export default function AvancePlan({ evaluador, modo = "linea" }) {
  const r = useAvancePlan(evaluador);
  if (!r) return null;
  const { c } = r;
  const mes = mesCorto(c);
  const soloRutinas = c.meta === 0;
  const pct = soloRutinas ? (c.rutinas.length ? (c.cubiertas * 100) / c.rutinas.length : 0) : c.pct;

  let mensaje;
  if (soloRutinas) {
    mensaje = <>Plan de {mes}: rutinas cubiertas <b>{c.cubiertas} de {c.rutinas.length}</b>.</>;
  } else if (modo === "enviada") {
    mensaje = c.hechas >= c.meta
      ? <>¡Cumpliste tu meta de {mes}! Llevas <b>{c.hechas} de {c.meta}</b> CdR.</>
      : <>Con esta CdR llevas <b>{c.hechas} de {c.meta}</b> este mes. Te {c.faltan === 1 ? "falta" : "faltan"} {c.faltan}.</>;
  } else if (c.hechas >= c.meta) {
    mensaje = <>Plan de {mes}: meta cumplida (<b>{c.hechas} de {c.meta}</b>). Esta es una más.</>;
  } else {
    mensaje = <>Plan de {mes}: llevas <b>{c.hechas} de {c.meta}</b> CdR. Con esta serían <b>{c.hechas + 1}</b>{c.hechas + 1 >= c.meta ? " y cumples tu meta" : ""}.</>;
  }
  const cumplido = c.estado === "cumplido";
  return (
    <div className={`cdr-avance ${modo} ${cumplido ? "ok" : ""}`} role="status">
      <div className="msg">{mensaje}</div>
      <div className="barra"><BarraPlan pct={pct} estado={c.estado} alto={modo === "enviada" ? 10 : 6} /></div>
    </div>
  );
}
