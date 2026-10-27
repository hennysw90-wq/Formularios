import { useEffect, useMemo, useRef, useState } from "react";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import { obtenerFormulario, obtenerEvaluacion, listarEvaluacionesDesde, listarFormulariosPublicados, guardarEvaluacion } from "./evaluaciones.js";
import CumplimientoPlan from "./CumplimientoPlan.jsx";
import ResultadosQR, { VISTA_RESULTADOS_INICIAL } from "./ResultadosQR.jsx";
import { listarUsuarios, verificarClave } from "./auth.js";
import { sugerirUsuarios } from "./buscarUsuarios.js";
import {
  listarAsignaciones,
  proyectarFormulario,
  agendaDePersona,
  filaDeEvaluador,
  etiquetaCadencia,
  ETIQUETA_ESTADO,
} from "./asignaciones.js";
import { Ejecutar, nuevaEvaluacion } from "./MisCdR.jsx";
import { TEXTO_PERIODO } from "./MiAgenda.jsx";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const desde = () => new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10);

/**
 * Lo que se abre al escanear el QR de un formulario, igual que en la app Formularios:
 *   Nombre y apellido → Pendientes (mis formularios asignados) · Cumplimiento Plan · Resultados → responder.
 * Para ver el plan y responder basta con elegir tu nombre; los resultados piden tu clave.
 * Si ya hay sesión iniciada en el dispositivo, entra directo como esa persona.
 */
export default function PaginaQR({ formularioId, rutinaId = "", usuario = null, onIrALaApp }) {
  const [form, setForm] = useState(undefined); // undefined = cargando, null = no existe
  const [asignaciones, setAsignaciones] = useState([]); // todas: para "mis formularios asignados" y "mi cumplimiento"
  const [publicados, setPublicados] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [evals, setEvals] = useState([]);
  const [error, setError] = useState("");
  const [persona, setPersona] = useState(usuario ? { uid: usuario.uid, nombreUsuario: usuario.nombreUsuario, area: usuario.area || "" } : null);
  const [desbloqueado, setDesbloqueado] = useState(!!usuario); // con sesión iniciada ya se conoce la clave
  const [pestana, setPestana] = useState("pendientes");
  const [ejecutando, setEjecutando] = useState(null);
  const [anonima, setAnonima] = useState(false); // al abrir una evaluación recibida no se muestra quién evaluó
  const [borrador, setBorrador] = useState(null);
  const [vistaRes, setVistaRes] = useState(VISTA_RESULTADOS_INICIAL);
  const [porVer, setPorVer] = useState(null); // formulario del historial que se abrirá tras ingresar la clave

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const f = await obtenerFormulario(formularioId);
        if (vivo) setForm(f);
      } catch (e) {
        if (vivo) setError(e.code || e.message || "error");
      }
    })();
    const c1 = listarUsuarios((lista) => setUsuarios(lista.filter((u) => u.rol !== "deshabilitado" && u.estado !== "pendiente")), () => {});
    const c2 = listarEvaluacionesDesde(desde(), setEvals, () => {});
    const c3 = listarAsignaciones(setAsignaciones, () => {});
    const c4 = listarFormulariosPublicados(setPublicados, () => {});
    return () => {
      vivo = false;
      c1();
      c2();
      c3();
      c4();
    };
  }, [formularioId]);

  // Una CdR a medias de esta persona en este formulario (se guarda sola mientras se completa).
  const claveBorrador = persona ? `cdr_qr_${formularioId}_${persona.uid}` : "";
  useEffect(() => {
    let vivo = true;
    setBorrador(null);
    if (!claveBorrador) return undefined;
    let id = "";
    try { id = window.localStorage.getItem(claveBorrador) || ""; } catch { /* sin almacenamiento local */ }
    if (id) obtenerEvaluacion(id).then((e) => vivo && e && e.estado === "borrador" && setBorrador(e)).catch(() => {});
    return () => { vivo = false; };
  }, [claveBorrador, ejecutando]);

  const quien = persona ? { uid: persona.uid, nombreUsuario: persona.nombreUsuario, nombre: persona.nombreUsuario } : null;
  const formPorId = useMemo(() => {
    const m = new Map(publicados.map((f) => [f.id, f]));
    if (form && form.estado === "publicado") m.set(form.id, form);
    return m;
  }, [publicados, form]);
  const grupos = useMemo(() => {
    if (!quien) return [];
    const porForm = new Map();
    agendaDePersona(asignaciones, quien, evals)
      .filter((it) => formPorId.has(it.asignacion.formularioId))
      .forEach((it) => {
        const g = porForm.get(it.asignacion.formularioId) || [];
        g.push(it);
        porForm.set(it.asignacion.formularioId, g);
      });
    return [...porForm.entries()]
      .map(([id, items]) => ({
        formulario: formPorId.get(id),
        // Si el QR es de una reunión, esa va primero.
        items: rutinaId ? items.slice().sort((x, y) => (y.asignacion.reunionId === rutinaId) - (x.asignacion.reunionId === rutinaId)) : items,
      }))
      .sort((x, y) => (y.formulario.id === formularioId) - (x.formulario.id === formularioId) || x.formulario.nombre.localeCompare(y.formulario.nombre, "es"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones, evals, persona, rutinaId, formPorId]);

  function ejecutar(formId, reunionId) {
    const f = formPorId.get(formId) || form;
    const ev = nuevaEvaluacion(proyectarFormulario(f, asignaciones, quien), quien, reunionId);
    try { window.localStorage.setItem(claveBorrador, ev.id); } catch { /* sin almacenamiento local */ }
    setEjecutando(ev);
  }
  async function descartarBorrador() {
    if (!borrador || !window.confirm("¿Borrar este formulario incompleto? Se perderá lo que llevabas respondido.")) return;
    try {
      await guardarEvaluacion({ ...borrador, estado: "descartada", actualizado: new Date().toISOString() });
      try { window.localStorage.removeItem(claveBorrador); } catch { /* sin almacenamiento local */ }
      setBorrador(null);
    } catch (e) {
      window.alert(`No se pudo borrar (${e.code || e.message}).`);
    }
  }
  function cambiarPersona() {
    setPersona(null);
    setDesbloqueado(false);
    setPestana("pendientes");
    setPorVer(null);
    setVistaRes(VISTA_RESULTADOS_INICIAL);
  }

  if (ejecutando) {
    return (
      <div className="ca-pagina">
        <div className="ca-contenido cdr-ejecutar">
          <Ejecutar evaluacionInicial={ejecutando} ocultarEvaluador={anonima} onCerrar={() => { setEjecutando(null); setAnonima(false); setPestana(ejecutando.estado === "enviada" ? pestana : "pendientes"); }} textoVolver={pestana === "plan" ? "← Volver al cumplimiento" : pestana === "resultados" ? "← Volver a evaluaciones recibidas" : "← Volver a mis pendientes"} />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <Envoltorio>
        <div className="ca-card"><p style={{ color: "var(--rojo)", textAlign: "center", margin: 0 }}>No se pudo abrir el formulario ({error}). Revisa tu conexión e inténtalo de nuevo.</p></div>
      </Envoltorio>
    );
  }
  if (form === undefined) return <Envoltorio><p style={{ ...gris, textAlign: "center" }}>Cargando formulario…</p></Envoltorio>;
  if (!form || form.estado !== "publicado") {
    return (
      <Envoltorio>
        <div className="ca-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>⚠️</div>
          <p style={{ fontWeight: 700, marginTop: 8 }}>Formulario no disponible</p>
          <p style={{ ...gris, fontSize: 14 }}>Puede que todavía no esté publicado. Consulta con un administrador.</p>
        </div>
        <PieApp usuario={usuario} onIrALaApp={onIrALaApp} />
      </Envoltorio>
    );
  }

  if (!persona) {
    return (
      <Envoltorio titulo={form.nombre} descripcion={form.descripcion}>
        <Identificarse usuarios={usuarios} onElegir={(u) => setPersona({ uid: u.uid, nombreUsuario: u.nombreUsuario, area: u.area || "" })} />
      </Envoltorio>
    );
  }

  return (
    <Envoltorio titulo={form.nombre} descripcion={form.descripcion}>
      <div className="ca-card">
      <Encabezado persona={persona} onCambiar={usuario ? null : cambiarPersona} />
      <div style={pestanas}>
        <button type="button" onClick={() => setPestana("pendientes")} style={pestanaEstilo(pestana === "pendientes")}>Pendientes</button>
        <button type="button" onClick={() => setPestana("plan")} style={pestanaEstilo(pestana === "plan")}>Cumplimiento de mi Plan</button>
        <button type="button" onClick={() => setPestana("resultados")} style={pestanaEstilo(pestana === "resultados")}>
          {desbloqueado ? "Evaluaciones recibidas" : "🔒 Evaluaciones recibidas"}
        </button>
      </div>

      {pestana === "pendientes" && (
        <Pendientes grupos={grupos} rutinaId={rutinaId} borrador={borrador} onEjecutar={ejecutar} onContinuar={() => setEjecutando(borrador)} onBorrar={descartarBorrador} />
      )}
      {pestana === "plan" &&
        (porVer ? (
          <>
            <button type="button" className="ca-btn-texto" style={{ width: "auto", fontSize: 13, marginBottom: 8 }} onClick={() => setPorVer(null)}>← Volver al cumplimiento</button>
            <PedirClave persona={persona} onOk={() => { setDesbloqueado(true); setEjecutando(porVer); setPorVer(null); }} />
          </>
        ) : (
          <CumplimientoPlan persona={quien} asignaciones={asignaciones} evals={evals} titulo="" compacto conHistorial
            onVer={(e) => (desbloqueado ? setEjecutando(e) : setPorVer(e))} />
        ))}
      {pestana === "resultados" &&
        (desbloqueado ? (
          <ResultadosQR persona={persona} evals={evals} vista={vistaRes} onVista={setVistaRes} onVer={(e) => { setAnonima(true); setEjecutando(e); }} />
        ) : (
          <PedirClave persona={persona} onOk={() => setDesbloqueado(true)} />
        ))}
      </div>
      <PieApp usuario={usuario} onIrALaApp={onIrALaApp} />
    </Envoltorio>
  );
}

/* ─── ¿Quién eres? ─────────────────────────────────────────────────────── */

function Identificarse({ usuarios, onElegir }) {
  // Mismo flujo que el QR de Asistencia: nombre con sugerencias → "Hola de nuevo" (o "¿Eres alguno de estos?").
  // A diferencia de Asistencia, aquí no se crean personas nuevas: solo entran quienes ya tienen usuario.
  const [paso, setPaso] = useState("nombre"); // nombre | confirmar | parecidos | noEncontrado
  const [nombre, setNombre] = useState("");
  const [abiertas, setAbiertas] = useState(false);
  const [candidato, setCandidato] = useState(null);
  const [parecidas, setParecidas] = useState([]);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const cajaRef = useRef(null);

  useEffect(() => {
    if (paso === "nombre" && inputRef.current) inputRef.current.focus();
  }, [paso]);
  useEffect(() => {
    const fuera = (ev) => { if (cajaRef.current && !cajaRef.current.contains(ev.target)) setAbiertas(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const escrito = nombre.trim();
  const sugerencias = escrito.length >= 2 ? sugerirUsuarios(escrito, usuarios, { max: 6 }).filter((u) => !u.parecido) : [];

  function elegir(u) {
    setAbiertas(false);
    setNombre(u.nombreUsuario);
    setCandidato(u);
    setPaso("confirmar");
  }
  function continuar(ev) {
    ev.preventDefault();
    setError("");
    if (escrito.length < 2) return setError("Escribe tu nombre y apellido.");
    setAbiertas(false);
    const exacto = usuarios.find((u) => norm(u.nombreUsuario) === norm(escrito));
    if (exacto) return elegir(exacto);
    const similares = sugerirUsuarios(escrito, usuarios, { max: 6 });
    if (similares.length) {
      setParecidas(similares);
      setPaso("parecidos");
    } else {
      setPaso("noEncontrado");
    }
  }

  if (paso === "confirmar" && candidato) {
    return (
      <div className="ca-card">
        <p style={{ fontSize: 14, ...gris, marginTop: 0, marginBottom: 4 }}>Hola de nuevo,</p>
        <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 14px" }}>{candidato.nombreUsuario}</p>
        {candidato.area && <p style={{ margin: "-8px 0 14px" }}><span className="ca-chip">{candidato.area}</span></p>}
        <button className="ca-btn" onClick={() => onElegir(candidato)}>Continuar</button>
        <button type="button" className="ca-btn-texto" style={{ marginTop: 6, width: "100%" }} onClick={() => { setCandidato(null); setPaso("nombre"); }}>
          ← No soy yo, volver
        </button>
      </div>
    );
  }

  if (paso === "parecidos") {
    return (
      <div className="ca-card">
        <p style={{ fontSize: 14, ...gris, marginTop: 0, marginBottom: 4 }}>
          No encontramos "{escrito}" exactamente, pero hay nombres parecidos. ¿Eres alguno de estos?
        </p>
        <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: "1px solid var(--borde)" }}>
          {parecidas.map((u, i) => (
            <button type="button" key={u.uid} onClick={() => elegir(u)} style={{ ...filaSugerencia, borderTop: i === 0 ? "none" : "1px solid var(--borde)" }}>
              <span style={{ fontWeight: 600 }}>{u.nombreUsuario}</span>
              {u.area && <span className="ca-chip">{u.area}</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, ...gris, margin: "12px 0 0" }}>Si no apareces, pide a un administrador que te cree el usuario.</p>
        <button type="button" className="ca-btn-texto" style={{ marginTop: 6, width: "100%" }} onClick={() => setPaso("nombre")}>
          ← Volver a escribir mi nombre
        </button>
      </div>
    );
  }

  if (paso === "noEncontrado") {
    return (
      <div className="ca-card">
        <p style={{ fontWeight: 700, margin: "0 0 6px" }}>No encontramos "{escrito}"</p>
        <p style={{ fontSize: 14, ...gris, margin: 0 }}>
          Revisa cómo está escrito. Si es la primera vez que usas Formularios, pide a un administrador que te cree el usuario.
        </p>
        <button type="button" className="ca-btn" style={{ marginTop: 14 }} onClick={() => setPaso("nombre")}>
          ← Volver a escribir mi nombre
        </button>
      </div>
    );
  }

  return (
    <form className="ca-card" onSubmit={continuar}>
      <label className="ca-label" htmlFor="nombre-qr">Nombre y apellido</label>
      <div ref={cajaRef} style={{ position: "relative" }}>
        <input
          id="nombre-qr"
          ref={inputRef}
          className="rp-input"
          placeholder="Ej: Juan Pérez"
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); setAbiertas(true); }}
          onFocus={() => setAbiertas(true)}
          autoComplete="off"
        />
        {abiertas && sugerencias.length > 0 && (
          <div style={listaFlotante}>
            {sugerencias.map((u) => (
              <button type="button" key={u.uid} onClick={() => elegir(u)} style={{ ...filaSugerencia, borderTop: "1px solid var(--borde)" }}>
                <span style={{ fontWeight: 600 }}>{u.nombreUsuario}</span>
                {u.area && <span className="ca-chip">{u.area}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 8 }}>{error}</p>}
      <button className="ca-btn" style={{ marginTop: 14 }}>Continuar</button>
    </form>
  );
}

function Encabezado({ persona, onCambiar }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{persona.nombreUsuario}</p>
        {persona.area && <p style={{ ...gris, fontSize: 12, margin: 0 }}>{persona.area}</p>}
      </div>
      {onCambiar && (
        <button className="ca-btn-texto" style={{ fontSize: 12, width: "auto" }} onClick={onCambiar}>No soy yo</button>
      )}
    </div>
  );
}

/* ─── Pendientes ───────────────────────────────────────────────────────── */

function Pendientes({ grupos, rutinaId, borrador, onEjecutar, onContinuar, onBorrar }) {
  return (
    <>
      {borrador && (
        <div style={{ ...tarjeta(false), borderColor: "var(--ambar)" }}>
          <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>Tienes uno incompleto</p>
          <p style={{ ...gris, fontSize: 12, margin: 0 }}>{borrador.rutinaNombre || "Sin reunión"}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="cdr-nav-btn prim" style={{ flex: 1 }} onClick={onContinuar}>Continuar</button>
            <button className="cdr-nav-btn" style={{ color: "var(--rojo, #b02a26)" }} onClick={onBorrar}>Borrar</button>
          </div>
        </div>
      )}
      <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 10px" }}>Mis formularios asignados</p>
      {grupos.length === 0 ? (
        <p style={{ ...gris, fontSize: 14, textAlign: "center", padding: "14px 0" }}>
          No tienes formularios asignados. Si crees que es un error, avísale a un administrador.
        </p>
      ) : (
        grupos.map((g) => (
          <div key={g.formulario.id} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--verde-oscuro)", margin: "0 0 6px" }}>{g.formulario.nombre}</p>
            {g.items.map((it) => {
              const a = it.asignacion;
              const periodo = TEXTO_PERIODO[it.frecuencia] || "en este periodo";
              return (
                <div key={a.id} style={{ ...tarjeta(it.completa || !it.empezo), ...(rutinaId && a.reunionId === rutinaId ? { boxShadow: "0 0 0 2px var(--verde-claro)" } : {}) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>{a.reunionNombre || "Sin reunión"}</p>
                      <p style={{ ...gris, fontSize: 12, margin: 0 }}>
                        {etiquetaCadencia(it.cantidad, it.frecuencia)} · {it.hechasReales} de {it.cantidad} {periodo}
                      </p>
                      {(a.lideres || []).length > 0 && <p style={{ ...gris, fontSize: 12, margin: "2px 0 0" }}>Líder: {a.lideres.join(", ")}</p>}
                    </div>
                    {!it.empezo ? (
                      <span style={chipNeutro}>Desde {it.desde.split("-").reverse().join("-")}</span>
                    ) : it.completa ? (
                      <span style={chipOk}>✓ Al día</span>
                    ) : (
                      <span style={chipPendiente}>{it.pendientes} pendiente{it.pendientes === 1 ? "" : "s"}</span>
                    )}
                  </div>
                  <button className={`cdr-nav-btn ${it.completa || !it.empezo ? "" : "prim"}`} style={{ marginTop: 10, width: "100%" }} onClick={() => onEjecutar(g.formulario.id, a.reunionId)}>
                    {it.completa ? "Responder otra vez" : "Ejecutar formulario"}
                  </button>
                </div>
              );
            })}
          </div>
        ))
      )}
    </>
  );
}

/* ─── Resultados (con clave) ───────────────────────────────────────────── */

function PedirClave({ persona, onOk }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [revisando, setRevisando] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    setRevisando(true);
    setError("");
    try {
      if (await verificarClave(persona.uid, clave)) onOk();
      else setError("Clave incorrecta.");
    } catch {
      setError("No se pudo verificar la clave. Revisa tu conexión.");
    } finally {
      setRevisando(false);
    }
  }
  return (
    <form onSubmit={enviar}>
      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>🔒 Ingresa tu clave</p>
      <p style={{ ...gris, fontSize: 13, margin: "0 0 12px" }}>Para ver el detalle de tus evaluaciones, ingresa tu clave (la misma de las apps). Con una vez se desbloquea todo.</p>
      <input className="rp-input" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Tu clave" autoFocus />
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
      <button className="cdr-nav-btn prim" style={{ marginTop: 10, width: "100%" }} disabled={!clave || revisando}>{revisando ? "Revisando…" : "Desbloquear"}</button>
    </form>
  );
}

/* ─── Marco ────────────────────────────────────────────────────────────── */

function PieApp({ usuario, onIrALaApp }) {
  if (!usuario || !onIrALaApp) return null;
  return (
    <p style={{ textAlign: "center", margin: "14px 0 0" }}>
      <button className="ca-btn-texto" style={{ fontSize: 12, width: "auto" }} onClick={onIrALaApp}>Ir a la app →</button>
    </p>
  );
}

function Envoltorio({ titulo, descripcion, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 40 }} />
        </div>
        {titulo && (
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <p style={{ fontWeight: 800, fontSize: 19, margin: 0 }}>{titulo}</p>
            {descripcion && (
              <p style={{ ...gris, fontSize: 13, margin: "6px 0 0" }}>{descripcion.length > 180 ? descripcion.slice(0, 180) + "…" : descripcion}</p>
            )}
          </div>
        )}
        {children}
        <p style={{ textAlign: "center", fontSize: 10, color: "#b8c4c2", marginTop: 16 }}>Formularios · Henny</p>
      </div>
    </div>
  );
}

// Semáforo: verde desde 95%, ámbar desde 80%, rojo bajo 80%.
function tono(p) {
  if (p === null || p === undefined) return "var(--texto-suave)";
  if (p >= 95) return "#1b7a46";
  if (p >= 80) return "#B5820A";
  return "#b02a26";
}

const gris = { color: "var(--texto-suave)" };
const listaFlotante = { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, boxShadow: "0 8px 20px rgba(20,50,45,0.14)", zIndex: 30, overflow: "hidden" };
const filaSugerencia = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
const filaPersona = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", textAlign: "left", background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, padding: "9px 12px", marginBottom: 6, cursor: "pointer", fontFamily: "inherit" };
const etiquetaParecido = { fontSize: 10, fontWeight: 700, color: "#8a5a00", background: "#fbe8c8", borderRadius: 100, padding: "1px 7px" };
const chipOk = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "var(--verde-claro)", color: "var(--verde-oscuro)", whiteSpace: "nowrap" };
const chipPendiente = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fbe8c8", color: "#8a5a00", whiteSpace: "nowrap" };
const chipNeutro = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, border: "1px solid var(--borde)", color: "var(--texto-suave)", whiteSpace: "nowrap" };
const cajaTotal = { textAlign: "center", background: "var(--fondo)", border: "1px solid var(--borde)", borderRadius: 12, padding: "14px 12px", marginBottom: 12 };
const tarjetaDim = { border: "1px solid var(--borde)", borderRadius: 12, padding: 12, marginBottom: 8, background: "#fff" };
const pestanas = { display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid var(--borde)" };

function tarjeta(completa) {
  return { border: `1px solid ${completa ? "var(--borde)" : "var(--verde)"}`, borderRadius: 12, padding: 12, marginBottom: 10, background: completa ? "var(--fondo)" : "#fff" };
}
function pestanaEstilo(activa) {
  return {
    flex: 1,
    background: "none",
    border: "none",
    borderBottom: `2px solid ${activa ? "var(--verde)" : "transparent"}`,
    color: activa ? "var(--verde-oscuro)" : "var(--texto-suave)",
    fontWeight: activa ? 700 : 600,
    fontSize: 13,
    padding: "8px 4px",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
