import { useEffect, useMemo, useState } from "react";
import { listarPlanes, guardarPlan, quitarPlan } from "./planes.js";
import { hoyISO } from "./estadisticas.js";
import { filasPlan, personasSinAcceso, resumenPlanes, mesDe, mesAnterior, etiquetaMes, ETIQUETA_ESTADO } from "./plan.js";
import { BarraPlan, CLASE_ESTADO_PLAN, textoAvance } from "./ResumenPlan.jsx";

const claveRutina = (r) => r.sesionId || r.nombre;

/**
 * Para Excelencia: asignar a cada evaluador una meta mensual de CdR y/o rutinas que debe cubrir cada mes,
 * y ver cuánto lleva en el mes elegido.
 */
export default function PlanEvaluadores({ todas, formularios, usuario, usuarios = null, errorUsuarios = false }) {
  const hoy = hoyISO();
  const [planes, setPlanes] = useState(null);
  const [error, setError] = useState("");
  const [mes, setMes] = useState(mesDe(hoy));
  const [edits, setEdits] = useState({}); // uid → { meta, rutinas } con lo que se está editando y aún no se guarda
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const [metaTodos, setMetaTodos] = useState("4");

  useEffect(
    () =>
      listarPlanes(setPlanes, (e) =>
        setError(e.code === "permission-denied" ? "Sin permiso para leer los planes. Revisa las reglas de Firestore (colección asignaciones)." : `No se pudieron cargar los planes (${e.code || e.message}).`)
      ),
    []
  );

  // La lista sale de Administración: todas las personas que hoy tienen el tick de la CdR (si se les quita el tick,
  // se deshabilitan o se eliminan, desaparecen). Se actualiza en vivo con el directorio de usuarios.
  const cargandoDirectorio = !Array.isArray(usuarios) && !errorUsuarios;
  const directorio = Array.isArray(usuarios) ? usuarios : null;
  const filas = useMemo(
    () => (cargandoDirectorio ? [] : filasPlan(formularios, planes || [], todas, mes, hoy, directorio)),
    [formularios, planes, todas, mes, hoy, directorio, cargandoDirectorio]
  );
  const ocultas = directorio ? personasSinAcceso(formularios, planes || [], directorio) : 0;
  const resumen = resumenPlanes(filas);
  const meses = Array.from({ length: 12 }, (_, i) => mesAnterior(mesDe(hoy), i));

  const guardadoDe = (f) => ({ meta: f.plan?.metaMensual ? String(f.plan.metaMensual) : "", rutinas: f.plan?.rutinas || [] });
  const valorDe = (f) => edits[f.uid] || guardadoDe(f);
  const cambioDe = (f, v) => {
    const g = guardadoDe(f);
    return String(Math.floor(Number(v.meta)) || "") !== String(Math.floor(Number(g.meta)) || "") || v.rutinas.map(claveRutina).sort().join("|") !== g.rutinas.map(claveRutina).sort().join("|");
  };
  const editar = (f, parcial) => {
    setAviso({ tipo: "", texto: "" });
    setEdits((e) => ({ ...e, [f.uid]: { ...valorDe(f), ...parcial } }));
  };
  const descartar = (uid) => setEdits(({ [uid]: _, ...resto }) => resto);

  async function guardar(f) {
    const v = valorDe(f);
    const meta = Math.floor(Number(v.meta)) || 0;
    if (meta <= 0 && v.rutinas.length === 0) {
      setAviso({ tipo: "error", texto: `Para ${f.nombre}, define una meta mensual o al menos una rutina.` });
      return;
    }
    setOcupado(f.uid);
    try {
      await guardarPlan({ uid: f.uid, nombre: f.nombre, metaMensual: meta, rutinas: v.rutinas, actualizadoPor: usuario?.nombreUsuario });
      descartar(f.uid);
      setAviso({ tipo: "ok", texto: `Plan de ${f.nombre} guardado.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo guardar el plan de ${f.nombre} (${e.code || e.message}).` });
    } finally {
      setOcupado("");
    }
  }

  async function quitar(f) {
    if (!window.confirm(`¿Quitar el plan de ${f.nombre}? Dejará de verse su resumen de cumplimiento.`)) return;
    setOcupado(f.uid);
    try {
      await quitarPlan(f.uid);
      descartar(f.uid);
      setAviso({ tipo: "ok", texto: `Plan de ${f.nombre} eliminado.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo quitar el plan (${e.code || e.message}).` });
    } finally {
      setOcupado("");
    }
  }

  // La asignación masiva es solo para quienes ya tienen un formulario asignado (si no, no podrían cumplir la meta).
  const sinPlan = filas.filter((f) => f.formularios.length > 0 && !f.plan);
  async function aplicarATodos() {
    const meta = Math.floor(Number(metaTodos)) || 0;
    if (meta <= 0) return setAviso({ tipo: "error", texto: "Escribe una meta mensual mayor que 0." });
    if (!window.confirm(`¿Asignar ${meta} CdR al mes a los ${sinPlan.length} evaluadores que aún no tienen plan?`)) return;
    setOcupado("todos");
    try {
      for (const f of sinPlan) await guardarPlan({ uid: f.uid, nombre: f.nombre, metaMensual: meta, rutinas: [], actualizadoPor: usuario?.nombreUsuario });
      setAviso({ tipo: "ok", texto: `Plan de ${meta} CdR al mes asignado a ${sinPlan.length} evaluador${sinPlan.length === 1 ? "" : "es"}.` });
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo asignar a todos (${e.code || e.message}).` });
    } finally {
      setOcupado("");
    }
  }


  return (
    <div>
      <p style={ayuda}>
        Define cuántas CdR debe hacer cada evaluador por mes y, si quieres, qué rutinas debe cubrir al menos una vez al mes. Cada evaluador ve su cumplimiento en su Inicio.
      </p>
      {error && <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>}
      {errorUsuarios && <p style={{ color: "var(--rojo)", fontSize: 14 }}>No se pudo leer el directorio de usuarios: podrían verse personas que ya no tienen acceso a la CdR.</p>}
      {aviso.texto && <p style={{ fontSize: 14, fontWeight: 600, color: aviso.tipo === "error" ? "var(--rojo)" : "#0f6e56", margin: "0 0 10px" }}>{aviso.texto}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Kpi titulo="Evaluadores" valor={resumen.evaluadores} />
        <Kpi titulo="Con plan" valor={resumen.conPlan} />
        <Kpi titulo="Cumplido" valor={resumen.cumplido} color="#0f6e56" />
        <Kpi titulo="Al día" valor={resumen.al_dia} color="#0f6e56" />
        <Kpi titulo="Atrasados" valor={resumen.atrasado + resumen.no_cumplido} color={resumen.atrasado + resumen.no_cumplido > 0 ? "#993c1d" : undefined} />
      </div>

      <div className="ca-card" style={{ marginBottom: 14, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label className="ca-label">Mes a revisar</label>
          <select className="rp-select" value={mes} onChange={(e) => setMes(e.target.value)}>
            {meses.map((m) => <option key={m} value={m}>{etiquetaMes(m)}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label className="ca-label">Meta para quienes no tienen plan</label>
            <input className="rp-input" type="number" min="1" max="99" style={{ width: 110 }} value={metaTodos} onChange={(e) => setMetaTodos(e.target.value)} />
          </div>
          <button style={btn} disabled={!sinPlan.length || ocupado === "todos"} onClick={aplicarATodos} title="Solo a quienes ya tienen un formulario asignado">
            {ocupado === "todos" ? "Asignando…" : `Asignar a los ${sinPlan.length} sin plan`}
          </button>
        </div>
      </div>
      <p style={{ ...ayuda, margin: "0 0 10px" }}>El cumplimiento de meses anteriores se compara con el plan actual de cada persona.</p>

      <table className="ca-tabla cdr-apilada">
        <thead>
          <tr><th>Evaluador</th><th>Meta mensual</th><th>Rutinas a cubrir cada mes</th><th>Cumplimiento de {etiquetaMes(mes).split(" ")[0]}</th><th></th></tr>
        </thead>
        <tbody>
          {(planes === null || cargandoDirectorio) && !error && <tr><td colSpan={5} style={{ color: "var(--texto-suave)" }}>Cargando evaluadores…</td></tr>}
          {planes !== null && !cargandoDirectorio && filas.length === 0 && <tr><td colSpan={5} style={{ color: "var(--texto-suave)" }}>Aún no hay personas con acceso a la CdR. Dales el tick de la CdR en Administración y aparecerán aquí.</td></tr>}
          {filas.map((f) => {
            const v = valorDe(f);
            const sucio = cambioDe(f, v);
            const disponibles = f.rutinasDisponibles.filter((r) => !v.rutinas.some((x) => claveRutina(x) === claveRutina(r)));
            const c = f.cumplimiento;
            return (
              <tr key={f.uid}>
                <td>
                  <b>{f.nombre}</b>
                  <div style={{ fontSize: 12, color: f.formularios.length ? "var(--texto-suave)" : "var(--ambar)" }}>
                    {f.formularios.length ? f.formularios.join(" · ") : "Sin formulario asignado: asígnalo en Formularios → Evaluadores para que pueda hacer CdR"}
                  </div>
                </td>
                <td data-label="Meta mensual">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input className="rp-input" type="number" min="0" max="99" style={{ width: 80 }} placeholder="—" value={v.meta} onChange={(e) => editar(f, { meta: e.target.value })} aria-label={`Meta mensual de ${f.nombre}`} />
                    <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>CdR/mes</span>
                  </span>
                </td>
                <td data-label="Rutinas a cubrir cada mes">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: v.rutinas.length ? 6 : 0 }}>
                    {v.rutinas.map((r) => (
                      <span key={claveRutina(r)} className="ca-chip" style={{ fontWeight: 600 }}>
                        {r.nombre}
                        <button style={{ background: "none", border: "none", padding: 0, color: "var(--rojo)", cursor: "pointer", fontSize: 12 }} title="Quitar rutina" onClick={() => editar(f, { rutinas: v.rutinas.filter((x) => claveRutina(x) !== claveRutina(r)) })}>✕</button>
                      </span>
                    ))}
                  </div>
                  <select className="rp-select" style={{ maxWidth: 260 }} value="" disabled={!disponibles.length} aria-label={`Agregar rutina a ${f.nombre}`}
                    onChange={(e) => { const r = disponibles.find((x) => claveRutina(x) === e.target.value); if (r) editar(f, { rutinas: [...v.rutinas, r] }); }}>
                    <option value="">{disponibles.length ? "＋ Agregar rutina…" : v.rutinas.length ? "No hay más rutinas" : "Sin rutinas disponibles"}</option>
                    {disponibles.map((r) => <option key={claveRutina(r)} value={claveRutina(r)}>{r.nombre}</option>)}
                  </select>
                </td>
                <td data-label={`Cumplimiento de ${etiquetaMes(mes).split(" ")[0]}`}>
                  {c && c.estado !== "sin_plan" && !sucio ? (
                    <div style={{ minWidth: 150 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <b style={{ fontSize: 13.5 }}>{textoAvance(c)}</b>
                        <span className={`ca-pill ${CLASE_ESTADO_PLAN[c.estado]}`}>{ETIQUETA_ESTADO[c.estado]}</span>
                      </div>
                      <BarraPlan pct={c.meta > 0 ? c.pct : c.rutinas.length ? (c.cubiertas * 100) / c.rutinas.length : 0} estado={c.estado} alto={8} />
                      {c.meta > 0 && c.rutinas.length > 0 && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 4 }}>Rutinas: {c.cubiertas} de {c.rutinas.length}</div>}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>{sucio ? "Guarda para ver el cumplimiento" : "Sin plan"}</span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {sucio && <button style={btn} onClick={() => descartar(f.uid)}>Descartar</button>}
                    <button style={btnPrim} disabled={!sucio || ocupado === f.uid} onClick={() => guardar(f)}>{ocupado === f.uid ? "Guardando…" : "Guardar"}</button>
                    {f.plan && <button style={btnPel} disabled={ocupado === f.uid} onClick={() => quitar(f)}>Quitar plan</button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ocultas > 0 && (
        <p style={{ ...ayuda, margin: "10px 0 0" }}>
          {ocultas} persona{ocultas === 1 ? "" : "s"} no se {ocultas === 1 ? "muestra" : "muestran"} porque ya no {ocultas === 1 ? "tiene" : "tienen"} acceso a la CdR (se les quitó o se deshabilitaron en Administración). Si vuelves a darles acceso, reaparecen con su plan.
        </p>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, color }) {
  return (
    <div className="ca-card" style={{ padding: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--texto-suave)" }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || "var(--texto)" }}>{valor}</div>
    </div>
  );
}

const ayuda = { fontSize: 13.5, color: "var(--texto-suave)", margin: "0 0 12px" };
const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnPrim = { ...btn, background: "var(--verde)", borderColor: "var(--verde)", color: "#fff" };
const btnPel = { ...btn, color: "var(--rojo)", borderColor: "#e8b7a8" };
