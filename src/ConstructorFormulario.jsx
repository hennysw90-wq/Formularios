import { useState } from "react";
import { TIPOS_PREGUNTA, FRECUENCIAS, crearFormulario, actualizarFormulario } from "./formularios.js";

let contadorId = 1;
function nuevoId() {
  return `p${Date.now()}_${contadorId++}`;
}

export default function ConstructorFormulario({ formulario, usuarios, onGuardado, onCancelar }) {
  const editando = !!formulario;

  const [titulo, setTitulo] = useState(formulario?.titulo || "");
  const [descripcion, setDescripcion] = useState(formulario?.descripcion || "");
  const [frecuencia, setFrecuencia] = useState(formulario?.frecuencia || "unica");
  const [fechaUnica, setFechaUnica] = useState(formulario?.fechaUnica || "");
  const [responsables, setResponsables] = useState(formulario?.responsables || []);
  const [preguntas, setPreguntas] = useState(
    formulario?.preguntas?.length
      ? formulario.preguntas
      : [{ id: nuevoId(), tipo: "texto", texto: "", obligatoria: true, opciones: [] }]
  );
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  // ─── Preguntas ────────────────────────────────────────────────────────────

  function agregarPregunta() {
    setPreguntas((prev) => [
      ...prev,
      { id: nuevoId(), tipo: "texto", texto: "", obligatoria: false, opciones: [] },
    ]);
  }

  function eliminarPregunta(id) {
    setPreguntas((prev) => prev.filter((p) => p.id !== id));
  }

  function actualizarPregunta(id, campo, valor) {
    setPreguntas((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
    );
  }

  function agregarOpcion(preguntaId) {
    setPreguntas((prev) =>
      prev.map((p) =>
        p.id === preguntaId ? { ...p, opciones: [...(p.opciones || []), ""] } : p
      )
    );
  }

  function actualizarOpcion(preguntaId, idx, valor) {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== preguntaId) return p;
        const ops = [...(p.opciones || [])];
        ops[idx] = valor;
        return { ...p, opciones: ops };
      })
    );
  }

  function eliminarOpcion(preguntaId, idx) {
    setPreguntas((prev) =>
      prev.map((p) => {
        if (p.id !== preguntaId) return p;
        const ops = [...(p.opciones || [])];
        ops.splice(idx, 1);
        return { ...p, opciones: ops };
      })
    );
  }

  function moverPregunta(id, dir) {
    setPreguntas((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const nuevo = [...prev];
      const destino = idx + dir;
      if (destino < 0 || destino >= nuevo.length) return prev;
      [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
      return nuevo;
    });
  }

  // ─── Responsables ─────────────────────────────────────────────────────────

  function toggleResponsable(uid) {
    setResponsables((prev) =>
      prev.includes(uid) ? prev.filter((r) => r !== uid) : [...prev, uid]
    );
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  async function guardar(ev) {
    ev.preventDefault();
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    if (preguntas.length === 0) { setError("Agrega al menos una pregunta."); return; }
    for (const p of preguntas) {
      if (!p.texto.trim()) { setError("Todas las preguntas deben tener texto."); return; }
      if ((p.tipo === "seleccion" || p.tipo === "multiple") && (p.opciones || []).filter(Boolean).length < 2) {
        setError(`La pregunta "${p.texto}" necesita al menos 2 opciones.`); return;
      }
    }
    if (frecuencia === "unica" && !fechaUnica) { setError("Selecciona la fecha del formulario."); return; }
    setError("");
    setGuardando(true);
    try {
      const datos = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        preguntas: preguntas.map((p) => ({
          ...p,
          texto: p.texto.trim(),
          opciones: (p.opciones || []).filter(Boolean),
        })),
        responsables,
        frecuencia,
        fechaUnica: frecuencia === "unica" ? fechaUnica : "",
      };
      if (editando) {
        await actualizarFormulario(formulario.id, datos);
      } else {
        await crearFormulario(datos);
      }
      onGuardado();
    } catch (e) {
      setError("Error al guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const usuariosDisponibles = usuarios.filter(
    (u) => u.rol !== "deshabilitado" && u.estado === "activo"
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 28px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 20px" }}>
        <h2 style={{ margin: 0, fontSize: 20, color: "#1f2a2e" }}>
          {editando ? "Editar formulario" : "Nuevo formulario"}
        </h2>
        <button className="ca-btn-texto" onClick={onCancelar}>← Volver</button>
      </div>

      <form onSubmit={guardar}>
        {/* ── Datos generales ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={estilos.subtitulo}>Información general</h3>

          <label className="ca-label">Título *</label>
          <input
            className="ca-input"
            style={{ marginBottom: 14 }}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Inspección diaria de equipos"
          />

          <label className="ca-label">Descripción</label>
          <textarea
            className="ca-input"
            rows={2}
            style={{ marginBottom: 14, resize: "vertical" }}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Instrucciones o contexto del formulario (opcional)"
          />

          <label className="ca-label">Frecuencia *</label>
          <select
            className="ca-input"
            style={{ marginBottom: frecuencia === "unica" ? 14 : 0 }}
            value={frecuencia}
            onChange={(e) => setFrecuencia(e.target.value)}
          >
            {FRECUENCIAS.map((f) => (
              <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
            ))}
          </select>
          {frecuencia === "unica" && (
            <div style={{ marginTop: 10 }}>
              <label className="ca-label">Fecha *</label>
              <input
                className="ca-input"
                type="date"
                value={fechaUnica}
                onChange={(e) => setFechaUnica(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── Responsables ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={estilos.subtitulo}>Responsables</h3>
          <p style={{ fontSize: 13, color: "#5b6b6e", marginTop: 0, marginBottom: 12 }}>
            Selecciona quiénes deben completar este formulario.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {usuariosDisponibles.map((u) => {
              const sel = responsables.includes(u.uid);
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => toggleResponsable(u.uid)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 100,
                    border: `2px solid ${sel ? "#14a79d" : "#dbe6e5"}`,
                    background: sel ? "#e5f6f4" : "#fff",
                    color: sel ? "#0e7d75" : "#5b6b6e",
                    fontWeight: sel ? 700 : 400,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {sel ? "✓ " : ""}{u.nombreUsuario}
                  {u.area ? ` · ${u.area}` : ""}
                </button>
              );
            })}
            {usuariosDisponibles.length === 0 && (
              <p style={{ color: "#5b6b6e", fontSize: 13, margin: 0 }}>No hay usuarios activos.</p>
            )}
          </div>
        </div>

        {/* ── Preguntas ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={estilos.subtitulo}>Preguntas</h3>

          {preguntas.map((p, idx) => (
            <div key={p.id} style={estilos.preguntaCard}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: "#14a79d", minWidth: 22, paddingTop: 14 }}>
                  {idx + 1}.
                </span>
                <input
                  className="ca-input"
                  value={p.texto}
                  onChange={(e) => actualizarPregunta(p.id, "texto", e.target.value)}
                  placeholder="Texto de la pregunta"
                  style={{ flex: 1 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <select
                  className="ca-input"
                  style={{ flex: 1, minWidth: 160 }}
                  value={p.tipo}
                  onChange={(e) => actualizarPregunta(p.id, "tipo", e.target.value)}
                >
                  {TIPOS_PREGUNTA.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                  ))}
                </select>

                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5b6b6e", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={p.obligatoria}
                    onChange={(e) => actualizarPregunta(p.id, "obligatoria", e.target.checked)}
                  />
                  Obligatoria
                </label>
              </div>

              {/* Opciones para selección / múltiple */}
              {(p.tipo === "seleccion" || p.tipo === "multiple") && (
                <div style={{ marginBottom: 10 }}>
                  {(p.opciones || []).map((op, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        className="ca-input"
                        value={op}
                        onChange={(e) => actualizarOpcion(p.id, i, e.target.value)}
                        placeholder={`Opción ${i + 1}`}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => eliminarOpcion(p.id, i)}
                        style={{ background: "none", border: "none", color: "#d9534f", cursor: "pointer", fontSize: 18 }}
                      >✕</button>
                    </div>
                  ))}
                  <button type="button" className="ca-btn-texto" onClick={() => agregarOpcion(p.id)} style={{ fontSize: 13 }}>
                    + Agregar opción
                  </button>
                </div>
              )}

              {/* Controles de la pregunta */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => moverPregunta(p.id, -1)} disabled={idx === 0}
                  style={estilos.btnIcono}>↑</button>
                <button type="button" onClick={() => moverPregunta(p.id, 1)} disabled={idx === preguntas.length - 1}
                  style={estilos.btnIcono}>↓</button>
                <button type="button" onClick={() => eliminarPregunta(p.id)} disabled={preguntas.length === 1}
                  style={{ ...estilos.btnIcono, color: "#d9534f" }}>🗑</button>
              </div>
            </div>
          ))}

          <button type="button" className="ca-btn ca-btn-secundario" onClick={agregarPregunta} style={{ marginTop: 4 }}>
            + Agregar pregunta
          </button>
        </div>

        {error && <p style={estilos.error}>{error}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="ca-btn ca-btn-secundario" onClick={onCancelar} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="ca-btn" disabled={guardando} style={{ flex: 2 }}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear formulario"}
          </button>
        </div>
      </form>
    </div>
  );
}

const estilos = {
  subtitulo: { margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#1f2a2e" },
  preguntaCard: {
    background: "#f4f8f8",
    borderRadius: 12,
    padding: "14px 14px 10px",
    marginBottom: 12,
    border: "1px solid #dbe6e5",
  },
  btnIcono: {
    background: "none", border: "1px solid #dbe6e5", borderRadius: 8,
    padding: "4px 10px", cursor: "pointer", fontSize: 15, color: "#5b6b6e",
  },
  error: {
    color: "#d9534f", fontSize: 14, margin: "0 0 14px",
    background: "#fdf2f2", padding: "8px 12px", borderRadius: 8,
  },
};
