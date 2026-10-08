import { useState, useEffect } from "react";
import { cumplimientoDePersona, etiquetaCadencia } from "./formularios.js";

export default function MiPlan({ usuario, onAbrirFormulario }) {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    cumplimientoDePersona(usuario.uid)
      .then((r) => vivo && setFilas(r))
      .catch(() => vivo && setError("No se pudo cargar tu plan."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [usuario.uid]);

  // Totales de todas las asignaciones del periodo vigente.
  const items = filas.flatMap((f) => f.agenda);
  const totalPedido = items.reduce((s, i) => s + i.total, 0);
  const totalHecho = items.reduce((s, i) => s + Math.min(i.hechas, i.total), 0);
  const porcentaje = totalPedido > 0 ? Math.round((totalHecho / totalPedido) * 100) : 0;

  if (cargando) return <div className="ca-contenido"><p style={gris}>Cargando tu plan…</p></div>;
  if (error) return <div className="ca-contenido"><p style={{ color: "var(--rojo)" }}>{error}</p></div>;

  return (
    <div className="ca-contenido">
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Cumplimiento de mi plan</h2>
      <p style={{ ...gris, margin: "0 0 18px" }}>
        Lo que tienes asignado en cada formulario, contado sobre el periodo que corre ahora.
      </p>

      {items.length === 0 ? (
        <div className="ca-card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🗓️</div>
          <p style={{ ...gris, margin: 0 }}>No tienes formularios asignados.</p>
        </div>
      ) : (
        <>
          <div className="ca-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <strong style={{ fontSize: 15 }}>Avance del periodo</strong>
              <span style={{ fontSize: 22, fontWeight: 800, color: colorAvance(porcentaje) }}>
                {porcentaje}%
              </span>
            </div>
            <Barra porcentaje={porcentaje} />
            <p style={{ ...gris, fontSize: 13, margin: "8px 0 0" }}>
              {totalHecho} de {totalPedido} ejecuciones completadas ·{" "}
              {items.filter((i) => i.completa).length} de {items.length} asignaciones al día
            </p>
          </div>

          {filas.map(({ formulario, agenda }) => (
            <div key={formulario.id} className="ca-card" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 16 }}>{formulario.titulo}</p>
                  {formulario.descripcion && (
                    <p style={{ ...gris, fontSize: 13, margin: 0 }}>{formulario.descripcion}</p>
                  )}
                </div>
                {onAbrirFormulario && (
                  <button
                    className="ca-btn ca-btn-secundario"
                    style={{ width: "auto", padding: "6px 14px", flexShrink: 0 }}
                    onClick={() => onAbrirFormulario(formulario)}
                  >
                    Ver
                  </button>
                )}
              </div>

              {agenda.map((item) => (
                <div key={item.asignacion.id} style={fila}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 14 }}>
                      {item.asignacion.reunionNombre || "Sin reunión"}
                    </p>
                    <p style={{ ...gris, fontSize: 12, margin: "0 0 6px" }}>
                      {etiquetaCadencia(item.asignacion.cantidad, item.asignacion.frecuencia)}
                      {" · "}{item.hechas} de {item.total} en este periodo
                    </p>
                    <Barra porcentaje={item.total ? Math.round((Math.min(item.hechas, item.total) / item.total) * 100) : 0} alto={6} />
                  </div>
                  <span style={item.completa ? chipOk : chipPendiente}>
                    {item.completa ? "✓ Al día" : `Faltan ${item.pendientes}`}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Barra({ porcentaje, alto = 9 }) {
  return (
    <div style={{ background: "var(--borde)", borderRadius: 100, height: alto, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.min(100, porcentaje)}%`,
          height: "100%",
          background: colorAvance(porcentaje),
          borderRadius: 100,
          transition: "width .3s",
        }}
      />
    </div>
  );
}

function colorAvance(p) {
  if (p >= 100) return "var(--verde)";
  if (p >= 50) return "var(--ambar)";
  return "var(--rojo)";
}

const gris = { color: "var(--texto-suave)", fontSize: 14 };
const fila = { display: "flex", gap: 10, alignItems: "flex-start", borderTop: "1px solid var(--borde)", paddingTop: 11, marginTop: 11 };
const chipOk = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "var(--verde-claro)", color: "var(--verde-oscuro)", whiteSpace: "nowrap" };
const chipPendiente = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, background: "#fbe8c8", color: "#8a5a00", whiteSpace: "nowrap" };
