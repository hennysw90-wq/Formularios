import { useState, useEffect } from "react";
import ResumenTextos from "./ResumenTextos.jsx";
import {
  listarRespuestas,
  eliminarFormulario,
  eliminarRespuesta,
  etiquetaCadencia,
  etiquetaTipoPregunta,
  necesitaOpciones,
  configDestinatario,
  textoRespuesta,
} from "./formularios.js";

export default function DetalleFormulario({ formulario, usuario, onEditar, onEliminar, onVolver }) {
  const [respuestas, setRespuestas] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [clave, setClave] = useState("");
  const [errorClave, setErrorClave] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [filtroReunion, setFiltroReunion] = useState("");
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    const cancelar = listarRespuestas(formulario.id, setRespuestas);
    return () => cancelar();
  }, [formulario.id]);

  // Eliminar un formulario borra también todas sus respuestas y no se puede
  // deshacer, así que además de confirmar se pide la contraseña de quien lo
  // está haciendo.
  async function eliminar(ev) {
    ev.preventDefault();
    if (!clave) return setErrorClave("Escribe tu contraseña.");
    if (clave !== usuario?.password) return setErrorClave("Contraseña incorrecta.");
    setErrorClave("");
    setBorrando(true);
    try {
      await eliminarFormulario(formulario.id);
      onEliminar();
    } catch {
      setBorrando(false);
      setErrorClave("No se pudo eliminar. Intenta de nuevo.");
    }
  }

  function cancelarBorrado() {
    setConfirmando(false);
    setClave("");
    setErrorClave("");
  }

  // Solo Master crea, edita, elimina formularios y borra respuestas.
  const puedeEditar = usuario?.rol === "master";
  const asignaciones = formulario.asignaciones || [];
  const cfgDest = configDestinatario(formulario);
  const reunionesUnicas = [...new Set(respuestas.map((r) => r.reunionNombre).filter(Boolean))];
  const visibles = filtroReunion
    ? respuestas.filter((r) => r.reunionNombre === filtroReunion)
    : respuestas;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 28px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 10 }}>
        <button className="ca-btn-texto" onClick={onVolver}>← Volver</button>
        {puedeEditar && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ca-btn ca-btn-secundario" style={{ width: "auto", padding: "8px 16px" }} onClick={onEditar}>
              Editar
            </button>
            <button className="ca-btn" style={{ background: "var(--rojo)", width: "auto", padding: "8px 16px" }} onClick={() => setConfirmando(true)}>
              Eliminar
            </button>
          </div>
        )}
      </div>

      {confirmando && (
        <form onSubmit={eliminar} style={panelBorrado}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: "#b02a26" }}>
            Eliminar «{formulario.titulo}»
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--texto-suave)" }}>
            Se borrarán también todas sus respuestas. Esto no se puede deshacer.
            Escribe tu contraseña para confirmar.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <input
              className="ca-input"
              type="password"
              autoFocus
              style={{ flex: 1, minWidth: 180 }}
              value={clave}
              onChange={(e) => { setClave(e.target.value); setErrorClave(""); }}
              placeholder={`Contraseña de ${usuario?.nombreUsuario || "tu usuario"}`}
            />
            <button
              className="ca-btn"
              disabled={borrando}
              style={{ background: "var(--rojo)", width: "auto", padding: "12px 18px" }}
            >
              {borrando ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
            <button
              type="button"
              className="ca-btn ca-btn-secundario"
              style={{ width: "auto", padding: "12px 18px" }}
              onClick={cancelarBorrado}
            >
              Cancelar
            </button>
          </div>
          {errorClave && (
            <p style={{ color: "var(--rojo)", fontSize: 13, margin: "10px 0 0" }}>{errorClave}</p>
          )}
        </form>
      )}

      <h2 style={{ margin: "6px 0 4px", fontSize: 22 }}>{formulario.titulo}</h2>
      {formulario.descripcion && (
        <p style={{ color: "var(--texto-suave)", margin: "0 0 14px", fontSize: 14 }}>{formulario.descripcion}</p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <span className="ca-chip">{(formulario.preguntas || []).length} preguntas</span>
        <span className="ca-chip">{asignaciones.length} asignacion{asignaciones.length === 1 ? "" : "es"}</span>
        <span className="ca-chip ca-chip-ambar">{respuestas.length} respuesta{respuestas.length === 1 ? "" : "s"}</span>
      </div>

      {/* ── Asignaciones ── */}
      <div className="ca-card" style={{ marginBottom: 16 }}>
        <h3 style={sub}>Asignaciones</h3>
        {asignaciones.length === 0 ? (
          <p style={gris}>
            Sin asignaciones: cualquiera que lea el QR puede responder.
          </p>
        ) : (
          asignaciones.map((a) => (
            <div key={a.id} style={fila}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 14 }}>
                  {a.reunionNombre || "Sin reunión"}
                </p>
                <p style={{ ...gris, fontSize: 12, margin: "0 0 5px" }}>
                  {etiquetaCadencia(a.cantidad, a.frecuencia)}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                  {(a.personas || []).map((p) => (
                    <span key={p.uid} className="ca-chip" style={{ fontSize: 11 }}>
                      {p.nombre}
                      {p.desde && ` · desde ${fechaCorta(p.desde)}`}
                    </span>
                  ))}
                </div>
                {(a.destinatarios || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                    <span style={{ ...gris, fontSize: 11 }}>Dirigida a:</span>
                    {a.destinatarios.map((d) => (
                      <span key={d.uid} className="ca-chip ca-chip-ambar" style={{ fontSize: 11 }}>
                        {d.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Preguntas ── */}
      <div className="ca-card" style={{ marginBottom: 16 }}>
        <h3 style={sub}>Preguntas</h3>
        {(formulario.preguntas || []).map((p, i) => (
          <div key={p.id} style={fila}>
            <div>
              <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 14 }}>
                {i + 1}. {p.texto}
                {p.obligatoria && <span style={{ color: "var(--rojo)", marginLeft: 4 }}>*</span>}
                {p.dimension && (
                  <span className="ca-chip" style={{ fontSize: 10, marginLeft: 6 }}>{p.dimension}</span>
                )}
              </p>
              <p style={{ ...gris, fontSize: 12, margin: 0 }}>
                {etiquetaTipoPregunta(p.tipo)}
                {necesitaOpciones(p.tipo) && p.opciones?.length > 0 && ` · ${p.opciones.join(" / ")}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Resumen de textos ── */}
      <ResumenTextos formulario={formulario} respuestas={respuestas} />

      {/* ── Respuestas ── */}
      <div className="ca-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <h3 style={{ ...sub, marginBottom: 0 }}>Respuestas recibidas</h3>
          {reunionesUnicas.length > 1 && (
            <select
              className="ca-input"
              style={{ width: "auto", minWidth: 180 }}
              value={filtroReunion}
              onChange={(e) => setFiltroReunion(e.target.value)}
            >
              <option value="">Todas las reuniones</option>
              {reunionesUnicas.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          )}
        </div>

        {visibles.length === 0 ? (
          <p style={gris}>Aún no hay respuestas. Comparte el QR para empezar.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--borde)" }}>
                  <th style={thL}>QUIÉN LO HIZO</th>
                  <th style={thL}>A QUIÉN</th>
                  <th style={thL}>REUNIÓN</th>
                  <th style={thL}>FECHA Y HORA</th>
                  <th style={{ ...thL, width: 110, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <FilaRespuesta
                    key={r.id}
                    respuesta={r}
                    formulario={formulario}
                    etiquetaDest={cfgDest.etiqueta}
                    puedeBorrar={puedeEditar}
                    abierta={abierta === r.id}
                    onAbrir={() => setAbierta(abierta === r.id ? null : r.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Una respuesta por fila: quién la hizo, a quién, la reunión y cuándo. El
// contenido completo solo se despliega si se pide, para que el listado se
// pueda leer de un vistazo.
function FilaRespuesta({ respuesta: r, formulario, etiquetaDest, puedeBorrar, abierta, onAbrir }) {
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    setBorrando(true);
    try {
      await eliminarRespuesta(formulario.id, r.id);
    } catch {
      setBorrando(false);
      setConfirmando(false);
    }
  }

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--borde)" }}>
        <td style={tdL}>
          <strong>{r.nombreUsuario}</strong>
          {r.area && <div style={{ ...gris, fontSize: 11 }}>{r.area}</div>}
        </td>
        <td style={tdL}>{r.destinatario?.nombre || "—"}</td>
        <td style={tdL}>{r.reunionNombre || "—"}</td>
        <td style={{ ...tdL, whiteSpace: "nowrap" }}>{fecha(r.fecha)}</td>
        <td style={{ ...tdL, textAlign: "right", whiteSpace: "nowrap" }}>
          <button onClick={onAbrir} style={btnFila} title="Ver respuestas">
            {abierta ? "Ocultar" : "Ver"}
          </button>
          {puedeBorrar && (
            confirmando ? (
              <>
                <button
                  onClick={borrar}
                  disabled={borrando}
                  style={{ ...btnFila, color: "#fff", background: "var(--rojo)", borderColor: "var(--rojo)" }}
                >
                  {borrando ? "…" : "Borrar"}
                </button>
                <button onClick={() => setConfirmando(false)} style={btnFila}>No</button>
              </>
            ) : (
              <button
                onClick={() => setConfirmando(true)}
                style={{ ...btnFila, color: "var(--rojo)" }}
                title="Eliminar esta respuesta"
              >
                ✕
              </button>
            )
          )}
        </td>
      </tr>

      {abierta && (
        <tr>
          <td colSpan={5} style={{ padding: "4px 8px 14px", background: "var(--fondo)" }}>
            {(formulario.preguntas || []).map((p) => {
              const v = r.respuestas?.[p.id];
              if (v === undefined || v === null || v === "") return null;
              return (
                <div key={p.id} style={{ fontSize: 13, marginTop: 6 }}>
                  <span style={gris}>{p.texto}: </span>
                  {p.tipo === "imagen" ? (
                    <a href={v} target="_blank" rel="noreferrer">
                      <img src={v} alt="Adjunto" style={{ display: "block", maxWidth: 220, borderRadius: 8, marginTop: 4 }} />
                    </a>
                  ) : (
                    <strong>{textoRespuesta(v)}</strong>
                  )}
                </div>
              );
            })}
          </td>
        </tr>
      )}
    </>
  );
}

function fechaCorta(iso) {
  const [a, m, d] = (iso || "").split("-");
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

function fecha(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const sub = { margin: "0 0 12px", fontSize: 15, fontWeight: 700 };
const gris = { color: "var(--texto-suave)", fontSize: 13, margin: 0 };
const fila = { display: "flex", gap: 10, borderBottom: "1px solid var(--borde)", paddingBottom: 11, marginBottom: 11 };

const thL = { textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--texto-suave)", padding: "8px 8px", textTransform: "uppercase", letterSpacing: 0.4 };
const tdL = { padding: "9px 8px", verticalAlign: "top" };
const btnFila = {
  background: "#fff",
  border: "1px solid var(--borde)",
  borderRadius: 7,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  marginLeft: 5,
  color: "var(--texto)",
  fontFamily: "inherit",
};

const panelBorrado = {
  border: "2px solid var(--rojo)",
  background: "#fdf3f3",
  borderRadius: 12,
  padding: "14px 16px",
  marginBottom: 14,
};
