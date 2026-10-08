import { useState, useEffect } from "react";
import { listarRespuestas, eliminarFormulario } from "./formularios.js";

export default function DetalleFormulario({ formulario, usuario, onEditar, onEliminar, onVolver }) {
  const [respuestas, setRespuestas] = useState([]);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  useEffect(() => {
    const unsub = listarRespuestas(formulario.id, setRespuestas);
    return () => unsub();
  }, [formulario.id]);

  async function confirmarEliminar() {
    await eliminarFormulario(formulario.id);
    onEliminar();
  }

  const esMasterOAdmin = usuario?.rol === "master" || usuario?.rol === "admin";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "18px 28px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 4px" }}>
        <button className="ca-btn-texto" onClick={onVolver}>← Volver</button>
        {esMasterOAdmin && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="ca-btn ca-btn-secundario" style={{ width: "auto", padding: "8px 16px" }} onClick={onEditar}>
              Editar
            </button>
            {!confirmandoEliminar ? (
              <button
                className="ca-btn"
                style={{ background: "#d9534f", width: "auto", padding: "8px 16px" }}
                onClick={() => setConfirmandoEliminar(true)}
              >
                Eliminar
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ca-btn" style={{ background: "#d9534f", width: "auto", padding: "8px 14px" }} onClick={confirmarEliminar}>
                  Confirmar
                </button>
                <button className="ca-btn ca-btn-secundario" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setConfirmandoEliminar(false)}>
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <h2 style={{ margin: "8px 0 4px", fontSize: 22, color: "#1f2a2e" }}>{formulario.titulo}</h2>
      {formulario.descripcion && (
        <p style={{ color: "#5b6b6e", margin: "0 0 16px", fontSize: 14 }}>{formulario.descripcion}</p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <span className="ca-chip">{etiquetaFrecuencia(formulario)}</span>
        <span className="ca-chip ca-chip-ambar">{respuestas.length} respuesta{respuestas.length !== 1 ? "s" : ""}</span>
        {formulario.responsables?.length > 0 && (
          <span className="ca-chip">{formulario.responsables.length} responsable{formulario.responsables.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Preguntas del formulario */}
      <div className="ca-card" style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
          Preguntas ({(formulario.preguntas || []).length})
        </h3>
        {(formulario.preguntas || []).map((p, idx) => (
          <div key={p.id} style={{ borderBottom: "1px solid #dbe6e5", paddingBottom: 12, marginBottom: 12 }}>
            <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14 }}>
              {idx + 1}. {p.texto}
              {p.obligatoria && <span style={{ color: "#d9534f", marginLeft: 4 }}>*</span>}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#5b6b6e" }}>
              {etiquetaTipoPregunta(p.tipo)}
              {(p.tipo === "seleccion" || p.tipo === "multiple") && p.opciones?.length > 0 && (
                ` · ${p.opciones.join(" / ")}`
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Respuestas recibidas */}
      <div className="ca-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
          Respuestas recibidas
        </h3>
        {respuestas.length === 0 ? (
          <p style={{ color: "#5b6b6e", fontSize: 14, margin: 0 }}>
            Aún no hay respuestas. Comparte el QR para comenzar.
          </p>
        ) : (
          respuestas.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid #dbe6e5", paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
                <strong style={{ fontSize: 14 }}>{r.nombreUsuario}</strong>
                <span style={{ fontSize: 12, color: "#5b6b6e" }}>
                  {r.area && `${r.area} · `}{formatearFecha(r.fecha)}
                </span>
              </div>
              {(formulario.preguntas || []).map((p) => {
                const val = r.respuestas?.[p.id];
                if (!val && val !== 0) return null;
                return (
                  <div key={p.id} style={{ fontSize: 13, marginBottom: 4, color: "#1f2a2e" }}>
                    <span style={{ color: "#5b6b6e" }}>{p.texto}: </span>
                    {Array.isArray(val) ? val.join(", ") : String(val)}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function etiquetaFrecuencia(f) {
  const map = { diaria: "Diaria", semanal: "Semanal", quincenal: "Quincenal", mensual: "Mensual", unica: "Una sola vez" };
  const base = map[f.frecuencia] || f.frecuencia;
  return f.frecuencia === "unica" && f.fechaUnica ? `${base} · ${f.fechaUnica}` : base;
}

function etiquetaTipoPregunta(tipo) {
  const map = { texto: "Texto libre", numero: "Número", si_no: "Sí / No", seleccion: "Selección", multiple: "Múltiple" };
  return map[tipo] || tipo;
}

function formatearFecha(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}
