import { useEffect, useMemo, useState } from "react";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import { obtenerFormulario, obtenerEvaluacion, listarEvaluacionesDesde } from "./evaluaciones.js";
import { listarUsuarios, verificarClave } from "./auth.js";
import { sugerirUsuarios } from "./buscarUsuarios.js";
import {
  asignacionesDeFormulario,
  proyectarFormulario,
  agendaDePersona,
  filaDeEvaluador,
  etiquetaCadencia,
  ETIQUETA_ESTADO,
} from "./asignaciones.js";
import { Ejecutar, nuevaEvaluacion } from "./MisCdR.jsx";
import { ETIQUETA_CLASIFICACION } from "./calculo.js";
import { fechaCdR } from "./estadisticas.js";
import { TEXTO_PERIODO } from "./MiAgenda.jsx";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const desde = () => new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10);

/**
 * Lo que se abre al escanear el QR de un formulario, igual que en la app Formularios:
 *   ¿Quién eres? → Pendientes · Mi plan · Resultados → responder.
 * Para ver el plan y responder basta con elegir tu nombre; los resultados piden tu clave.
 * Si ya hay sesión iniciada en el dispositivo, entra directo como esa persona.
 */
export default function PaginaQR({ formularioId, rutinaId = "", usuario = null, onIrALaApp }) {
  const [form, setForm] = useState(undefined); // undefined = cargando, null = no existe
  const [asignaciones, setAsignaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [evals, setEvals] = useState([]);
  const [error, setError] = useState("");
  const [persona, setPersona] = useState(usuario ? { uid: usuario.uid, nombreUsuario: usuario.nombreUsuario, area: usuario.area || "" } : null);
  const [desbloqueado, setDesbloqueado] = useState(!!usuario); // con sesión iniciada ya se conoce la clave
  const [pestana, setPestana] = useState("pendientes");
  const [ejecutando, setEjecutando] = useState(null);
  const [borrador, setBorrador] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const f = await obtenerFormulario(formularioId);
        const a = f ? await asignacionesDeFormulario(formularioId) : [];
        if (vivo) {
          setAsignaciones(a);
          setForm(f);
        }
      } catch (e) {
        if (vivo) setError(e.code || e.message || "error");
      }
    })();
    const c1 = listarUsuarios((lista) => setUsuarios(lista.filter((u) => u.rol !== "deshabilitado" && u.estado !== "pendiente")), () => {});
    const c2 = listarEvaluacionesDesde(desde(), setEvals, () => {});
    return () => {
      vivo = false;
      c1();
      c2();
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
  const agenda = useMemo(() => {
    if (!quien) return [];
    const items = agendaDePersona(asignaciones, quien, evals);
    // Si el QR es de una reunión, esa va primero.
    return rutinaId ? items.slice().sort((x, y) => (y.asignacion.reunionId === rutinaId) - (x.asignacion.reunionId === rutinaId)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones, evals, persona, rutinaId]);

  function ejecutar(reunionId) {
    const ev = nuevaEvaluacion(proyectarFormulario(form, asignaciones, quien), quien, reunionId);
    try { window.localStorage.setItem(claveBorrador, ev.id); } catch { /* sin almacenamiento local */ }
    setEjecutando(ev);
  }
  function cambiarPersona() {
    setPersona(null);
    setDesbloqueado(false);
    setPestana("pendientes");
  }

  if (ejecutando) {
    return (
      <div className="ca-pagina">
        <div className="ca-contenido cdr-ejecutar">
          <Ejecutar evaluacionInicial={ejecutando} onCerrar={() => { setEjecutando(null); setPestana(ejecutando.estado === "enviada" ? pestana : "pendientes"); }} textoVolver="← Volver a mis pendientes" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <Envoltorio>
        <p style={{ color: "var(--rojo)", textAlign: "center" }}>No se pudo abrir el formulario ({error}). Revisa tu conexión e inténtalo de nuevo.</p>
      </Envoltorio>
    );
  }
  if (form === undefined) return <Envoltorio><p style={{ ...gris, textAlign: "center" }}>Cargando…</p></Envoltorio>;
  if (!form || form.estado !== "publicado") {
    return (
      <Envoltorio titulo="Formulario no disponible">
        <p style={{ ...gris, textAlign: "center", fontSize: 14 }}>Puede que todavía no esté publicado. Consulta con un administrador.</p>
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
      <Encabezado persona={persona} onCambiar={usuario ? null : cambiarPersona} />
      <div style={pestanas}>
        <button type="button" onClick={() => setPestana("pendientes")} style={pestanaEstilo(pestana === "pendientes")}>Pendientes</button>
        <button type="button" onClick={() => setPestana("plan")} style={pestanaEstilo(pestana === "plan")}>Mi plan</button>
        <button type="button" onClick={() => setPestana("resultados")} style={pestanaEstilo(pestana === "resultados")}>
          {desbloqueado ? "Resultados" : "🔒 Resultados"}
        </button>
      </div>

      {pestana === "pendientes" && (
        <Pendientes agenda={agenda} rutinaId={rutinaId} borrador={borrador} onEjecutar={ejecutar} onContinuar={() => setEjecutando(borrador)} />
      )}
      {pestana === "plan" && <MiPlan persona={quien} asignaciones={asignaciones} evals={evals} />}
      {pestana === "resultados" &&
        (desbloqueado ? (
          <Resultados persona={persona} formularioId={form.id} evals={evals} onVer={setEjecutando} />
        ) : (
          <PedirClave persona={persona} onOk={() => setDesbloqueado(true)} />
        ))}
      <PieApp usuario={usuario} onIrALaApp={onIrALaApp} />
    </Envoltorio>
  );
}

/* ─── ¿Quién eres? ─────────────────────────────────────────────────────── */

function Identificarse({ usuarios, onElegir }) {
  const [texto, setTexto] = useState("");
  const escrito = texto.trim();
  const filtrados = sugerirUsuarios(escrito, usuarios);
  return (
    <>
      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>¿Quién eres?</p>
      <p style={{ ...gris, fontSize: 13, margin: "0 0 12px" }}>Escribe tu nombre y elígete de las sugerencias.</p>
      <input className="rp-input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Tu nombre" autoFocus />
      <div style={{ marginTop: 10 }}>
        {filtrados.map((u) => (
          <button key={u.uid} type="button" onClick={() => onElegir(u)} style={filaPersona}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{u.nombreUsuario}</strong>
              {u.parecido && <span style={etiquetaParecido}>parecido</span>}
            </span>
            {u.area && <span style={{ ...gris, fontSize: 12 }}>{u.area}</span>}
          </button>
        ))}
        {escrito.length >= 2 && filtrados.length === 0 && (
          <p style={{ ...gris, fontSize: 13, margin: 0 }}>No encontramos ese nombre. Revisa cómo está escrito o pide a un administrador que te cree el usuario.</p>
        )}
        {escrito.length < 2 && <p style={{ ...gris, fontSize: 12, margin: 0 }}>Escribe al menos 2 letras para ver sugerencias.</p>}
      </div>
    </>
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

function Pendientes({ agenda, rutinaId, borrador, onEjecutar, onContinuar }) {
  return (
    <>
      {borrador && (
        <div style={{ ...tarjeta(false), borderColor: "var(--ambar)" }}>
          <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>Tienes una a medias</p>
          <p style={{ ...gris, fontSize: 12, margin: 0 }}>{borrador.rutinaNombre || "Sin reunión"}</p>
          <button className="cdr-nav-btn prim" style={{ marginTop: 10, width: "100%" }} onClick={onContinuar}>Continuar</button>
        </div>
      )}
      {agenda.length === 0 ? (
        <p style={{ ...gris, fontSize: 14, textAlign: "center", padding: "14px 0" }}>
          No tienes este formulario asignado. Si crees que es un error, avísale a un administrador.
        </p>
      ) : (
        agenda.map((it) => {
          const a = it.asignacion;
          const periodo = TEXTO_PERIODO[it.frecuencia] || "en este periodo";
          return (
            <div key={a.id} style={{ ...tarjeta(it.completa || !it.empezo), ...(rutinaId && a.reunionId === rutinaId ? { boxShadow: "0 0 0 2px var(--verde-claro)" } : {}) }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>{a.reunionNombre || "Sin reunión"}</p>
                  <p style={{ ...gris, fontSize: 12, margin: 0 }}>
                    {etiquetaCadencia(it.cantidad, it.frecuencia)} · {it.hechasEnPeriodo} de {it.cantidad} {periodo}
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
              <button className={`cdr-nav-btn ${it.completa || !it.empezo ? "" : "prim"}`} style={{ marginTop: 10, width: "100%" }} onClick={() => onEjecutar(a.reunionId)}>
                {it.completa ? "Responder otra vez" : "Ejecutar formulario"}
              </button>
            </div>
          );
        })
      )}
    </>
  );
}

/* ─── Mi plan ──────────────────────────────────────────────────────────── */

function MiPlan({ persona, asignaciones, evals }) {
  const hoy = new Date();
  const meses = [0, 1, 2].map((i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });
  const filas = meses.map(({ anio, mes }) => ({ anio, mes, fila: filaDeEvaluador(persona, asignaciones, evals, anio, mes, hoy) }));
  const actual = filas[0].fila;
  if (!actual.detalle.length) {
    return <p style={{ ...gris, fontSize: 14, textAlign: "center", padding: "14px 0" }}>No tienes asignaciones en este formulario.</p>;
  }
  return (
    <>
      <div style={cajaTotal}>
        <span style={{ fontSize: 13, ...gris }}>Mi cumplimiento de {MESES[filas[0].mes]}</span>
        <div style={{ fontSize: 34, fontWeight: 800, color: tono(actual.porcentaje), lineHeight: 1.1 }}>
          {actual.porcentaje === null ? "—" : `${actual.porcentaje}%`}
        </div>
        <span style={{ fontSize: 12, ...gris }}>
          {actual.exigido > 0 ? `${actual.hechas} de ${actual.exigido} hechas · ` : ""}{ETIQUETA_ESTADO[actual.estado]}
        </span>
      </div>

      {actual.detalle.map((d) => {
        const pct = d.exigido > 0 ? Math.round((d.hechas / d.exigido) * 100) : null;
        return (
          <div key={d.asignacion.id} style={tarjetaDim}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: 14 }}>{d.asignacion.reunionNombre}</p>
                <div style={{ background: "var(--borde)", borderRadius: 100, height: 7, overflow: "hidden" }}>
                  <div style={{ width: `${pct ?? 0}%`, height: "100%", background: tono(pct), borderRadius: 100 }} />
                </div>
                <p style={{ ...gris, fontSize: 11, margin: "5px 0 0" }}>
                  {etiquetaCadencia(d.cantidad, d.frecuencia)} · {d.exigido > 0 ? `${d.hechas} de ${d.exigido} este mes` : "nada exigido aún"}
                </p>
              </div>
              <strong style={{ fontSize: 19, color: tono(pct), minWidth: 52, textAlign: "right" }}>{pct === null ? "—" : `${pct}%`}</strong>
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 12, fontWeight: 700, margin: "14px 0 6px" }}>Meses anteriores</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {filas.slice(1).map(({ mes, fila }) => (
          <span key={mes} style={{ ...chipNeutro, color: tono(fila.porcentaje), borderColor: tono(fila.porcentaje) }}>
            {MESES[mes]}: {fila.porcentaje === null ? "—" : `${fila.porcentaje}%`}
          </span>
        ))}
      </div>
      <p style={{ ...gris, fontSize: 11, margin: "8px 0 0" }}>El periodo en curso no cuenta en contra hasta que termina.</p>
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
      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>🔒 Tus resultados</p>
      <p style={{ ...gris, fontSize: 13, margin: "0 0 12px" }}>Para ver los resultados de tus CdR, ingresa tu clave (la misma de las apps).</p>
      <input className="rp-input" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Tu clave" autoFocus />
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
      <button className="cdr-nav-btn prim" style={{ marginTop: 10, width: "100%" }} disabled={!clave || revisando}>{revisando ? "Revisando…" : "Ver mis resultados"}</button>
    </form>
  );
}

function Resultados({ persona, formularioId, evals, onVer }) {
  const yo = norm(persona.nombreUsuario);
  const delForm = evals.filter((e) => e.formularioId === formularioId && e.estado === "enviada" && !e.anulada);
  const hechas = delForm
    .filter((e) => e.evaluadorUid === persona.uid || e.registradoPorUid === persona.uid || norm(e.evaluadorNombre) === yo)
    .sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a)));
  const recibidas = delForm.filter((e) => norm(e.lider) === yo).sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a)));
  return (
    <>
      <ListaResultados titulo="CdR que te hicieron como líder" vacio="Nadie te ha evaluado con este formulario todavía." lista={recibidas} quien={(e) => `Evaluó: ${e.evaluadorNombre}`} onVer={onVer} />
      <ListaResultados titulo="CdR que hiciste" vacio="Todavía no has enviado ninguna con este formulario." lista={hechas} quien={(e) => `Líder: ${e.lider}`} onVer={onVer} />
    </>
  );
}

function ListaResultados({ titulo, vacio, lista, quien, onVer }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 700, fontSize: 14, margin: "0 0 8px" }}>{titulo} ({lista.length})</p>
      {lista.length === 0 && <p style={{ ...gris, fontSize: 13, margin: 0 }}>{vacio}</p>}
      {lista.map((e) => {
        const ind = e.resultado?.indice;
        return (
          <div key={e.id} style={{ ...tarjeta(true), display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 13.5 }}>{e.rutinaNombre}</p>
              <p style={{ ...gris, fontSize: 12, margin: 0 }}>{fechaCdR(e).split("-").reverse().join("-")} · {quien(e)}</p>
              <p style={{ fontSize: 12, margin: "2px 0 0", fontWeight: 700, color: tono(ind) }}>
                {ind === undefined || ind === null ? "—" : `${String(Math.round(ind * 10) / 10).replace(".", ",")}%`} · {ETIQUETA_CLASIFICACION[e.resultado?.clasificacion] || "—"}
              </p>
            </div>
            <button className="cdr-nav-btn" onClick={() => onVer(e)}>Ver</button>
          </div>
        );
      })}
    </div>
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16 }}>
      <div className="ca-card" style={{ width: "100%", maxWidth: 420, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 42 }} />
        </div>
        {titulo && <p style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>{titulo}</p>}
        {descripcion && (
          <p style={{ textAlign: "center", ...gris, fontSize: 13, margin: "0 0 16px" }}>
            {descripcion.length > 180 ? descripcion.slice(0, 180) + "…" : descripcion}
          </p>
        )}
        {!descripcion && <div style={{ height: 12 }} />}
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
