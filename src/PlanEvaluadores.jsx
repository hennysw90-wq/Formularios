import { useEffect, useMemo, useState } from "react";
import { APP_ACTUAL_ID } from "./auth.js";
import { listarRutinasAsistencia, describirFrecuencia } from "./firebaseAsistencia.js";
import { sugerirUsuarios } from "./buscarUsuarios.js";
import {
  FRECUENCIAS,
  ETIQUETA_ESTADO,
  etiquetaCadencia,
  listarAsignaciones,
  guardarAsignacion,
  eliminarAsignacion,
  nuevoIdAsignacion,
  filaDeEvaluador,
  resumenDeFilas,
  esLaPersona,
  listarPlanesAnteriores,
  propuestasDesdeModeloAnterior,
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
export default function PlanEvaluadores({ todas, formularios, usuario, usuarios = null, errorUsuarios = false }) {
  const [asignaciones, setAsignaciones] = useState(null);
  const [reuniones, setReuniones] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState(null); // "cumplimiento" | "asignaciones"
  const [editando, setEditando] = useState(null); // asignación en edición (copia)
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });

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

  const lista = asignaciones || [];
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
    if (!window.confirm(`¿Eliminar la asignación de "${a.reunionNombre}" (${a.formularioNombre})? Las CdR ya hechas no se borran.`)) return;
    try {
      await eliminarAsignacion(a.id);
      setAviso({ tipo: "ok", texto: "Asignación eliminada." });
    } catch (e) {
      setAviso({ tipo: "error", texto: `No se pudo eliminar (${e.code || e.message}).` });
    }
  }

  return (
    <div>
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
          asignaciones={asignaciones}
          formPorId={formPorId}
          onEditar={(a) => { setAviso({ tipo: "", texto: "" }); setEditando({ ...JSON.parse(JSON.stringify(a)), esNueva: false }); }}
          onEliminar={borrar}
          onNueva={nueva}
          directorio={directorio}
        />
      )}

      {!editando && vistaActual === "cumplimiento" && (
        <Cumplimiento asignaciones={asignaciones} todas={todas} directorio={directorio} cargandoDirectorio={!Array.isArray(usuarios) && !errorUsuarios} onIrAsignaciones={() => setVista("asignaciones")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lista de asignaciones                                              */
/* ------------------------------------------------------------------ */

function ListaAsignaciones({ asignaciones, formPorId, onEditar, onEliminar, onNueva, directorio = [] }) {
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
                        <div style={{ fontWeight: 800 }}>{a.reunionNombre}{a.area ? <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · {a.area}</span> : ""}</div>
                        <div style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 2 }}>
                          Líderes: {(a.lideres || []).length
                            ? a.lideres.map((l, i) => <span key={l}>{i ? ", " : ""}{l}{directorio.length && !tieneUsuario(l) ? <b style={{ color: "#993c1d" }}> (sin usuario)</b> : ""}</span>)
                            : <span style={{ color: "#993c1d" }}>sin líder: edítala para agregarlo</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {(a.personas || []).map((p) => (
                            <span key={p.uid || p.nombre} className="ca-chip" style={{ fontWeight: 600 }} title={p.desde ? `Se controla desde ${p.desde}` : ""}>
                              {p.nombre} · {etiquetaCadencia(p.cantidad, p.frecuencia, p.frecuencia === "unica" ? p.hasta : "")}{p.desde ? ` · desde ${p.desde.split("-").reverse().join("-")}` : ""}
                            </span>
                          ))}
                          {!(a.personas || []).length && <span style={{ fontSize: 13, color: "var(--rojo)" }}>Sin evaluadores</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={btn} onClick={() => onEditar(a)}>Editar</button>
                        <button style={btnPel} onClick={() => onEliminar(a)}>Eliminar</button>
                      </div>
                    </div>
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

function EditorAsignacion({ inicial, formularios, reuniones, directorio, onCancelar, onGuardada }) {
  const [a, setA] = useState(inicial);
  const [buscaLider, setBuscaLider] = useState("");
  const [busqueda, setBusqueda] = useState("");
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
  const reunionHuerfana = a.reunionId && reuniones && !reunionActual;

  function elegirFormulario(id) {
    const f = formularios.find((x) => x.id === id);
    cambiar({ formularioId: id, formularioNombre: f ? f.nombre : "" });
  }
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
        : [...(a.personas || []), { uid: u.uid, nombre: u.nombreUsuario, cantidad: 1, frecuencia: "semanal", desde: "" }],
    });
    setBusqueda("");
  }
  function cambiarPersona(uid, campo, valor) {
    cambiar({ personas: a.personas.map((p) => (p.uid === uid ? { ...p, [campo]: valor } : p)) });
  }

  async function guardar() {
    if (!a.formularioId) return setError("Elige el formulario.");
    if (!a.reunionId) return setError("Elige la reunión.");
    if (!(a.lideres || []).length) return setError("Agrega al menos un líder a evaluar.");
    const sinUsuario = (a.lideres || []).filter((n) => !usuarioDe(n));
    if (sinUsuario.length) return setError(`Estos líderes no tienen usuario: ${sinUsuario.join(", ")}. Quítalos o créales usuario en Administración.`);
    if (!(a.personas || []).length) return setError("Agrega al menos un evaluador.");
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
      await guardarAsignacion({ ...datos, creado: datos.creado || new Date().toISOString() });
      onGuardada(esNueva ? `Asignación creada: ${a.reunionNombre}.` : "Asignación guardada.");
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
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="ca-label">Líderes a evaluar *</label>
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
        <label className="ca-label">Evaluadores *</label>
        <p style={{ ...ayuda, margin: "0 0 8px", fontSize: 12.5 }}>Cada uno con su propia cadencia.</p>
        {elegidos.map((p) => {
          const u = directorio.find((d) => esLaPersona(p, d));
          const sinAcceso = u && !tieneAcceso(u);
          return (
            <div key={p.uid || p.nombre} style={filaPersona}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <b style={{ flex: 1, minWidth: 0 }}>{p.nombre}</b>
                {sinAcceso && <span className="ca-pill ca-pill-ambar" title="Puede evaluar por QR, pero no iniciar sesión hasta que se le marque la app en Administración">Sin acceso a la app</span>}
                <button style={x} title="Quitar" onClick={() => alternarPersona({ uid: p.uid, nombreUsuario: p.nombre })}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 6 }}>
                <div style={{ flex: "0 0 86px" }}>
                  <label style={mini}>Cantidad</label>
                  <input className="rp-input" type="number" min="1" value={p.cantidad ?? 1} onChange={(e) => cambiarPersona(p.uid, "cantidad", e.target.value)} aria-label={`Cantidad de ${p.nombre}`} />
                </div>
                <div style={{ flex: "1 1 150px" }}>
                  <label style={mini}>Frecuencia</label>
                  <select className="rp-select" value={p.frecuencia || "semanal"} onChange={(e) => cambiarPersona(p.uid, "frecuencia", e.target.value)} aria-label={`Frecuencia de ${p.nombre}`}>
                    {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
                  </select>
                </div>
                <div style={{ flex: "0 0 160px" }}>
                  <label style={mini}>{p.frecuencia === "unica" ? "Ejecutar desde" : "Controlar desde"}</label>
                  <input className="rp-input" type="date" value={p.desde || ""} title="Vacío = desde que se crea la asignación" onChange={(e) => cambiarPersona(p.uid, "desde", e.target.value)} aria-label={`Desde de ${p.nombre}`} />
                </div>
                {p.frecuencia === "unica" && (
                  <div style={{ flex: "0 0 160px" }}>
                    <label style={mini}>Hasta (plazo) *</label>
                    <input className="rp-input" type="date" value={p.hasta || ""} min={p.desde || undefined} onChange={(e) => cambiarPersona(p.uid, "hasta", e.target.value)} aria-label={`Hasta de ${p.nombre}`} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#0f6e56", fontWeight: 600, marginTop: 4 }}>
                {etiquetaCadencia(p.cantidad ?? 1, p.frecuencia || "semanal", p.frecuencia === "unica" ? p.hasta : "")}
                {p.frecuencia === "unica" && <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · solo cuentan las CdR hechas {p.desde ? `entre el ${p.desde.split("-").reverse().join("-")}` : "desde que se crea la asignación"}{p.hasta ? ` y el ${p.hasta.split("-").reverse().join("-")}` : " y la fecha de plazo"}</span>}
              </div>
            </div>
          );
        })}
        <input className="rp-input" style={{ maxWidth: 420, marginTop: 4 }} value={busqueda} placeholder="Buscar evaluador por nombre o área…" onChange={(e) => setBusqueda(e.target.value)} />
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

function Cumplimiento({ asignaciones, todas, directorio, cargandoDirectorio, onIrAsignaciones }) {
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
      (a.personas || []).forEach((p) => {
        const u = directorio.find((d) => esLaPersona(p, d));
        const k = p.uid || `n:${p.nombre}`;
        if (!personas.has(k)) personas.set(k, { uid: p.uid, nombre: u?.nombreUsuario || p.nombre, area: u?.area || "" });
      })
    );
    directorio
      .filter((u) => tieneAcceso(u) && u.rol !== "master")
      .forEach((u) => {
        if (![...personas.values()].some((p) => esLaPersona(p, u))) personas.set(u.uid, { uid: u.uid, nombre: u.nombreUsuario, area: u.area || "" });
      });
    const orden = { atrasado: 0, no_cumplido: 1, al_dia: 2, cumplido: 3, sin_exigencia: 4, pendiente: 5, sin_plan: 6 };
    return [...personas.values()]
      .map((p) => filaDeEvaluador(p, asignaciones, todas || [], anio, mes, hoy))
      .sort((x, y) => orden[x.estado] - orden[y.estado] || x.nombre.localeCompare(y.nombre, "es"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones, todas, directorio, anio, mes]);

  const t = sinTildes(filtro.trim());
  let visibles = t ? filas.filter((f) => sinTildes(f.nombre).includes(t) || sinTildes(f.area).includes(t)) : filas;
  if (soloDeuda) visibles = visibles.filter((f) => f.estado === "atrasado" || f.estado === "no_cumplido");
  const r = resumenDeFilas(filas);
  const exigido = filas.reduce((s, f) => s + f.exigido, 0);
  const hechas = filas.reduce((s, f) => s + f.hechas, 0);
  const general = exigido > 0 ? Math.round((hechas / exigido) * 100) : null;

  if (asignaciones === null || cargandoDirectorio) return <p style={ayuda}>Cargando…</p>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Kpi titulo="Evaluadores" valor={r.personas} />
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
