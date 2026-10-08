import { useState, useEffect } from "react";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import { obtenerFormulario, guardarRespuesta, TIPOS_PREGUNTA } from "./formularios.js";

export default function RegistroFormulario({ formularioId }) {
  const [formulario, setFormulario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("");
  const [respuestas, setRespuestas] = useState({});
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obtenerFormulario(formularioId)
      .then((f) => {
        if (!f || !f.activo) {
          setError("Formulario no encontrado o inactivo.");
        } else {
          setFormulario(f);
        }
      })
      .catch(() => setError("Error al cargar el formulario."))
      .finally(() => setCargando(false));
  }, [formularioId]);

  function setRespuesta(preguntaId, valor) {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
  }

  function toggleMultiple(preguntaId, opcion) {
    setRespuestas((prev) => {
      const actual = prev[preguntaId] || [];
      const nuevo = actual.includes(opcion)
        ? actual.filter((o) => o !== opcion)
        : [...actual, opcion];
      return { ...prev, [preguntaId]: nuevo };
    });
  }

  async function enviar(ev) {
    ev.preventDefault();
    if (!nombre.trim()) {
      setError("Escribe tu nombre para responder.");
      return;
    }
    // Validar obligatorias
    const obligatorias = (formulario.preguntas || []).filter((p) => p.obligatoria);
    for (const p of obligatorias) {
      const r = respuestas[p.id];
      if (!r || (Array.isArray(r) && r.length === 0) || r === "") {
        setError(`Debes responder: "${p.texto}"`);
        return;
      }
    }
    setError("");
    setEnviando(true);
    try {
      await guardarRespuesta({
        formularioId,
        nombreUsuario: nombre.trim(),
        area: area.trim(),
        respuestas,
      });
      setEnviado(true);
    } catch (e) {
      setError("Error al enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div style={estilos.fondo}>
        <p style={{ color: "#5b6b6e" }}>Cargando formulario…</p>
      </div>
    );
  }

  if (error && !formulario) {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.card}>
          <img src={logoLomasBayas} alt="Lomas Bayas" style={estilos.logo} />
          <p style={{ color: "#d9534f", textAlign: "center" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.card}>
          <img src={logoLomasBayas} alt="Lomas Bayas" style={estilos.logo} />
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 50, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", color: "#1f2a2e" }}>¡Respuesta enviada!</h2>
            <p style={{ color: "#5b6b6e", margin: 0 }}>Gracias, {nombre}.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.fondo}>
      <div style={estilos.card}>
        <img src={logoLomasBayas} alt="Lomas Bayas" style={estilos.logo} />
        <h2 style={estilos.titulo}>{formulario.titulo}</h2>
        {formulario.descripcion && (
          <p style={{ color: "#5b6b6e", marginTop: 0, marginBottom: 20, textAlign: "center", fontSize: 14 }}>
            {formulario.descripcion}
          </p>
        )}

        <form onSubmit={enviar}>
          <label className="ca-label">Tu nombre *</label>
          <input
            className="ca-input"
            style={{ marginBottom: 14 }}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
          />

          <label className="ca-label">Área (opcional)</label>
          <input
            className="ca-input"
            style={{ marginBottom: 24 }}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Tu área de trabajo"
          />

          {(formulario.preguntas || []).map((p, idx) => (
            <div key={p.id} style={{ marginBottom: 20 }}>
              <label className="ca-label" style={{ fontSize: 14 }}>
                {idx + 1}. {p.texto} {p.obligatoria && <span style={{ color: "#d9534f" }}>*</span>}
              </label>
              <PreguntaInput
                pregunta={p}
                valor={respuestas[p.id]}
                onChange={(v) => setRespuesta(p.id, v)}
                onToggle={(o) => toggleMultiple(p.id, o)}
              />
            </div>
          ))}

          {error && <p style={estilos.error}>{error}</p>}

          <button className="ca-btn" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar respuesta"}
          </button>
        </form>
      </div>
      <p style={estilos.footer}>Formularios · v1.1.0 · Henny</p>
    </div>
  );
}

function PreguntaInput({ pregunta, valor, onChange, onToggle }) {
  switch (pregunta.tipo) {
    case "si_no":
      return (
        <div style={{ display: "flex", gap: 10 }}>
          {["Sí", "No"].map((op) => (
            <button
              key={op}
              type="button"
              className={`ca-btn ${valor === op ? "" : "ca-btn-secundario"}`}
              style={{ flex: 1 }}
              onClick={() => onChange(op)}
            >
              {op}
            </button>
          ))}
        </div>
      );

    case "seleccion":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(pregunta.opciones || []).map((op) => (
            <button
              key={op}
              type="button"
              className={`ca-btn ${valor === op ? "" : "ca-btn-secundario"}`}
              onClick={() => onChange(op)}
            >
              {op}
            </button>
          ))}
        </div>
      );

    case "multiple":
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(pregunta.opciones || []).map((op) => {
            const sel = (valor || []).includes(op);
            return (
              <button
                key={op}
                type="button"
                style={{
                  padding: "6px 14px",
                  borderRadius: 100,
                  border: `2px solid ${sel ? "#14a79d" : "#dbe6e5"}`,
                  background: sel ? "#e5f6f4" : "#fff",
                  color: sel ? "#0e7d75" : "#5b6b6e",
                  fontWeight: sel ? 700 : 400,
                  cursor: "pointer",
                }}
                onClick={() => onToggle(op)}
              >
                {sel ? "✓ " : ""}{op}
              </button>
            );
          })}
        </div>
      );

    case "numero":
      return (
        <input
          className="ca-input"
          type="number"
          value={valor || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ingresa un número"
        />
      );

    default: // texto
      return (
        <textarea
          className="ca-input"
          rows={3}
          value={valor || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe tu respuesta…"
          style={{ resize: "vertical" }}
        />
      );
  }
}

const estilos = {
  fondo: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    background: "#f4f8f8",
    padding: "20px",
    gap: 16,
    paddingTop: 40,
  },
  card: {
    background: "#fff",
    borderRadius: 18,
    padding: "28px 24px",
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 4px 20px rgba(14,125,117,0.10)",
    border: "1px solid #dbe6e5",
  },
  logo: { display: "block", margin: "0 auto 18px", height: 44 },
  titulo: { textAlign: "center", margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1f2a2e" },
  error: { color: "#d9534f", fontSize: 14, margin: "0 0 12px", background: "#fdf2f2", padding: "8px 12px", borderRadius: 8 },
  footer: { color: "#5b6b6e", fontSize: 12, margin: 0 },
};
