import { useState, useEffect } from "react";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import { listarUsuarios } from "./auth.js";
import { sugerirUsuarios } from "./buscarUsuarios.js";
import ResumenTextos from "./ResumenTextos.jsx";
import {
  obtenerFormulario,
  guardarRespuesta,
  respuestasDePersona,
  agendaDePersona,
  etiquetaCadencia,
  necesitaOpciones,
  configDestinatario,
  esPreguntaUsuario,
  preguntaDestinatario,
  textoRespuesta,
  destinatariosPermitidos,
  hayRestriccionDeDestinatarios,
  CUMPLE,
  NO_CUMPLE,
  resumenPorDimension,
  haceMeses,
  recibidasEnFormulario,
} from "./formularios.js";

const VERSION = "v1.21.0";

export default function RegistroFormulario({ formularioId }) {
  const [formulario, setFormulario] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  // paso: identificar -> agenda -> responder -> enviado
  const [paso, setPaso] = useState("identificar");
  const [persona, setPersona] = useState(null);
  const [agenda, setAgenda] = useState([]);
  const [itemActivo, setItemActivo] = useState(null);

  useEffect(() => {
    obtenerFormulario(formularioId)
      .then((f) => {
        if (!f || !f.activo) setErrorCarga("Formulario no encontrado o inactivo.");
        else setFormulario(f);
      })
      .catch(() => setErrorCarga("No se pudo cargar el formulario."))
      .finally(() => setCargando(false));
    const cancelar = listarUsuarios(setUsuarios);
    return () => cancelar();
  }, [formularioId]);

  async function refrescarAgenda(p) {
    const previas = await respuestasDePersona(formularioId, p.uid);
    setAgenda(agendaDePersona(formulario, p.uid, previas, p));
  }

  async function identificarse(p) {
    setPersona(p);
    await refrescarAgenda(p);
    setPaso("agenda");
  }

  async function alEnviar() {
    await refrescarAgenda(persona);
    setItemActivo(null);
    setPaso("enviado");
  }

  if (cargando) return <Envoltorio><p style={gris}>Cargando…</p></Envoltorio>;
  if (errorCarga) return <Envoltorio><p style={{ color: "var(--rojo)", textAlign: "center" }}>{errorCarga}</p></Envoltorio>;

  if (paso === "identificar") {
    return (
      <Envoltorio titulo={formulario.titulo} descripcion={formulario.descripcion}>
        <Identificarse usuarios={usuarios} onElegir={identificarse} />
      </Envoltorio>
    );
  }

  if (paso === "responder" && itemActivo) {
    return (
      <Envoltorio titulo={formulario.titulo}>
        <Cuestionario
          formulario={formulario}
          item={itemActivo}
          persona={persona}
          usuarios={usuarios}
          onCancelar={() => { setItemActivo(null); setPaso("agenda"); }}
          onEnviado={alEnviar}
        />
      </Envoltorio>
    );
  }

  if (paso === "enviado") {
    return (
      <Envoltorio titulo={formulario.titulo}>
        <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
          <div style={{ fontSize: 44 }}>✅</div>
          <p style={{ fontWeight: 800, margin: "8px 0 4px" }}>Respuesta enviada</p>
          <p style={{ color: "var(--texto-suave)", fontSize: 14, margin: 0 }}>
            Gracias, {persona.nombreUsuario}.
          </p>
          <button
            className="ca-btn ca-btn-secundario"
            style={{ marginTop: 16 }}
            onClick={() => setPaso("agenda")}
          >
            Volver a mis pendientes
          </button>
        </div>
      </Envoltorio>
    );
  }

  // paso === "agenda" | "resumen"
  return (
    <Envoltorio titulo={formulario.titulo} descripcion={formulario.descripcion}>
      <Encabezado persona={persona} onCambiar={() => { setPersona(null); setPaso("identificar"); }} />

      <div style={pestanas}>
        <button type="button" onClick={() => setPaso("agenda")} style={pestana(paso === "agenda")}>
          Pendientes
        </button>
        <button type="button" onClick={() => setPaso("resumen")} style={pestana(paso === "resumen")}>
          Mi cumplimiento
        </button>
        <button type="button" onClick={() => setPaso("entregadas")} style={pestana(paso === "entregadas")}>
          Lo que entregué
        </button>
      </div>

      {paso === "resumen" ? (
        <Resumen persona={persona} formulario={formulario} />
      ) : paso === "entregadas" ? (
        <Entregadas persona={persona} formulario={formulario} />
      ) : (
        <Agenda
          agenda={agenda}
          hayAsignaciones={(formulario.asignaciones || []).length > 0}
          onElegir={(item) => { setItemActivo(item); setPaso("responder"); }}
        />
      )}
    </Envoltorio>
  );
}

// ─── Identificación ───────────────────────────────────────────────────────

function Identificarse({ usuarios, onElegir }) {
  const [texto, setTexto] = useState("");
  const escrito = texto.trim();
  const filtrados = sugerirUsuarios(escrito, usuarios);

  return (
    <>
      <p style={{ fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>¿Quién eres?</p>
      <p style={{ ...gris, fontSize: 13, margin: "0 0 12px" }}>
        Escribe tu nombre y elígete de las sugerencias.
      </p>
      <input
        className="ca-input"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Tu nombre"
        autoFocus
      />
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
          <p style={{ ...gris, fontSize: 13, margin: 0 }}>
            No encontramos ese nombre. Revisa cómo está escrito o pide a un administrador que te cree el usuario.
          </p>
        )}
        {escrito.length < 2 && (
          <p style={{ ...gris, fontSize: 12, margin: 0 }}>
            Escribe al menos 2 letras para ver sugerencias.
          </p>
        )}
      </div>
    </>
  );
}

// ─── Agenda de la persona ─────────────────────────────────────────────────

function Agenda({ agenda, hayAsignaciones, onElegir }) {
  // Formulario sin asignaciones: queda abierto, se responde directo.
  if (!hayAsignaciones) {
    return (
      <button
        className="ca-btn"
        onClick={() => onElegir({ asignacion: null, periodo: "", reunionNombre: "" })}
      >
        Responder formulario
      </button>
    );
  }

  if (agenda.length === 0) {
    return (
      <p style={{ ...gris, fontSize: 14, textAlign: "center", padding: "14px 0" }}>
        No tienes este formulario asignado. Si crees que es un error, avísale a quien lo creó.
      </p>
    );
  }

  return (
    <>
      {agenda.map((item) => (
        <div key={item.asignacion.id} style={tarjeta(item.completa)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>
                {item.asignacion.reunionNombre || "Sin reunión"}
              </p>
              <p style={{ ...gris, fontSize: 12, margin: 0 }}>
                {etiquetaCadencia(item.asignacion.cantidad, item.asignacion.frecuencia)}
                {" · "}
                {item.hechas} de {item.total} en este periodo
              </p>
            </div>
            {item.completa ? (
              <span style={chipOk}>✓ Al día</span>
            ) : (
              <span style={chipPendiente}>{item.pendientes} pendiente{item.pendientes === 1 ? "" : "s"}</span>
            )}
          </div>
          <button
            className={item.completa ? "ca-btn ca-btn-secundario" : "ca-btn"}
            style={{ marginTop: 10 }}
            onClick={() => onElegir(item)}
          >
            {item.completa ? "Responder otra vez" : "Ejecutar formulario"}
          </button>
        </div>
      ))}
    </>
  );
}

// ─── Lo que entregué ──────────────────────────────────────────────────────
// Los formularios que esta persona completó, para poder releerlos enteros.

function Entregadas({ persona, formulario }) {
  const [entregas, setEntregas] = useState(null);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    let vivo = true;
    respuestasDePersona(formulario.id, persona.uid)
      .then((r) => vivo && setEntregas(r.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))))
      .catch(() => vivo && setError("No se pudo cargar lo que entregaste."));
    return () => { vivo = false; };
  }, [persona.uid, formulario.id]);

  if (error) return <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>;
  if (entregas === null) return <p style={{ ...gris, fontSize: 14 }}>Cargando…</p>;

  if (entregas.length === 0) {
    return (
      <p style={{ ...gris, fontSize: 14, textAlign: "center", padding: "14px 0" }}>
        Todavía no has entregado este formulario.
      </p>
    );
  }

  const cfg = configDestinatario(formulario);

  return (
    <>
      <p style={{ ...gris, fontSize: 12, margin: "0 0 10px" }}>
        {entregas.length} entrega{entregas.length === 1 ? "" : "s"}. Toca una para revisarla completa.
      </p>

      {entregas.map((e) => {
        const abiertaEsta = abierta === e.id;
        return (
          <div key={e.id} style={tarjetaDim}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
              onClick={() => setAbierta(abiertaEsta ? null : e.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 13 }}>
                  {fechaHora(e.fecha)}
                </p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {e.reunionNombre && (
                    <span className="ca-chip" style={{ fontSize: 10 }}>{e.reunionNombre}</span>
                  )}
                  {e.destinatario?.nombre && (
                    <span className="ca-chip ca-chip-ambar" style={{ fontSize: 10 }}>
                      {cfg.etiqueta}: {e.destinatario.nombre}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ ...gris, fontSize: 17 }}>{abiertaEsta ? "▴" : "▾"}</span>
            </div>

            {abiertaEsta && (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--borde)", paddingTop: 10 }}>
                {(formulario.preguntas || []).map((p) => {
                  const v = e.respuestas?.[p.id];
                  if (v === undefined || v === null || v === "") return null;
                  return (
                    <div key={p.id} style={{ marginBottom: 10 }}>
                      {p.dimension && (
                        <span className="ca-chip" style={{ fontSize: 9, marginBottom: 3 }}>{p.dimension}</span>
                      )}
                      <p style={{ ...gris, fontSize: 12, margin: "0 0 2px" }}>{p.texto}</p>
                      {p.tipo === "imagen" ? (
                        <a href={v} target="_blank" rel="noreferrer">
                          <img src={v} alt="Adjunto" style={{ width: "100%", borderRadius: 8, marginTop: 3 }} />
                        </a>
                      ) : (
                        <strong style={{ fontSize: 13, color: colorValor(v) }}>
                          {textoRespuesta(v)}
                        </strong>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function colorValor(v) {
  if (v === CUMPLE) return "#1b7a46";
  if (v === NO_CUMPLE) return "#b02a26";
  return "var(--texto)";
}

function fechaHora(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// ─── Mi cumplimiento (dimensiones + textos) ───────────────────────────────

function Resumen({ persona, formulario }) {
  const [respuestas, setRespuestas] = useState(null);
  const [meses, setMeses] = useState(2);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState(null);

  // El cumplimiento es el de las evaluaciones que le HICIERON a esta
  // persona en este formulario, no el de las que ella entregó.
  useEffect(() => {
    let vivo = true;
    recibidasEnFormulario(formulario.id, persona.uid)
      .then((r) => vivo && setRespuestas(r.map((x) => ({ ...x, formulario }))))
      .catch(() => vivo && setError("No se pudo cargar tu cumplimiento."));
    return () => { vivo = false; };
  }, [persona.uid, formulario.id]);

  if (error) return <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>;
  if (respuestas === null) return <p style={{ ...gris, fontSize: 14 }}>Cargando…</p>;

  const corte = haceMeses(meses);
  const enRango = respuestas.filter((r) => new Date(r.fecha) >= corte);
  const resumen = resumenPorDimension(respuestas, corte);

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[2, 6, 12].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setMeses(n)}
            style={{ ...chipSel(meses === n), flex: 1, justifyContent: "center", fontSize: 13, padding: "7px 0" }}
          >
            {n} meses
          </button>
        ))}
      </div>

      {resumen.porcentajeGeneral === null ? (
        <p style={{ ...gris, fontSize: 14, textAlign: "center", padding: "14px 0" }}>
          Nadie te ha evaluado con este formulario en el periodo elegido.
        </p>
      ) : (
        <>
          <div style={cajaTotal}>
            <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>Cumplimiento general</span>
            <div style={{ fontSize: 34, fontWeight: 800, color: tono(resumen.porcentajeGeneral), lineHeight: 1.1 }}>
              {resumen.porcentajeGeneral}%
            </div>
            <span style={{ fontSize: 12, color: "var(--texto-suave)" }}>
              {resumen.totalCumple} de {resumen.totalPreguntas} preguntas cumplen ·{" "}
              {respuestas.length} evaluación{respuestas.length === 1 ? "" : "es"} recibida{respuestas.length === 1 ? "" : "s"}
            </span>
          </div>

          {resumen.dimensiones.map((d) => {
            const abiertaEsta = abierta === d.dimension;
            return (
              <div key={d.dimension} style={tarjetaDim}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  onClick={() => setAbierta(abiertaEsta ? null : d.dimension)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: 14 }}>{d.dimension}</p>
                    <div style={{ background: "var(--borde)", borderRadius: 100, height: 7, overflow: "hidden" }}>
                      <div style={{ width: `${d.porcentaje}%`, height: "100%", background: tono(d.porcentaje), borderRadius: 100 }} />
                    </div>
                    <p style={{ ...gris, fontSize: 11, margin: "5px 0 0" }}>
                      {d.cumple} de {d.total} cumplen
                    </p>
                  </div>
                  <strong style={{ fontSize: 19, color: tono(d.porcentaje), minWidth: 52, textAlign: "right" }}>
                    {d.porcentaje}%
                  </strong>
                </div>

                {abiertaEsta && (
                  <div style={{ marginTop: 10, borderTop: "1px solid var(--borde)", paddingTop: 10 }}>
                    {d.preguntas.map((q, i) => {
                      const pct = q.total > 0 ? Math.round((q.cumple / q.total) * 100) : 0;
                      return (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 7 }}>
                          <span style={{ flex: 1, fontSize: 12 }}>{q.texto}</span>
                          <strong style={{ fontSize: 12, color: tono(pct), whiteSpace: "nowrap" }}>
                            {q.cumple}/{q.total} · {pct}%
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {enRango.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <ResumenTextos formulario={formulario} respuestas={enRango} embebido />
        </div>
      )}

    </>
  );
}

function tono(p) {
  if (p >= 90) return "#1b7a46";
  if (p >= 70) return "#8a5a00";
  return "#b02a26";
}

function fechaCorta(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function Encabezado({ persona, onCambiar }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{persona.nombreUsuario}</p>
        {persona.area && <p style={{ ...gris, fontSize: 12, margin: 0 }}>{persona.area}</p>}
      </div>
      <button className="ca-btn-texto" style={{ fontSize: 12, width: "auto" }} onClick={onCambiar}>
        No soy yo
      </button>
    </div>
  );
}

// ─── Cuestionario ─────────────────────────────────────────────────────────

function Cuestionario({ formulario, item, persona, usuarios, onCancelar, onEnviado }) {
  const [respuestas, setRespuestas] = useState({});
  const [destinatario, setDestinatario] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cfgDest = configDestinatario(formulario);
  // Si el formulario restringe a quién se le puede dirigir, la pregunta de
  // destinatario ofrece solo esa lista.
  const permitidos = hayRestriccionDeDestinatarios(formulario)
    ? destinatariosPermitidos(formulario, persona.uid)
    : null;

  function set(pid, valor) {
    setRespuestas((r) => ({ ...r, [pid]: valor }));
  }
  function toggle(pid, opcion) {
    setRespuestas((r) => {
      const actual = r[pid] || [];
      return {
        ...r,
        [pid]: actual.includes(opcion) ? actual.filter((o) => o !== opcion) : [...actual, opcion],
      };
    });
  }

  function vacia(v) {
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  }

  // A quién va dirigida la evaluación: la respuesta de la primera pregunta
  // de tipo usuario. Se guarda también en la raíz para poder buscar después
  // "lo que recibí" sin tener que recorrer las preguntas.
  function destinatarioElegido() {
    const pregunta = preguntaDestinatario(formulario);
    if (pregunta) return respuestas[pregunta.id] || null;
    // Formularios antiguos, todavía con el destinatario como configuración.
    return destinatario
      ? { uid: destinatario.uid, nombre: destinatario.nombre || destinatario.nombreUsuario, area: destinatario.area || "" }
      : null;
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!preguntaDestinatario(formulario) && cfgDest.activo && cfgDest.obligatorio && !destinatario) {
      return setError(`Falta elegir ${cfgDest.etiqueta.toLowerCase()}.`);
    }
    for (const p of formulario.preguntas || []) {
      if (p.obligatoria && vacia(respuestas[p.id])) {
        return setError(`Falta responder: "${p.texto}"`);
      }
    }
    setError("");
    setEnviando(true);
    try {
      await guardarRespuesta({
        formularioId: formulario.id,
        asignacionId: item.asignacion?.id || "",
        reunionId: item.asignacion?.reunionId || "",
        reunionNombre: item.asignacion?.reunionNombre || "",
        periodo: item.periodo || "",
        personaUid: persona.uid,
        nombreUsuario: persona.nombreUsuario,
        area: persona.area || "",
        destinatario: destinatarioElegido(),
        respuestas,
      });
      onEnviado();
    } catch (e) {
      setError("No se pudo enviar. Revisa tu conexión e intenta otra vez.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {item.asignacion && (
        <div style={{ background: "var(--verde-claro)", borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--verde-oscuro)", fontWeight: 700 }}>
            {item.asignacion.reunionNombre}
          </p>
        </div>
      )}

      {!preguntaDestinatario(formulario) && cfgDest.activo && (
        <div style={{ marginBottom: 18 }}>
          <label className="ca-label" style={{ fontSize: 14, marginBottom: 7 }}>
            {cfgDest.etiqueta} {cfgDest.obligatorio && <span style={{ color: "var(--rojo)" }}>*</span>}
          </label>
          <SelectorDestinatario
            usuarios={usuarios}
            excluirUid={persona.uid}
            elegido={destinatario}
            onElegir={setDestinatario}
          />
        </div>
      )}

      {(formulario.preguntas || []).map((p, i) => (
        <div key={p.id} style={{ marginBottom: 18 }}>
          {p.dimension && (
            <span className="ca-chip" style={{ fontSize: 10, marginBottom: 5 }}>{p.dimension}</span>
          )}
          <label className="ca-label" style={{ fontSize: 14, marginBottom: 7 }}>
            {i + 1}. {p.texto} {p.obligatoria && <span style={{ color: "var(--rojo)" }}>*</span>}
          </label>
          <Campo
            pregunta={p}
            valor={respuestas[p.id]}
            onChange={(v) => set(p.id, v)}
            onToggle={(o) => toggle(p.id, o)}
            usuarios={usuarios}
            excluirUid={persona.uid}
            permitidos={permitidos}
          />
        </div>
      ))}

      {error && <p style={errBox}>{error}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="ca-btn ca-btn-secundario" onClick={onCancelar} style={{ flex: 1 }}>
          Volver
        </button>
        <button className="ca-btn" disabled={enviando} style={{ flex: 2 }}>
          {enviando ? "Enviando…" : "Enviar respuesta"}
        </button>
      </div>
    </form>
  );
}

// Elige a quién va dirigido el formulario. Se excluye a la propia persona
// que lo está ejecutando: el destinatario siempre es alguien más.
function SelectorDestinatario({ usuarios, excluirUid, permitidos, elegido, onElegir }) {
  // Guarda solo lo necesario para mostrar y para buscar después.
  const elegirPersona = (u) =>
    onElegir(u ? { uid: u.uid, nombre: u.nombreUsuario || u.nombre, area: u.area || "" } : null);
  const [busqueda, setBusqueda] = useState("");

  const sinTildes = (t) =>
    (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  if (elegido) {
    return (
      <div style={elegidoCaja}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
            {elegido.nombre || elegido.nombreUsuario}
          </p>
          {elegido.area && <p style={{ ...gris, fontSize: 12, margin: 0 }}>{elegido.area}</p>}
        </div>
        <button type="button" className="ca-btn-texto" style={{ fontSize: 12, width: "auto" }} onClick={() => elegirPersona(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  // Lista cerrada: se muestran directamente las personas habilitadas.
  if (permitidos) {
    if (permitidos.length === 0) {
      return (
        <p style={{ ...gris, fontSize: 13, margin: 0 }}>
          Este formulario no tiene destinatarios habilitados, aparte de ti.
        </p>
      );
    }
    return (
      <div>
        {permitidos.map((p) => (
          <button key={p.uid} type="button" onClick={() => elegirPersona(p)} style={filaPersona}>
            <strong style={{ fontSize: 14 }}>{p.nombre}</strong>
            {p.area && <span style={{ ...gris, fontSize: 12 }}>{p.area}</span>}
          </button>
        ))}
      </div>
    );
  }

  const escrito = busqueda.trim();
  const candidatos = sugerirUsuarios(escrito, usuarios, { excluirUid });

  return (
    <>
      <input
        className="ca-input"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o área…"
      />
      <div style={{ marginTop: 8 }}>
        {candidatos.map((u) => (
          <button key={u.uid} type="button" onClick={() => elegirPersona(u)} style={filaPersona}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{u.nombreUsuario}</strong>
              {u.parecido && <span style={etiquetaParecido}>parecido</span>}
            </span>
            {u.area && <span style={{ ...gris, fontSize: 12 }}>{u.area}</span>}
          </button>
        ))}
        {escrito.length >= 2 && candidatos.length === 0 && (
          <p style={{ ...gris, fontSize: 13, margin: 0 }}>Nadie coincide con esa búsqueda.</p>
        )}
        {escrito.length < 2 && (
          <p style={{ ...gris, fontSize: 12, margin: 0 }}>
            Escribe al menos 2 letras. Tú mismo no apareces.
          </p>
        )}
      </div>
    </>
  );
}

// ─── Campos según el tipo de pregunta ─────────────────────────────────────

function Campo({ pregunta, valor, onChange, onToggle, usuarios, excluirUid, permitidos }) {
  const t = pregunta.tipo;

  if (t === "cumple") {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        {[CUMPLE, NO_CUMPLE].map((op) => {
          const sel = valor === op;
          const bueno = op === CUMPLE;
          return (
            <button
              key={op}
              type="button"
              onClick={() => onChange(op)}
              style={{
                flex: 1,
                padding: "12px 10px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: sel ? 800 : 600,
                cursor: "pointer",
                border: `2px solid ${sel ? (bueno ? "#1b7a46" : "#b02a26") : "var(--borde)"}`,
                background: sel ? (bueno ? "#e3f3ea" : "#fdeaea") : "#fff",
                color: sel ? (bueno ? "#1b7a46" : "#b02a26") : "var(--texto-suave)",
              }}
            >
              {sel ? (bueno ? "✓ " : "✕ ") : ""}{op}
            </button>
          );
        })}
      </div>
    );
  }

  if (t === "si_no") {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        {["Sí", "No"].map((op) => (
          <button
            key={op}
            type="button"
            className={valor === op ? "ca-btn" : "ca-btn ca-btn-secundario"}
            style={{ flex: 1 }}
            onClick={() => onChange(op)}
          >
            {op}
          </button>
        ))}
      </div>
    );
  }

  if (t === "seleccion") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(pregunta.opciones || []).map((op) => (
          <button
            key={op}
            type="button"
            className={valor === op ? "ca-btn" : "ca-btn ca-btn-secundario"}
            onClick={() => onChange(op)}
          >
            {op}
          </button>
        ))}
      </div>
    );
  }

  if (t === "multiple") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(pregunta.opciones || []).map((op) => {
          const sel = (valor || []).includes(op);
          return (
            <button key={op} type="button" onClick={() => onToggle(op)} style={chipSel(sel)}>
              {sel ? "✓ " : ""}{op}
            </button>
          );
        })}
      </div>
    );
  }

  if (t === "escala") {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            style={{ ...chipSel(valor === String(n)), flex: 1, justifyContent: "center", fontSize: 15, padding: "10px 0" }}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (t === "numero") {
    return (
      <input className="ca-input" type="number" value={valor || ""} onChange={(e) => onChange(e.target.value)} placeholder="Ingresa un número" />
    );
  }

  if (t === "fecha") {
    return <input className="ca-input" type="date" value={valor || ""} onChange={(e) => onChange(e.target.value)} />;
  }

  if (t === "hora") {
    return <input className="ca-input" type="time" value={valor || ""} onChange={(e) => onChange(e.target.value)} />;
  }

  if (t === "imagen") {
    return <CampoImagen valor={valor} onChange={onChange} />;
  }

  if (t === "usuario") {
    return (
      <SelectorDestinatario
        usuarios={usuarios}
        excluirUid={excluirUid}
        permitidos={permitidos}
        elegido={valor || null}
        onElegir={onChange}
      />
    );
  }

  if (t === "parrafo") {
    return (
      <textarea className="ca-input" rows={4} style={{ resize: "vertical" }} value={valor || ""} onChange={(e) => onChange(e.target.value)} placeholder="Escribe tu respuesta…" />
    );
  }

  return (
    <input className="ca-input" value={valor || ""} onChange={(e) => onChange(e.target.value)} placeholder="Escribe tu respuesta…" />
  );
}

// Las fotos se comprimen en el navegador antes de guardarlas (máx. 1000 px
// de lado y JPEG de calidad media), porque van dentro del documento de la
// respuesta en Firestore y ese documento tiene un tope de 1 MB.
function CampoImagen({ valor, onChange }) {
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useState("");

  function comprimir(archivo) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = reject;
      lector.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const max = 1000;
          let { width: w, height: h } = img;
          if (w > max || h > max) {
            const escala = Math.min(max / w, max / h);
            w = Math.round(w * escala);
            h = Math.round(h * escala);
          }
          const lienzo = document.createElement("canvas");
          lienzo.width = w;
          lienzo.height = h;
          lienzo.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(lienzo.toDataURL("image/jpeg", 0.65));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  async function elegir(ev) {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    setAviso("");
    setProcesando(true);
    try {
      const comprimida = await comprimir(archivo);
      // ~700 KB en base64 es el tope prudente para no pasarse del
      // documento de Firestore.
      if (comprimida.length > 700000) {
        setAviso("La foto es muy pesada incluso comprimida. Prueba con una toma más simple.");
      } else {
        onChange(comprimida);
      }
    } catch {
      setAviso("No se pudo procesar la imagen.");
    } finally {
      setProcesando(false);
    }
  }

  if (valor) {
    return (
      <div>
        <img src={valor} alt="Foto" style={{ width: "100%", borderRadius: 10, display: "block", marginBottom: 8 }} />
        <button type="button" className="ca-btn ca-btn-secundario" onClick={() => onChange("")}>
          Quitar foto
        </button>
      </div>
    );
  }

  return (
    <div>
      <label style={botonFoto}>
        {procesando ? "Procesando…" : "📷 Tomar o subir foto"}
        <input type="file" accept="image/*" capture="environment" onChange={elegir} style={{ display: "none" }} />
      </label>
      {aviso && <p style={{ color: "var(--rojo)", fontSize: 12, marginTop: 6 }}>{aviso}</p>}
    </div>
  );
}

// ─── Envoltorio ───────────────────────────────────────────────────────────

function Envoltorio({ titulo, descripcion, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16 }}>
      <div className="ca-card" style={{ width: "100%", maxWidth: 420, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <img src={logoLomasBayas} alt="Logo" style={{ height: 42 }} />
        </div>
        {titulo && (
          <p style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>{titulo}</p>
        )}
        {descripcion && (
          <p style={{ textAlign: "center", ...gris, fontSize: 13, margin: "0 0 16px" }}>{descripcion}</p>
        )}
        {!descripcion && <div style={{ height: 12 }} />}
        {children}
        <p style={{ textAlign: "center", fontSize: 10, color: "#b8c4c2", marginTop: 16 }}>{VERSION}</p>
      </div>
    </div>
  );
}

const gris = { color: "var(--texto-suave)" };
const errBox = { color: "var(--rojo)", fontSize: 13, margin: "0 0 12px", background: "#fdf2f2", padding: "8px 12px", borderRadius: 8 };
const filaPersona = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, width: "100%", textAlign: "left", background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, padding: "9px 12px", marginBottom: 6, cursor: "pointer" };
const chipOk = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "var(--verde-claro)", color: "var(--verde-oscuro)", whiteSpace: "nowrap" };
const chipPendiente = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fbe8c8", color: "#8a5a00", whiteSpace: "nowrap" };
const botonFoto = { display: "block", textAlign: "center", border: "1.5px dashed var(--borde)", borderRadius: 10, padding: "16px 12px", color: "var(--verde-oscuro)", fontWeight: 600, cursor: "pointer", background: "#fff" };

function tarjeta(completa) {
  return {
    border: `1px solid ${completa ? "var(--borde)" : "var(--verde)"}`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    background: completa ? "var(--fondo)" : "#fff",
  };
}

function chipSel(sel) {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 14px",
    borderRadius: 100,
    border: `2px solid ${sel ? "var(--verde)" : "var(--borde)"}`,
    background: sel ? "var(--verde-claro)" : "#fff",
    color: sel ? "var(--verde-oscuro)" : "var(--texto-suave)",
    fontWeight: sel ? 700 : 400,
    cursor: "pointer",
    fontSize: 14,
  };
}

const elegidoCaja = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  border: "2px solid var(--verde)",
  background: "var(--verde-claro)",
  borderRadius: 10,
  padding: "9px 12px",
};

const pestanas = {
  display: "flex",
  gap: 6,
  marginBottom: 14,
  borderBottom: "1px solid var(--borde)",
};

function pestana(activa) {
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

const cajaTotal = {
  textAlign: "center",
  background: "var(--fondo)",
  border: "1px solid var(--borde)",
  borderRadius: 12,
  padding: "14px 12px",
  marginBottom: 12,
};

const tarjetaDim = {
  border: "1px solid var(--borde)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
  background: "#fff",
};

const listaUsuarios = {
  marginTop: 8,
  maxHeight: 230,
  overflowY: "auto",
  border: "1px solid var(--borde)",
  borderRadius: 10,
  padding: 6,
  background: "var(--fondo)",
};

const etiquetaParecido = {
  fontSize: 10,
  fontWeight: 700,
  padding: "1px 7px",
  borderRadius: 100,
  background: "#fbe8c8",
  color: "#8a5a00",
};
