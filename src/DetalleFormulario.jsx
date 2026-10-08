import { useState, useEffect } from "react";
import {
  listarRespuestas,
  eliminarFormulario,
  etiquetaCadencia,
  etiquetaTipoPregunta,
  necesitaOpciones,
} from "./formularios.js";

export default function DetalleFormulario({ formulario, usuario, onEditar, onEliminar, onVolver }) {
  const [respuestas, setRespuestas] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [filtroReunion, setFiltroReunion] = useState("");

  useEffect(() => {
    const cancelar = listarRespuestas(formulario.id, setRespuestas);
    return () => cancelar();
  }, [formulario.id]);

  async function eliminar() {
    await eliminarFormulario(formulario.id);
    onEliminar();
  }

  const puedeEditar = usuario?.rol === "master" || usuario?.rol === "admin";
  const asignaciones = formulario.asignaciones || [];
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
            {!confirmando ? (
              <button className="ca-btn" style={{ background: "var(--rojo)", width: "auto", padding: "8px 16px" }} onClick={() => setConfirmando(true)}>
                Eliminar
              </button>
            ) : (
              <>
                <button className="ca-btn" style={{ background: "var(--rojo)", width: "auto", padding: "8px 14px" }} onClick={eliminar}>
                  Confirmar
                </button>
                <button className="ca-btn ca-btn-secundario" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setConfirmando(false)}>
                  No
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(a.personas || []).map((p) => (
                    <span key={p.uid} className="ca-chip" style={{ fontSize: 11 }}>{p.nombre}</span>
                  ))}
                </div>
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
              </p>
              <p style={{ ...gris, fontSize: 12, margin: 0 }}>
                {etiquetaTipoPregunta(p.tipo)}
                {necesitaOpciones(p.tipo) && p.opciones?.length > 0 && ` · ${p.opciones.join(" / ")}`}
              </p>
            </div>
          </div>
        ))}
      </div>

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
          visibles.map((r) => (
            <div key={r.id} style={fila}>
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <strong style={{ fontSize: 14 }}>{r.nombreUsuario}</strong>
                  <span style={{ ...gris, fontSize: 12 }}>
                    {r.area && `${r.area} · `}{fecha(r.fecha)}
                  </span>
                </div>
                {r.reunionNombre && (
                  <span className="ca-chip" style={{ fontSize: 11, marginBottom: 6 }}>{r.reunionNombre}</span>
                )}
                {(formulario.preguntas || []).map((p) => {
                  const v = r.respuestas?.[p.id];
                  if (v === undefined || v === null || v === "") return null;
                  return (
                    <div key={p.id} style={{ fontSize: 13, marginTop: 5 }}>
                      <span style={gris}>{p.texto}: </span>
                      {p.tipo === "imagen" ? (
                        <a href={v} target="_blank" rel="noreferrer">
                          <img src={v} alt="Adjunto" style={{ display: "block", maxWidth: 220, borderRadius: 8, marginTop: 4 }} />
                        </a>
                      ) : (
                        <span>{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
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
