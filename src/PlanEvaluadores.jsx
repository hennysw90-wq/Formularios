import { useEffect, useMemo, useState } from "react";
import AlcanceEvaluador from "./AlcanceEvaluador.jsx";
import { useListados, datosDePregunta, campoAsignable, esAsignacionPorValor, PREFIJO_VALOR, textoAlcance } from "./listados.js";
import { APP_ACTUAL_ID, cambiarAppsUsuario } from "./auth.js";
import PlanMasivo from "./PlanMasivo.jsx";
import { listarRutinasAsistencia, describirFrecuencia } from "./firebaseAsistencia.js";
import { sugerirUsuarios } from "./buscarUsuarios.js";
import { useConfirmarConClave } from "./ConfirmarConClave.jsx";
import ProgramacionAzar, { firmaSorteo, mismasReglas } from "./ProgramacionAzar.jsx";
import CalendarioProgramado from "./CalendarioProgramado.jsx";
import {
  FRECUENCIAS,
  ETIQUETA_ESTADO,
  etiquetaCadencia,
  listarAsignaciones,
  guardarAsignacion,
  versionarAsignacion,
  desactivarAsignacion,
  reactivarAsignacion,
  estaActiva,
  tramosDe,
  eliminarAsignacion,
  nuevoIdAsignacion,
  filaDeEvaluador,
  resumenDeFilas,
  esLaPersona,
  listarPlanesAnteriores,
  propuestasDesdeModeloAnterior,
  sortearProgramacion,
} from "./asignaciones.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Semáforo: 95–100 verde · 80–95 ámbar · bajo 80 rojo.
function colorPorcentaje(p) {
  if (p === null || p === undefined) return "var(--texto-suave)";
  if (p >= 95) return "#0f6e56";
  if (p >= 80) return "#ba7517";
  return "#993c1d";
}
const PILL_ESTADO = { cumplido: "ca-pill-verde", al_dia: "ca-pill-verde", atrasado: "ca-pill-ambar", no_cumplido: "ca-pill-rojo", pendiente: "", sin_exigencia: "", sin_plan: "" };

/** ¿Puede entrar hoy a esta app? Misma regla que el ingreso. */
function tieneAcceso(u) {
  return !!u && u.estado !== "pendiente" && u.rol !== "deshabilitado" && (u.rol === "master" || (Array.isArray(u.apps) && u.apps.includes(APP_ACTUAL_ID)));
}

/**
 * Plan de evaluadores, con la lógica de asignaciones de Formularios: cada asignación es
 * formulario + reunión + líderes + evaluadores (cada uno con su cantidad, frecuencia y "desde").
 */
export default function PlanEvaluadores({ todas, formularioId = "", formularios, usuario, usuarios = null, errorUsuarios = false }) {
  const [asignaciones, setAsignaciones] = useState(null);
  const [reuniones, setReuniones] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState(null); // "cumplimiento" | "asignaciones"
  const [editando, setEditando] = useState(null); // asignación en edición (copia)
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });
  const [modalClave, pedirClave] = useConfirmarConClave(usuario);

  useEffect(
    () =>
      listarAsignaciones(setAsignaciones, (e) =>
        setError(e.code === "permission-denied" ? "Sin permiso para leer las asignaciones. Revisa las reglas de Firestore (colección cdrAsignaciones)." : `No se pudieron cargar las asignaciones (${e.code || e.message}).`)
      ),
    []
  );
  useEffect(() => listarRutinasAsistencia(setReuniones, () => setReuniones([])), []);
  const [planesAnteriores, setPlanesAnteriores] = useState([]);
  useEffect(() => listarPlanesAnteriores(setPlanesAnteriores, () => setPlanesAnteriores([])), []);
  const [creandoPropuestas, setCreandoPropuestas] = useState(false);

  // Con un formulario elegido arriba (Estadísticas), solo sus asignaciones.
  const lista = (asignaciones || []).filter((a) => !formularioId || a.formularioId === formularioId);
  const vistaActual = vista || (asignaciones && lista.length === 0 ? "asignaciones" : "cumplimiento");
  const directorio = Array.isArray(usuarios) ? usuarios : [];
  const formPorId = useMemo(() => new Map((formularios || []).map((f) => [f.id, f])), [formularios]);

  function nueva() {
    setAviso({ tipo: "", texto: "" });
    setEditando({ id: nuevoIdAsignacion(), esNueva: true, formularioId: "", formularioNombre: "", reunionId: "", reunionNombre: "", area: "", horaInicio: "", horaFin: "", lideres: [], personas: [] });
  }

  const propuestas = asignaciones ? propuestasDesdeModeloAnterior(formularios, asignaciones, planesAnteriores) : [];
  async function crearPropuestas() {
    const detalle = propuestas.map((p) => `• ${p.formularioNombre} → ${p.reunionNombre} (${p.personas.length} evaluador${p.personas.length === 1 ? "" : "es"})`).join("\n");
    if (!window.confirm(`Se crearán ${propuestas.length} asignaciones con lo que ya estaba configurado en los formularios:\n\n${detalle}\n\nCada evaluador queda con 1 vez al mes desde hoy; después puedes ajustar la cadencia. No se borra nada.`)) return;
    setCreandoPropuestas(true);
    try {
      const creado = new Date().toISOString();
      for (const p of propuestas) await guardarAsignacion({ ...p, creado });
      setAviso({ tipo: "ok", texto: `Se crearon ${propuestas.length} asignaciones. Revisa la cadencia de cada evaluador.` });
      setVista("asignaciones");
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudieron crear todas (${e.code || e.message}).` });
    } finally {
      setCreandoPropuestas(false);
    }
  }

  async function borrar(a) {
    if (!(await pedirClave(`Eliminar la asignación «${a.reunionNombre}» (${a.formularioNombre})`, "Se borra también su historial de cumplimiento (las evaluaciones ya hechas no se borran). Si solo quieres dejar de exigirla y conservar el historial, usa «Desactivar»."))) return;
    try {
      await eliminarAsignacion(a.id);
      setAviso({ tipo: "ok", texto: "Asignación eliminada." });
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo eliminar (${e.code || e.message}).` });
    }
  }

  return (
    <div>
      {modalClave}
      <p style={ayuda}>
        Cada asignación dice qué formulario se usa en qué reunión, a qué líderes se evalúa y quiénes evalúan, cada uno con
        su propia cadencia (por ejemplo, 2 veces a la semana). El formulario no queda atado a ninguna reunión: se elige acá.
      </p>
      {error && <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>}
      {errorUsuarios && <p style={{ color: "var(--rojo)", fontSize: 14 }}>No se pudo leer el directorio de usuarios.</p>}
      {aviso.texto && <p style={{ fontSize: 14, fontWeight: 600, color: aviso.tipo === "error" ? "var(--rojo)" : "#0f6e56", margin: "0 0 10px" }}>{aviso.texto}</p>}

      {!editando && propuestas.length > 0 && (
        <div className="ca-card" style={{ marginBottom: 14, borderLeft: "4px solid #ba7517" }}>
          <p style={{ margin: "0 0 4px", fontWeight: 800 }}>Configuración anterior sin pasar a asignaciones</p>
          <p style={{ ...ayuda, margin: "0 0 10px" }}>
            Hay {propuestas.length} reunión{propuestas.length === 1 ? "" : "es"} configurada{propuestas.length === 1 ? "" : "s"} dentro de los formularios (modelo anterior de la CdR) que todavía no tiene{propuestas.length === 1 ? "" : "n"} asignación.
            Puedes crearlas de una vez con sus líderes y evaluadores; quedan con 1 vez al mes y luego ajustas la cadencia.
          </p>
          <button style={btnPrim} disabled={creandoPropuestas} onClick={crearPropuestas}>{creandoPropuestas ? "Creando…" : `Crear ${propuestas.length} asignaci${propuestas.length === 1 ? "ón" : "ones"}`}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button style={vistaActual === "cumplimiento" ? btnSel : btn} onClick={() => setVista("cumplimiento")}>Cumplimiento</button>
        <button style={vistaActual === "asignaciones" ? btnSel : btn} onClick={() => setVista("asignaciones")}>Asignaciones ({lista.length})</button>
        {vistaActual === "asignaciones" && !editando && (
          <button style={{ ...btnPrim, marginLeft: "auto" }} onClick={nueva}>+ Nueva asignación</button>
        )}
      </div>

      {editando && (
        <EditorAsignacion
          usuario={usuario}
          inicial={editando}
          formularios={formularios || []}
          reuniones={reuniones}
          directorio={directorio}
          onCancelar={() => setEditando(null)}
          onGuardada={(texto) => {
            setEditando(null);
            setVista("asignaciones");
            setAviso({ tipo: "ok", texto });
          }}
        />
      )}

      {!editando && vistaActual === "asignaciones" && (
        <ListaAsignaciones
          asignaciones={asignaciones === null ? null : lista}
          evals={todas || []}
          usuario={usuario}
          onGuardarCalendario={async (a, personas) => {
            await guardarAsignacion(versionarAsignacion(a, { ...a, personas }));
            setAviso({ tipo: "ok", texto: `Calendario de «${a.reunionNombre}» actualizado.` });
          }}
          formPorId={formPorId}
          onEditar={(a) => { setAviso({ tipo: "", texto: "" }); setEditando({ ...JSON.parse(JSON.stringify(a)), esNueva: false }); }}
          onEliminar={borrar}
          onActivar={async (a, activar) => {
            const msg = activar
              ? `¿Reactivar la asignación "${a.reunionNombre}"? Desde hoy se vuelve a exigir; los días que estuvo desactivada no cuentan.`
              : `¿Desactivar la asignación "${a.reunionNombre}"? Desde hoy no se exige ni aparece en pendientes. Su cumplimiento anterior se conserva.`;
            if (!window.confirm(msg)) return;
            try {
              await (activar ? reactivarAsignacion(a) : desactivarAsignacion(a));
              setAviso({ tipo: "ok", texto: activar ? "Asignación reactivada." : "Asignación desactivada (su historial se conserva)." });
            } catch (e) {
              setAviso({ tipo: "error", texto: `No se pudo guardar (${e.code || e.message}).` });
            }
          }}
          onNueva={nueva}
          directorio={directorio}
        />
      )}

      {!editando && vistaActual === "cumplimiento" && (
        <Cumplimiento asignaciones={asignaciones === null ? null : lista} soloConAsignacion={!!formularioId} todas={todas} directorio={directorio} cargandoDirectorio={!Array.isArray(usuarios) && !errorUsuarios} onIrAsignaciones={() => setVista("asignaciones")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lista de asignaciones                                              */
/* ------------------------------------------------------------------ */

function ListaAsignaciones({ asignaciones, formPorId, onEditar, onEliminar, onActivar, onNueva, directorio = [], evals = [], usuario = null, onGuardarCalendario = null }) {
  const [calendarioDe, setCalendarioDe] = useState("");
  const tieneUsuario = (nombre) => directorio.some((u) => u.rol !== "deshabilitado" && esLaPersona({ nombre }, u));
  if (asignaciones === null) return <p style={ayuda}>Cargando asignaciones…</p>;
  if (asignaciones.length === 0) {
    return (
      <div className="cdr-molde">
        <b>Todavía no hay asignaciones</b>
        Crea la primera: elige un formulario, la reunión donde se aplica, a qué líderes se evalúa y quiénes evalúan.
        <div style={{ marginTop: 10 }}><button style={btnPrim} onClick={onNueva}>+ Nueva asignación</button></div>
      </div>
    );
  }
  const grupos = new Map();
  asignaciones.forEach((a) => {
    const g = grupos.get(a.formularioId) || [];
    g.push(a);
    grupos.set(a.formularioId, g);
  });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {[...grupos.entries()].map(([fid, lista]) => {
        const f = formPorId.get(fid);
        return (
          <div key={fid}>
            <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15 }}>
              {f ? f.nombre : lista[0].formularioNombre || "Formulario eliminado"}
              {f && f.estado !== "publicado" && <span className="ca-pill ca-pill-ambar" style={{ marginLeft: 8 }}>Borrador: los evaluadores aún no lo ven</span>}
              {!f && <span className="ca-pill ca-pill-rojo" style={{ marginLeft: 8 }}>El formulario ya no existe</span>}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {lista
                .slice()
                .sort((x, y) => (x.reunionNombre || "").localeCompare(y.reunionNombre || "", "es"))
                .map((a) => (
                  <div key={a.id} className="ca-card" style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{a.campoAsignacion && !String(a.reunionId).startsWith(PREFIJO_VALOR + "@") ? <span style={{ fontWeight: 600, color: "var(--texto-suave)" }}>{a.campoAsignacion}: </span> : null}{a.reunionNombre}{a.area ? <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · {a.area}</span> : ""}</div>
                        <div style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 2 }}>
                          Líderes: {(a.lideres || []).length
                            ? a.lideres.map((l, i) => <span key={l}>{i ? ", " : ""}{l}{directorio.length && !tieneUsuario(l) ? <b style={{ color: "#993c1d" }}> (sin usuario)</b> : ""}</span>)
                            : esAsignacionPorValor(a.reunionId) ? <span>—</span> : <span style={{ color: "#993c1d" }}>sin líder: edítala para agregarlo</span>}
                        </div>
                        {((a.tramos || []).length > 0 || a.vigenteDesde) && (
                          <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 2 }}>
                            {a.vigenteDesde ? `Configuración vigente desde ${a.vigenteDesde.split("-").reverse().join("-")}` : ""}
                            {(a.tramos || []).length ? ` · ${(a.tramos || []).length} cambio${(a.tramos || []).length === 1 ? "" : "s"} anterior${(a.tramos || []).length === 1 ? "" : "es"} guardado${(a.tramos || []).length === 1 ? "" : "s"} (el cumplimiento pasado se mide con sus reglas de entonces)` : ""}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, opacity: estaActiva(a) ? 1 : 0.55 }}>
                          {(a.personas || []).map((p) => (
                            <span key={p.uid || p.nombre} className="ca-chip" style={{ fontWeight: 600 }} title={p.desde ? `Se controla desde ${p.desde}` : ""}>
                              {p.nombre} · {p.frecuencia === "programada" ? `${(p.fechas || []).length} días programados` : etiquetaCadencia(p.cantidad, p.frecuencia, p.frecuencia === "unica" ? p.hasta : "")}{p.desde ? ` · desde ${p.desde.split("-").reverse().join("-")}` : ""}{p.alcance ? ` · ${textoAlcance(p.alcance)}` : ""}
                            </span>
                          ))}
                          {!(a.personas || []).length && <span style={{ fontSize: 13, color: "var(--rojo)" }}>Sin evaluadores</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {!estaActiva(a) && <span className="ca-pill" style={{ background: "#eef0f3", color: "#5b6472" }}>Desactivada desde {String(a.inactivaDesde || "").split("-").reverse().join("-")}</span>}
                        {(a.personas || []).length > 0 && (
                          <button style={{ ...btn, ...(calendarioDe === a.id ? { background: "var(--verde, #009899)", color: "#fff", borderColor: "var(--verde, #009899)" } : {}) }} onClick={() => setCalendarioDe(calendarioDe === a.id ? "" : a.id)}>📅 Calendario</button>
                        )}
                        {estaActiva(a) && <button style={btn} onClick={() => onEditar(a)}>Editar</button>}
                        <button style={btn} onClick={() => onActivar(a, !estaActiva(a))}>{estaActiva(a) ? "Desactivar" : "Reactivar"}</button>
                        <button style={btnPel} onClick={() => onEliminar(a)}>Eliminar</button>
                      </div>
                    </div>
                    {calendarioDe === a.id && <CalendarioProgramado asignacion={a} evals={evals} usuario={usuario} formularioNombre={f ? f.nombre : a.formularioNombre || ""} onGuardar={estaActiva(a) && onGuardarCalendario ? (personas) => onGuardarCalendario(a, personas) : null} />}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor de una asignación                                           */
/* ------------------------------------------------------------------ */

function EditorAsignacion({ inicial, formularios, reuniones, directorio, onCancelar, onGuardada, usuario }) {
  // Programado al azar: una vez guardado, el calendario queda fijo; para cambiarlo se pide la clave.
  const calendarioGuardado = !inicial.esNueva && (inicial.personas || []).some((p) => (p.fechas || []).length);
  const [bloqueado, setBloqueado] = useState(calendarioGuardado);
  const [modalClaveCal, pedirClaveCal] = useConfirmarConClave(usuario);
  async function desbloquearCalendario() {
    if (await pedirClaveCal("Cambiar el calendario programado", "El calendario sorteado queda fijo. Para cambiar a alguien de día o volver a sortear, confirma con tu clave.")) setBloqueado(false);
  }
  const [a, setA] = useState(() =>
    esAsignacionPorValor(inicial.reunionId) && !String(inicial.reunionId).startsWith(PREFIJO_VALOR + "@")
      ? { ...inicial, personas: (inicial.personas || []).map((p) => ({ ...p, alcance: p.alcance || { opciones: [inicial.reunionNombre], subareas: [] } })) }
      : inicial
  );
  const [buscaLider, setBuscaLider] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [masivo, setMasivo] = useState(false);
  // Plan común de la asignación: se define una vez y lo heredan todos los evaluadores que no estén "personalizados".
  const PLAN_VACIO = { cantidad: 1, frecuencia: "semanal", base: "semanal", desde: "", hasta: "", dias: [1, 2, 3, 4, 5], alcance: { opciones: [], subareas: [] } };
  const planDe = (p) => ({ cantidad: p.cantidad ?? 1, frecuencia: p.frecuencia || "semanal", desde: p.desde || "", hasta: p.hasta || "", base: p.base || "semanal", dias: p.dias || [1, 2, 3, 4, 5], alcance: p.alcance || { opciones: [], subareas: [] } });
  const mismoPlan = (x, y) => JSON.stringify(planDe(x)) === JSON.stringify(planDe(y));
  const [planComun, setPlanComun] = useState(() => (inicial.planComun ? planDe(inicial.planComun) : (inicial.personas || [])[0] ? planDe(inicial.personas[0]) : PLAN_VACIO));
  // Programado al azar: firma del último sorteo (días, fechas y evaluadores) para avisar si hay que volver a sortear.
  const [firma, setFirma] = useState(() => inicial.planComun?.firmaSorteo || "");
  const claveP = (p) => p.uid || `n:${p.nombre}`;
  useEffect(() => {
    // Asignaciones anteriores (sin plan común guardado): quien no coincida con el plan del primero queda personalizado.
    if (inicial.planComun || !(inicial.personas || []).length) return;
    setA((x) => ({ ...x, personas: (x.personas || []).map((p) => ({ ...p, personalizado: !mismoPlan(p, planComun) })) }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function cambiarPlanComun(cambio) {
    const nuevo = { ...planComun, ...cambio };
    setPlanComun(nuevo);
    setError("");
    setA((x) => ({ ...x, planComun: nuevo, personas: (x.personas || []).map((p) => (p.personalizado ? p : { ...p, ...nuevo, ...(campo ? {} : { alcance: undefined }) })) }));
  }
  // soloNuevos: con las mismas reglas, sortea solo a quienes todavía no tienen días (los demás no cambian).
  function sortear(soloNuevos = false) {
    const siguen = (a.personas || []).filter((p) => !p.personalizado && (!soloNuevos || !(p.fechas || []).length));
    const hoy = new Date().toISOString().slice(0, 10);
    const desde = [planComun.desde || hoy, hoy].sort().pop();
    const ocupadas = soloNuevos ? (a.personas || []).flatMap((p) => p.fechas || []) : (a.personas || []).filter((p) => p.personalizado).flatMap((p) => p.fechas || []);
    const r = sortearProgramacion(siguen.map(claveP), desde, planComun.hasta, planComun.dias || [], planComun.cantidad, planComun.base || "semanal", ocupadas);
    const aSortear = new Set(siguen.map(claveP));
    setA((x) => ({ ...x, personas: (x.personas || []).map((p) => (aSortear.has(claveP(p)) ? { ...p, fechas: r[claveP(p)] || [] } : p)) }));
    setFirma(firmaSorteo(planComun));
    setError("");
  }
  // Personalizado con programación propia: se sortea solo esa persona (prefiriendo días con menos gente).
  const planPersona = (p) => ({ desde: p.desde || "", hasta: p.hasta || p.hastaProgramado || "", dias: p.dias || [1, 2, 3, 4, 5], cantidad: p.cantidad ?? 1, base: p.base || "semanal" });
  function sortearPersona(p) {
    const pl = planPersona(p);
    const otras = (a.personas || []).filter((x) => claveP(x) !== claveP(p)).flatMap((x) => x.fechas || []);
    const r = sortearProgramacion([claveP(p)], [pl.desde || new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)].sort().pop(), pl.hasta, pl.dias, pl.cantidad, pl.base, otras);
    setA((x) => ({ ...x, personas: (x.personas || []).map((y) => (claveP(y) === claveP(p) ? { ...y, fechas: r[claveP(p)] || [], firmaSorteo: firmaSorteo(pl) } : y)) }));
    setError("");
  }
  // Recalcular todo: vuelve a sortear el plan común y a cada personalizado con su propia programación, repartiendo la carga.
  async function recalcularTodo() {
    if (bloqueado && !(await pedirClaveCal("Recalcular todo el sorteo", "Se vuelven a sortear los días de TODOS los evaluadores programados (plan común y personalizados). El calendario actual se reemplaza."))) return;
    if (!window.confirm("¿Recalcular todo el sorteo? Cambian los días de todos los evaluadores programados.")) return;
    setBloqueado(false);
    const hoy = new Date().toISOString().slice(0, 10);
    const desdeDe = (d) => [d || hoy, hoy].sort().pop();
    const fechas = {};
    const ocupadas = [];
    const comun = esProgramada ? (a.personas || []).filter((p) => !p.personalizado) : [];
    if (comun.length && planComun.hasta && (planComun.dias || []).length) {
      const r = sortearProgramacion(comun.map(claveP), desdeDe(planComun.desde), planComun.hasta, planComun.dias, planComun.cantidad, planComun.base || "semanal");
      Object.entries(r).forEach(([k, l]) => { fechas[k] = l; ocupadas.push(...l); });
    }
    const firmas = {};
    (a.personas || []).filter((p) => p.personalizado && p.frecuencia === "programada").forEach((p) => {
      const pl = planPersona(p);
      if (!pl.hasta || !(pl.dias || []).length) return;
      const r = sortearProgramacion([claveP(p)], desdeDe(pl.desde), pl.hasta, pl.dias, pl.cantidad, pl.base, ocupadas);
      fechas[claveP(p)] = r[claveP(p)] || [];
      firmas[claveP(p)] = firmaSorteo(pl);
      ocupadas.push(...fechas[claveP(p)]);
    });
    setA((x) => ({ ...x, personas: (x.personas || []).map((p) => (claveP(p) in fechas ? { ...p, fechas: fechas[claveP(p)], ...(firmas[claveP(p)] ? { firmaSorteo: firmas[claveP(p)] } : {}) } : p)) }));
    if (comun.length) setFirma(firmaSorteo(planComun));
    setError("");
  }
  const personaDesactualizada = (p) => p.personalizado && p.frecuencia === "programada" && !mismasReglas(p.firmaSorteo, planPersona(p));
  function cambiarPersonaVarios(uid, cambios) {
    cambiar({ personas: a.personas.map((p) => (p.uid === uid ? { ...p, ...cambios } : p)) });
  }
  function moverFecha(fecha, de, aClave) {
    if (de === aClave) return;
    setA((x) => ({ ...x, personas: (x.personas || []).map((p) => {
      const k = claveP(p);
      if (k === de) return { ...p, fechas: (p.fechas || []).filter((f) => f !== fecha) };
      if (k === aClave) return { ...p, fechas: [...(p.fechas || []), fecha].sort() };
      return p;
    }) }));
  }
  const esProgramada = planComun.frecuencia === "programada";
  const hayProgramados = esProgramada || (a.personas || []).some((p) => p.frecuencia === "programada");
  const siguenPlan = (a.personas || []).filter((p) => !p.personalizado);
  const reglasCambiaron = esProgramada && !mismasReglas(firma, planComun);
  const nuevosSinDias = esProgramada && !reglasCambiaron ? siguenPlan.filter((p) => !(p.fechas || []).length) : [];
  const sorteoDesactualizado = reglasCambiaron || nuevosSinDias.length > 0;
  function personalizar(uid, si) {
    setA((x) => ({ ...x, personas: x.personas.map((p) => (p.uid === uid ? (si ? { ...p, personalizado: true, ...(p.frecuencia === "programada" ? { firmaSorteo: firmaSorteo(planPersona(p)) } : {}) } : { ...p, ...planComun, ...(campo ? {} : { alcance: undefined }), personalizado: false, ...(planComun.frecuencia === "programada" ? { fechas: [] } : {}) }) : p)) }));
  }
  const [habilitando, setHabilitando] = useState("");
  // Da acceso a la app (lo mismo que marcarla en Administración); el directorio se actualiza solo.
  async function habilitarAcceso(usuarios) {
    try {
      for (const u of usuarios) {
        if (!u?.uid || tieneAcceso(u)) continue;
        setHabilitando(u.uid);
        await cambiarAppsUsuario(u.uid, [...new Set([...(Array.isArray(u.apps) ? u.apps : []), APP_ACTUAL_ID])]);
      }
    } catch (e) {
      setError(`No se pudo habilitar el acceso (${e.code || e.message}).`);
    } finally {
      setHabilitando("");
    }
  }
  async function aplicarPlanMasivo(usuarios, plan, habilitar) {
    const p0 = plan || planComun;
    const base = { cantidad: p0.cantidad, frecuencia: p0.frecuencia, desde: p0.desde || "", hasta: p0.hasta || "", ...(campo && p0.alcance ? { alcance: p0.alcance } : {}), ...(plan ? {} : { personalizado: false }) };
    setA((x) => {
      const personas = [...(x.personas || [])];
      usuarios.forEach((u) => {
        const i = personas.findIndex((p) => esLaPersona(p, u));
        if (i >= 0) { if (plan) personas[i] = { ...personas[i], ...base }; }
        else personas.push({ uid: u.uid, nombre: u.nombreUsuario, ...base });
      });
      return { ...x, personas };
    });
    setError("");
    if (habilitar) await habilitarAcceso(usuarios);
  }
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiar = (parcial) => {
    setError("");
    setA((x) => ({ ...x, ...parcial }));
  };
  const activos = directorio.filter((u) => u.rol !== "deshabilitado" && u.estado !== "pendiente");
  // Líderes y evaluadores son siempre personas con usuario en el directorio.
  const usuarioDe = (nombre) => activos.find((u) => esLaPersona({ nombre }, u));
  const ordenFormularios = formularios.slice().sort((x, y) => (x.estado === "publicado" ? 0 : 1) - (y.estado === "publicado" ? 0 : 1) || (x.nombre || "").localeCompare(y.nombre || "", "es"));
  const reunionActual = (reuniones || []).find((r) => r.id === a.reunionId);
  // Formulario que se asigna por un campo (ej. Estándar) en vez de por reunión: solo los que lo tienen marcado.
  const listados = useListados();
  const campo = campoAsignable(formularios.find((x) => x.id === a.formularioId));
  const reunionHuerfana = !campo && a.reunionId && reuniones && !reunionActual;

  function elegirFormulario(id) {
    const f = formularios.find((x) => x.id === id);
    const cambiaTipo = !!campoAsignable(f) !== esAsignacionPorValor(a.reunionId);
    cambiar({ formularioId: id, formularioNombre: f ? f.nombre : "", ...(cambiaTipo ? { reunionId: "", reunionNombre: "", area: "", horaInicio: "", horaFin: "" } : {}) });
  }
  const datosCampo = campo ? datosDePregunta(campo, listados) : null;
  function elegirReunion(id) {
    const r = (reuniones || []).find((x) => x.id === id);
    const parcial = { reunionId: id, reunionNombre: r ? r.nombre : "", area: r?.area || "", horaInicio: r?.horaInicio || "", horaFin: r?.horaFin || "" };
    // Si el formulario trae líderes guardados para esta reunión (p. ej. importado desde Excelencia), se sugieren.
    const f = formularios.find((x) => x.id === a.formularioId);
    const previa = (f?.rutinas || []).find((x) => x.sesionId === id);
    if (previa && !(a.lideres || []).length) {
      parcial.lideres = [...new Set((previa.lideres || []).map((n) => usuarioDe(n)?.nombreUsuario || n))];
    }
    cambiar(parcial);
  }
  function agregarLider(u) {
    if (!(a.lideres || []).includes(u.nombreUsuario)) cambiar({ lideres: [...(a.lideres || []), u.nombreUsuario] });
    setBuscaLider("");
  }
  function alternarPersona(u) {
    const existe = (a.personas || []).some((p) => esLaPersona(p, u));
    cambiar({
      personas: existe
        ? a.personas.filter((p) => !esLaPersona(p, u))
        : [...(a.personas || []), { uid: u.uid, nombre: u.nombreUsuario, ...planComun, ...(campo ? {} : { alcance: undefined }), personalizado: false }],
    });
    setBusqueda("");
  }
  function cambiarPersona(uid, campo, valor) {
    cambiar({ personas: a.personas.map((p) => (p.uid === uid ? { ...p, [campo]: valor } : p)) });
  }

  async function guardar() {
    if (!a.formularioId) return setError("Elige el formulario.");
    if (!campo && !a.reunionId) return setError("Elige la reunión.");
    if (!campo && !(a.lideres || []).length) return setError("Agrega al menos un líder a evaluar.");
    const sinUsuario = (a.lideres || []).filter((n) => !usuarioDe(n));
    if (sinUsuario.length) return setError(`Estos líderes no tienen usuario: ${sinUsuario.join(", ")}. Quítalos o créales usuario en Administración.`);
    if (!(a.personas || []).length) return setError("Agrega al menos un evaluador.");
    if (campo && (a.personas || []).some((p) => !p.personalizado) && !(planComun.alcance?.opciones || []).length && !(planComun.alcance?.subareas || []).length) {
      return setError(`Elige en el plan común qué ${campo.etiqueta.toLowerCase()} les tocan.`);
    }
    if (planComun.frecuencia === "unica" && !planComun.hasta && (a.personas || []).some((p) => !p.personalizado)) return setError("Pon en el plan común hasta qué fecha tienen para ejecutarlo (plazo).");
    const sinProgramar = (a.personas || []).filter((p) => p.personalizado && p.frecuencia === "programada" && (!(p.fechas || []).length || personaDesactualizada(p)));
    if (sinProgramar.length) return setError(`Sortea los días de: ${sinProgramar.map((p) => p.nombre).join(", ")} (programación personalizada).`);
    if (esProgramada && siguenPlan.length) {
      if (!planComun.hasta || !(planComun.dias || []).length) return setError("Elige los días de la semana y hasta qué fecha se programa.");
      if (nuevosSinDias.length) return setError(`Toca «Sortear solo para los nuevos» para darle días a: ${nuevosSinDias.map((p) => p.nombre).join(", ")}.`);
      if (sorteoDesactualizado || !siguenPlan.some((p) => (p.fechas || []).length)) return setError(bloqueado ? "Cambiaron las reglas del calendario: toca «Cambiar calendario» (pide clave) y vuelve a sortear antes de guardar." : "Toca «Sortear calendario» (o «Volver a sortear») antes de guardar.");
    }
    if (campo) {
      const sinAlcance = a.personas.filter((p) => !(p.alcance?.opciones || []).length && !(p.alcance?.subareas || []).length);
      if (sinAlcance.length) return setError(`Elige qué ${campo.etiqueta.toLowerCase()} le tocan a: ${sinAlcance.map((p) => p.nombre).join(", ")}.`);
    }
    for (const p of a.personas) {
      if (!(Number(p.cantidad) >= 1)) return setError(`Pon una cantidad válida para ${p.nombre}.`);
      if (p.frecuencia === "unica") {
        if (!p.hasta) return setError(`Pon hasta qué fecha tiene ${p.nombre} para ejecutarlo (plazo).`);
        if (p.desde && p.hasta < p.desde) return setError(`El plazo de ${p.nombre} termina antes de empezar: revisa "desde" y "hasta".`);
      }
    }
    setGuardando(true);
    try {
      const { esNueva, ...datos } = a;
      // Asignación por listado: una "reunión" propia de esta asignación; el valor sale del alcance de cada persona.
      const porListado = campo ? { reunionId: `${PREFIJO_VALOR}@${datos.id}`, reunionNombre: `${campo.etiqueta} (asignado por evaluador)`, area: "", horaInicio: "", horaFin: "", campoAsignacion: campo.etiqueta } : {};
      const nueva = { ...datos, ...porListado, planComun: { ...planComun, ...(campo ? {} : { alcance: null }), ...(esProgramada ? { firmaSorteo: firmaSorteo(planComun) } : {}) }, creado: datos.creado || new Date().toISOString() };
      // Modificar una asignación no reescribe el pasado: lo anterior queda como tramo del historial.
      await guardarAsignacion(esNueva ? nueva : versionarAsignacion(inicial, nueva));
      onGuardada(esNueva ? `Asignación creada: ${porListado.reunionNombre || a.reunionNombre}.` : "Asignación guardada.");
    } catch (e) {
      setError(`No se pudo guardar (${e.code || e.message}).`);
      setGuardando(false);
    }
  }

  const elegidos = a.personas || [];
  const candidatos = sugerirUsuarios(busqueda, activos).filter((u) => !elegidos.some((p) => esLaPersona(p, u)));

  return (
    <div className="ca-card" style={{ marginBottom: 14, borderLeft: "4px solid var(--verde)" }}>
      <p style={{ margin: "0 0 12px", fontWeight: 800, fontSize: 16 }}>{a.esNueva ? "Nueva asignación" : "Editar asignación"}</p>
      {modalClaveCal}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div>
          <label className="ca-label">Formulario *</label>
          <select className="rp-select" value={a.formularioId} onChange={(e) => elegirFormulario(e.target.value)}>
            <option value="">Elige un formulario…</option>
            {ordenFormularios.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}{f.estado !== "publicado" ? " (borrador)" : ""}</option>
            ))}
          </select>
        </div>
        {campo ? (
          <div>
            <label className="ca-label">{campo.etiqueta}</label>
            <p style={{ ...ayuda, margin: "4px 0 0", fontSize: 12.5 }}>
              Se asigna por evaluador: a cada uno le eliges abajo qué {campo.etiqueta.toLowerCase()} o sub áreas le tocan. Cada periodo le toca uno al azar dentro de ese alcance (rota hasta pasar por todos).
            </p>
          </div>
        ) : (
        <div>
          <label className="ca-label">Reunión *</label>
          <select className="rp-select" value={a.reunionId} onChange={(e) => elegirReunion(e.target.value)} disabled={reuniones === null}>
            <option value="">{reuniones === null ? "Cargando reuniones de Asistencia…" : "Elige una reunión…"}</option>
            {reunionHuerfana && <option value={a.reunionId}>{a.reunionNombre} (ya no está en Asistencia)</option>}
            {(reuniones || []).map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}{r.area ? ` · ${r.area}` : ""}{describirFrecuencia(r) ? ` · ${describirFrecuencia(r)}` : ""}</option>
            ))}
          </select>
          {reunionHuerfana && <p style={{ fontSize: 12, color: "var(--rojo)", margin: "4px 0 0" }}>Esta reunión ya no existe (o está inactiva) en Asistencia. Elige otra.</p>}
        </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="ca-label">Líderes a evaluar{campo ? " (opcional)" : " *"}</label>
        <p style={{ ...ayuda, margin: "0 0 6px", fontSize: 12.5 }}>Quién lidera esta reunión, elegido entre las personas con usuario. Si hay uno, al evaluar se pone solo; si hay varios, se elige entre ellos.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {(a.lideres || []).map((l) => {
            const sinUsuario = !usuarioDe(l);
            return (
              <span key={l} className={`ca-chip ${sinUsuario ? "cdr-chip-mal" : ""}`} style={{ fontWeight: 600, ...(sinUsuario ? { background: "#fbeae5", color: "#993c1d", border: "1px solid #e8b7a8" } : {}) }}
                title={sinUsuario ? "No tiene usuario: quítalo o créale usuario en Administración" : ""}>
                {l}{sinUsuario ? " · sin usuario" : ""}
                <button style={x} title="Quitar" onClick={() => cambiar({ lideres: a.lideres.filter((y) => y !== l) })}>✕</button>
              </span>
            );
          })}
        </div>
        <input className="rp-input" style={{ maxWidth: 420 }} value={buscaLider} placeholder="Buscar líder por nombre o área…" onChange={(e) => setBuscaLider(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {sugerirUsuarios(buscaLider, activos).filter((u) => !(a.lideres || []).includes(u.nombreUsuario)).map((u) => (
            <button key={u.uid} style={chipBtn} title={u.area || ""} onClick={() => agregarLider(u)}>
              + {u.nombreUsuario}{u.parecido && <span style={{ marginLeft: 5, fontSize: 10, color: "#8a5a00" }}>parecido</span>}
            </button>
          ))}
          {buscaLider.trim().length >= 2 && sugerirUsuarios(buscaLider, activos).length === 0 && <span style={{ ...ayuda, margin: 0, fontSize: 12.5 }}>Nadie con usuario coincide con esa búsqueda.</span>}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label className="ca-label" style={{ margin: 0 }}>Evaluadores *</label>

          {(() => {
            const sin = (a.personas || []).map((p) => directorio.find((d) => esLaPersona(p, d))).filter((u) => u && !tieneAcceso(u));
            return sin.length > 1 ? (
              <button style={chipBtn} disabled={!!habilitando} onClick={() => habilitarAcceso(sin)}>Habilitar acceso a los {sin.length} sin acceso</button>
            ) : null;
          })()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "0 0 8px" }}>
          <p style={{ ...ayuda, margin: 0, fontSize: 12.5, flex: 1 }}>Todos siguen el plan común; si alguien necesita algo distinto, tócale «Personalizar».</p>
          {hayProgramados && (
            <button type="button" style={{ ...chipBtn, fontWeight: 700 }} onClick={recalcularTodo} title="Vuelve a sortear los días de todos los evaluadores programados">
              🔄 Recalcular todo el sorteo{bloqueado ? " (pide clave)" : ""}
            </button>
          )}
        </div>

        <div style={{ border: "1.5px solid var(--verde)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, background: "#F4FBF9" }}>
          <b style={{ fontSize: 14 }}>Plan común</b>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 6 }}>
            {!esProgramada && (
            <div style={{ flex: "0 0 86px" }}>
              <label style={mini}>Cantidad</label>
              <input className="rp-input" type="number" min="1" value={planComun.cantidad} onChange={(e) => cambiarPlanComun({ cantidad: e.target.value })} aria-label="Cantidad del plan común" />
            </div>
            )}
            <div style={{ flex: "1 1 150px" }}>
              <label style={mini}>Frecuencia</label>
              <select className="rp-select" value={planComun.frecuencia} disabled={esProgramada && bloqueado} onChange={(e) => cambiarPlanComun({ frecuencia: e.target.value })} aria-label="Frecuencia del plan común">
                {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 160px" }}>
              <label style={mini}>{planComun.frecuencia === "unica" ? "Ejecutar desde" : esProgramada ? "Programar desde" : "Controlar desde"}</label>
              <input className="rp-input" type="date" value={planComun.desde} disabled={esProgramada && bloqueado} title="Vacío = desde que se crea la asignación" onChange={(e) => cambiarPlanComun({ desde: e.target.value })} aria-label="Desde del plan común" />
            </div>
            {planComun.frecuencia === "unica" && (
              <div style={{ flex: "0 0 160px" }}>
                <label style={mini}>Hasta (plazo) *</label>
                <input className="rp-input" type="date" value={planComun.hasta} min={planComun.desde || undefined} onChange={(e) => cambiarPlanComun({ hasta: e.target.value })} aria-label="Hasta del plan común" />
              </div>
            )}
          </div>
          {esProgramada && (
            <ProgramacionAzar
              plan={planComun}
              personas={siguenPlan.map((p) => ({ clave: claveP(p), nombre: p.nombre, fechas: p.fechas || [] }))}
              desactualizado={reglasCambiaron}
              nuevosSinDias={nuevosSinDias.map((p) => p.nombre)}
              onSortearNuevos={() => sortear(true)}
              bloqueado={bloqueado}
              onDesbloquear={desbloquearCalendario}
              onCambiar={cambiarPlanComun}
              onSortear={() => sortear(false)}
              onMover={moverFecha}
            />
          )}
          {hayProgramados && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontSize: 13.5, cursor: "pointer", background: "#fff", border: "1px solid #D3D1C7", borderRadius: 10, padding: "8px 10px" }}>
              <input type="checkbox" checked={a.soloDiaProgramado !== false} onChange={(e) => cambiar({ soloDiaProgramado: e.target.checked })} style={{ marginTop: 3, flexShrink: 0 }} />
              <span>
                <b>Solo se puede hacer el día que le toca</b>
                <span style={{ display: "block", fontSize: 12, color: "var(--texto-suave)" }}>Los otros días el botón para ejecutar queda bloqueado, y solo cuenta la evaluación hecha ese mismo día. Si no la hace, queda como no cumplida.</span>
              </span>
            </label>
          )}
          {campo && <AlcanceEvaluador etiqueta={campo.etiqueta} nombre="el plan común" datos={datosCampo} alcance={planComun.alcance} onCambiar={(al) => cambiarPlanComun({ alcance: al })} />}
          <div style={{ fontSize: 12, color: "#0f6e56", fontWeight: 600, marginTop: 4 }}>
            {etiquetaCadencia(planComun.cantidad || 1, planComun.frecuencia, planComun.frecuencia === "unica" || esProgramada ? planComun.hasta : "", planComun.base)}
            {planComun.desde ? ` · desde ${planComun.desde.split("-").reverse().join("-")}` : ""}
            {(a.personas || []).length ? ` · lo siguen ${(a.personas || []).filter((p) => !p.personalizado).length} de ${(a.personas || []).length}` : ""}
          </div>
        </div>
        {elegidos.map((p) => {
          const u = directorio.find((d) => esLaPersona(p, d));
          const sinAcceso = u && !tieneAcceso(u);
          return (
            <div key={p.uid || p.nombre} style={filaPersona}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <b style={{ flex: 1, minWidth: 0 }}>{p.nombre}</b>
                {sinAcceso && (
                  <button
                    className="ca-pill ca-pill-ambar"
                    style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
                    disabled={!!habilitando}
                    title="Puede evaluar por QR, pero no iniciar sesión. Toca para darle acceso a la app."
                    onClick={() => habilitarAcceso([u])}
                  >
                    {habilitando === u.uid ? "Habilitando…" : "Sin acceso a la app · Habilitar"}
                  </button>
                )}
                {p.personalizado
                  ? <button style={chipBtn} onClick={() => personalizar(p.uid, false)}>Volver al plan común</button>
                  : <button style={chipBtn} onClick={() => personalizar(p.uid, true)}>Personalizar</button>}
                <button style={x} title="Quitar" onClick={() => alternarPersona({ uid: p.uid, nombreUsuario: p.nombre })}>✕</button>
              </div>
              {!p.personalizado ? (
                <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginTop: 2 }}>
                  Plan común · {p.frecuencia === "programada" ? `${(p.fechas || []).length} días programados${(() => { const hoy = new Date().toISOString().slice(0, 10); const prox = [...(p.fechas || [])].sort().find((f) => f >= hoy); return prox ? ` · próximo ${prox.split("-").reverse().join("-")}` : ""; })()}` : etiquetaCadencia(p.cantidad ?? 1, p.frecuencia || "semanal", p.frecuencia === "unica" ? p.hasta : "")}{p.desde ? ` · desde ${p.desde.split("-").reverse().join("-")}` : ""}{campo && p.alcance ? ` · ${textoAlcance(p.alcance) || "sin alcance"}` : ""}
                </div>
              ) : (<>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 6 }}>
                {p.frecuencia !== "programada" && (
                <div style={{ flex: "0 0 86px" }}>
                  <label style={mini}>Cantidad</label>
                  <input className="rp-input" type="number" min="1" value={p.cantidad ?? 1} onChange={(e) => cambiarPersona(p.uid, "cantidad", e.target.value)} aria-label={`Cantidad de ${p.nombre}`} />
                </div>
                )}
                <div style={{ flex: "1 1 150px" }}>
                  <label style={mini}>Frecuencia</label>
                  <select className="rp-select" value={p.frecuencia || "semanal"} onChange={(e) => cambiarPersona(p.uid, "frecuencia", e.target.value)} aria-label={`Frecuencia de ${p.nombre}`}>
                    {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
                  </select>
                </div>
                <div style={{ flex: "0 0 160px" }}>
                  <label style={mini}>{p.frecuencia === "unica" ? "Ejecutar desde" : p.frecuencia === "programada" ? "Programar desde" : "Controlar desde"}</label>
                  <input className="rp-input" type="date" value={p.desde || ""} disabled={p.frecuencia === "programada" && bloqueado} title="Vacío = desde que se crea la asignación" onChange={(e) => cambiarPersona(p.uid, "desde", e.target.value)} aria-label={`Desde de ${p.nombre}`} />
                </div>
                {p.frecuencia === "unica" && (
                  <div style={{ flex: "0 0 160px" }}>
                    <label style={mini}>Hasta (plazo) *</label>
                    <input className="rp-input" type="date" value={p.hasta || ""} min={p.desde || undefined} onChange={(e) => cambiarPersona(p.uid, "hasta", e.target.value)} aria-label={`Hasta de ${p.nombre}`} />
                  </div>
                )}
              </div>
              {p.frecuencia === "programada" && (
                <ProgramacionAzar
                  plan={planPersona(p)}
                  personas={[{ clave: claveP(p), nombre: p.nombre, fechas: p.fechas || [] }]}
                  desactualizado={personaDesactualizada(p)}
                  bloqueado={bloqueado && (p.fechas || []).length > 0 && !personaDesactualizada(p)}
                  onDesbloquear={desbloquearCalendario}
                  onCambiar={(c) => cambiarPersonaVarios(p.uid, c)}
                  onSortear={() => sortearPersona(p)}
                  onMover={() => {}}
                  textoSortear="Sortear sus días"
                />
              )}
              {campo && (
                <AlcanceEvaluador etiqueta={campo.etiqueta} nombre={p.nombre} datos={datosCampo} alcance={p.alcance} onCambiar={(al) => cambiarPersona(p.uid, "alcance", al)} />
              )}
              <div style={{ fontSize: 12, color: "#0f6e56", fontWeight: 600, marginTop: 4 }}>
                {etiquetaCadencia(p.cantidad ?? 1, p.frecuencia || "semanal", p.frecuencia === "unica" || p.frecuencia === "programada" ? p.hasta : "", p.base)}
                {p.frecuencia === "unica" && <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · solo cuentan las evaluaciones hechas {p.desde ? `entre el ${p.desde.split("-").reverse().join("-")}` : "desde que se crea la asignación"}{p.hasta ? ` y el ${p.hasta.split("-").reverse().join("-")}` : " y la fecha de plazo"}</span>}
              </div>
              </>)}
            </div>
          );
        })}
        {masivo ? (
          <PlanMasivo soloPersonas activos={activos} elegidos={a.personas || []} campo={campo} datosCampo={datosCampo} tieneAcceso={tieneAcceso} onAplicar={aplicarPlanMasivo} onCerrar={() => setMasivo(false)} />
        ) : (
          <button style={{ ...chipBtn, fontWeight: 700, marginBottom: 6 }} onClick={() => setMasivo(true)}>＋ Agregar varios evaluadores a la vez</button>
        )}
        <input className="rp-input" style={{ maxWidth: 420, marginTop: 4, display: "block" }} value={busqueda} placeholder="Buscar evaluador por nombre o área…" onChange={(e) => setBusqueda(e.target.value)} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {candidatos.map((u) => (
            <button key={u.uid} style={chipBtn} title={u.area || ""} onClick={() => alternarPersona(u)}>
              + {u.nombreUsuario}{u.parecido && <span style={{ marginLeft: 5, fontSize: 10, color: "#8a5a00" }}>parecido</span>}
            </button>
          ))}
          {busqueda.trim().length >= 2 && candidatos.length === 0 && <span style={{ ...ayuda, margin: 0, fontSize: 12.5 }}>Nadie coincide con esa búsqueda.</span>}
          {busqueda.trim().length < 2 && <span style={{ ...ayuda, margin: 0, fontSize: 12.5 }}>Escribe al menos 2 letras para ver sugerencias.</span>}
        </div>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 14, fontWeight: 600, margin: "14px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button style={btn} onClick={onCancelar} disabled={guardando}>Cancelar</button>
        <button style={btnPrim} onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : a.esNueva ? "Crear asignación" : "Guardar cambios"}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cumplimiento por persona                                           */
/* ------------------------------------------------------------------ */

function Cumplimiento({ asignaciones, todas, directorio, cargandoDirectorio, onIrAsignaciones, soloConAsignacion = false }) {
  const [verSinExigencia, setVerSinExigencia] = useState(false);
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [filtro, setFiltro] = useState("");
  const [soloDeuda, setSoloDeuda] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth();

  const filas = useMemo(() => {
    if (!asignaciones) return [];
    // Personas: todas las que aparecen en alguna asignación + quienes tienen acceso y no tienen ninguna.
    const personas = new Map();
    asignaciones.forEach((a) =>
      tramosDe(a).flatMap((t) => t.personas || []).forEach((p) => {
        const u = directorio.find((d) => esLaPersona(p, d));
        const k = p.uid || `n:${p.nombre}`;
        if (!personas.has(k)) personas.set(k, { uid: p.uid, nombre: u?.nombreUsuario || p.nombre, area: u?.area || "" });
      })
    );
    // Con un formulario elegido, solo quienes tienen asignación en él (no todo el directorio).
    if (!soloConAsignacion) directorio
      .filter((u) => tieneAcceso(u) && u.rol !== "master")
      .forEach((u) => {
        if (![...personas.values()].some((p) => esLaPersona(p, u))) personas.set(u.uid, { uid: u.uid, nombre: u.nombreUsuario, area: u.area || "" });
      });
    const orden = { atrasado: 0, no_cumplido: 1, al_dia: 2, cumplido: 3, sin_exigencia: 4, pendiente: 5, sin_plan: 6 };
    return [...personas.values()]
      .map((p) => filaDeEvaluador(p, asignaciones, todas || [], anio, mes, hoy))
      .sort((x, y) => orden[x.estado] - orden[y.estado] || x.nombre.localeCompare(y.nombre, "es"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones, todas, directorio, anio, mes, soloConAsignacion]);

  const t = sinTildes(filtro.trim());
  // Por defecto solo quienes tienen algo exigido este mes; el resto (plan que parte después, sin plan) se ve con la casilla.
  const conExigencia = (f) => !["sin_exigencia", "sin_plan", "pendiente"].includes(f.estado);
  const ocultos = filas.filter((f) => !conExigencia(f)).length;
  let visibles = verSinExigencia ? filas : filas.filter(conExigencia);
  if (t) visibles = visibles.filter((f) => sinTildes(f.nombre).includes(t) || sinTildes(f.area).includes(t));
  if (soloDeuda) visibles = visibles.filter((f) => f.estado === "atrasado" || f.estado === "no_cumplido");
  const r = resumenDeFilas(filas.filter(conExigencia));
  const exigido = filas.reduce((s, f) => s + f.exigido, 0);
  const hechas = filas.reduce((s, f) => s + f.hechas, 0);
  const general = exigido > 0 ? Math.round((hechas / exigido) * 100) : null;

  if (asignaciones === null || cargandoDirectorio) return <p style={ayuda}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Kpi titulo="Evaluadores con exigencia" valor={r.personas} />
        <Kpi titulo="Cumplido" valor={r.cumplido} color="#0f6e56" />
        <Kpi titulo="Al día" valor={r.al_dia} color="#0f6e56" />
        <Kpi titulo="Atrasados" valor={r.atrasado} color={r.atrasado ? "#ba7517" : undefined} />
        <Kpi titulo="No cumplido" valor={r.no_cumplido} color={r.no_cumplido ? "#993c1d" : undefined} />
        <Kpi titulo="Cumplimiento" valor={general === null ? "—" : `${general}%`} color={colorPorcentaje(general)} />
      </div>

      <div className="ca-card" style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label className="ca-label">Mes</label>
          <select className="rp-select" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="ca-label">Año</label>
          <select className="rp-select" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {[hoy.getFullYear() - 1, hoy.getFullYear()].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <label className="ca-label">Buscar</label>
          <input className="rp-input" value={filtro} placeholder="Nombre o área…" onChange={(e) => setFiltro(e.target.value)} />
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, paddingBottom: 8 }}>
          <input type="checkbox" checked={soloDeuda} onChange={(e) => setSoloDeuda(e.target.checked)} /> Solo con deuda
        </label>
        {ocultos > 0 && (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, paddingBottom: 8 }}>
            <input type="checkbox" checked={verSinExigencia} onChange={(e) => setVerSinExigencia(e.target.checked)} /> Ver también sin exigencia este mes ({ocultos})
          </label>
        )}
      </div>

      {filas.length === 0 ? (
        <div className="cdr-molde">
          <b>Nadie para mostrar todavía</b>
          Crea asignaciones para que aparezcan los evaluadores con su cumplimiento.
          <div style={{ marginTop: 10 }}><button style={btnPrim} onClick={onIrAsignaciones}>Ir a Asignaciones</button></div>
        </div>
      ) : (
        <table className="ca-tabla cdr-apilada">
          <thead>
            <tr><th>Evaluador</th><th>Área</th><th>Asignaciones</th><th>Hecho / exigido</th><th>%</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={7} style={{ color: "var(--texto-suave)" }}>Nadie coincide con ese filtro.</td></tr>}
            {visibles.map((f) => {
              const k = f.uid || f.nombre;
              const abierto = abierta === k;
              return [
                <tr key={k} style={{ cursor: f.detalle.length ? "pointer" : "default" }} onClick={() => f.detalle.length && setAbierta(abierto ? null : k)}>
                  <td><b>{f.nombre}</b></td>
                  <td data-label="Área">{f.area || "—"}</td>
                  <td data-label="Asignaciones">{f.detalle.length}</td>
                  <td data-label="Hecho / exigido">{f.exigido > 0 ? <b style={{ color: colorPorcentaje(f.porcentaje) }}>{f.reales} / {f.exigido}</b> : "—"}</td>
                  <td data-label="%">{f.porcentaje === null ? "—" : <b style={{ color: colorPorcentaje(f.porcentaje) }}>{f.porcentaje}%</b>}</td>
                  <td data-label="Estado"><span className={`ca-pill ${PILL_ESTADO[f.estado]}`}>{ETIQUETA_ESTADO[f.estado]}</span></td>
                  <td style={{ textAlign: "right", color: "var(--texto-suave)" }}>{f.detalle.length ? (abierto ? "▲" : "▼") : ""}</td>
                </tr>,
                abierto && (
                  <tr key={`${k}-detalle`}>
                    <td colSpan={7} style={{ background: "var(--fondo)" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        {f.detalle.map((d) => (
                          <div key={d.asignacion.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", fontSize: 13.5 }}>
                            <b style={{ flex: "1 1 220px" }}>{d.asignacion.reunionNombre}<span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · {d.asignacion.formularioNombre}</span></b>
                            <span style={{ flex: "0 0 auto", color: "var(--texto-suave)" }}>{etiquetaCadencia(d.cantidad, d.frecuencia, d.hasta)}</span>
                            <span style={{ flex: "0 0 90px" }}>{d.exigido > 0 ? `${d.reales} / ${d.exigido}` : "—"}</span>
                            {esMesActual && <span style={{ flex: "0 0 auto", color: d.pendienteAhora ? "#ba7517" : "#0f6e56", fontWeight: 700 }}>{d.pendienteAhora ? `Le falta ${d.pendienteAhora} este periodo` : "✓ al día este periodo"}</span>}
                            <span className={`ca-pill ${PILL_ESTADO[d.estado]}`}>{ETIQUETA_ESTADO[d.estado]}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      )}
      <p style={{ ...ayuda, margin: "10px 0 0", fontSize: 12.5 }}>
        <b>Al día</b> = cubrió todo lo de periodos ya cerrados; el periodo en curso no cuenta en contra hasta que termina ·{" "}
        <b>Atrasado</b> = le falta de periodos que ya cerraron · <b>No cumplido</b> = el mes terminó sin completarse.
        Pincha una fila para ver el detalle por asignación.
      </p>
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

function sinTildes(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ayuda = { fontSize: 13.5, color: "var(--texto-suave)", margin: "0 0 12px" };
const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnSel = { ...btn, background: "var(--verde-claro, #e1f5ee)", borderColor: "var(--verde)", color: "var(--verde-oscuro, #0f6e56)" };
const btnPrim = { ...btn, background: "var(--verde)", borderColor: "var(--verde)", color: "#fff" };
const btnPel = { ...btn, color: "var(--rojo)", borderColor: "#e8b7a8" };
const chipBtn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 100, padding: "5px 12px", fontSize: 13, cursor: "pointer", color: "var(--texto)" };
const x = { background: "none", border: "none", padding: "0 0 0 4px", color: "var(--rojo)", cursor: "pointer", fontSize: 13 };
const mini = { display: "block", fontSize: 10.5, fontWeight: 600, color: "var(--texto-suave)", marginBottom: 2 };
const filaPersona = { background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, padding: "8px 10px", marginBottom: 6 };
