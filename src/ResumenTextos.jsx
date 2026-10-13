import { useState, useMemo } from "react";
import { textosPorPregunta } from "./resumenTextos.js";

export default function ResumenTextos({ formulario, respuestas, embebido = false }) {
  const bloques = useMemo(
    () => textosPorPregunta(formulario, respuestas),
    [formulario, respuestas]
  );
  const [abierta, setAbierta] = useState(null);

  if (bloques.length === 0) return null;

  const Envoltura = embebido ? "div" : "div";
  return (
    <Envoltura className={embebido ? undefined : "ca-card"} style={{ marginBottom: embebido ? 0 : 16 }}>
      <h3 style={sub}>{embebido ? "Lo que te escribieron" : "Resumen de las respuestas escritas"}</h3>
      <p style={{ ...gris, margin: "0 0 14px" }}>
        Lo que más se repite en cada pregunta de texto. Toca una pregunta para
        ver el desglose por reunión.
      </p>

      {bloques.map(({ pregunta, entradas, temas, grupos }) => {
        const estaAbierta = abierta === pregunta.id;
        return (
          <div key={pregunta.id} style={caja}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
              onClick={() => setAbierta(estaAbierta ? null : pregunta.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14 }}>{pregunta.texto}</p>
                <p style={{ ...gris, fontSize: 12, margin: 0 }}>
                  {entradas.length} respuesta{entradas.length === 1 ? "" : "s"} ·{" "}
                  {grupos.length} reuni{grupos.length === 1 ? "ón" : "ones"}
                </p>
              </div>
              <span style={{ ...gris, fontSize: 17 }}>{estaAbierta ? "▴" : "▾"}</span>
            </div>

            {temas.length > 0 ? (
              <ul style={lista}>
                {temas.map((t) => (
                  <li key={t.frase} style={{ marginBottom: 5 }}>
                    <strong style={{ textTransform: "capitalize" }}>{t.frase}</strong>
                    <span style={{ ...gris, fontSize: 12 }}>
                      {" "}— en {t.enRespuestas} de {entradas.length} respuestas
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ ...gris, fontSize: 12, margin: "10px 0 0" }}>
                Todavía no hay nada que se repita entre respuestas distintas.
                {entradas.length < 2 && " Con una sola respuesta no hay con qué comparar."}
              </p>
            )}

            {estaAbierta && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
                {grupos.map((g) => (
                  <div key={g.reunion} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span className="ca-chip" style={{ fontSize: 11 }}>{g.reunion}</span>
                      <span style={{ ...gris, fontSize: 11 }}>
                        {g.entradas.length} respuesta{g.entradas.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {g.temas.length > 0 && (
                      <p style={{ ...gris, fontSize: 12, margin: "0 0 7px" }}>
                        Se repite:{" "}
                        {g.temas.map((t, i) => (
                          <span key={t.frase}>
                            {i > 0 && " · "}
                            <strong style={{ color: "var(--texto)" }}>{t.frase}</strong>
                          </span>
                        ))}
                      </p>
                    )}

                    {g.entradas.map((e, i) => (
                      <div key={i} style={cita}>
                        <p style={{ margin: 0, fontSize: 13 }}>{e.texto}</p>
                        <p style={{ ...gris, fontSize: 11, margin: "3px 0 0" }}>
                          {e.nombreUsuario}
                          {e.destinatario && ` → ${e.destinatario}`}
                          {e.fecha && ` · ${fecha(e.fecha)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Envoltura>
  );
}

function fecha(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

const sub = { margin: "0 0 6px", fontSize: 15, fontWeight: 700 };
const gris = { color: "var(--texto-suave)", fontSize: 13 };
const caja = {
  background: "var(--fondo)",
  border: "1px solid var(--borde)",
  borderRadius: 12,
  padding: "13px 14px",
  marginBottom: 11,
};
const lista = { margin: "10px 0 0", paddingLeft: 20, fontSize: 13 };
const cita = {
  borderLeft: "3px solid var(--verde-claro)",
  paddingLeft: 10,
  marginBottom: 8,
  background: "#fff",
  borderRadius: "0 8px 8px 0",
  padding: "7px 10px",
};
