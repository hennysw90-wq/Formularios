import { useState, useEffect } from "react";
import { recibidasDePersona, configDestinatario } from "./formularios.js";

export default function Recibidas({ usuario }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    let vivo = true;
    recibidasDePersona(usuario.uid)
      .then((r) => vivo && setItems(r))
      .catch(() => vivo && setError("No se pudieron cargar las respuestas recibidas."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [usuario.uid]);

  const sinTildes = (t) =>
    (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const texto = sinTildes(filtro.trim());
  const visibles = texto
    ? items.filter(
        (i) =>
          sinTildes(i.nombreUsuario).includes(texto) ||
          sinTildes(i.formulario?.titulo).includes(texto) ||
          sinTildes(i.reunionNombre).includes(texto)
      )
    : items;

  if (cargando) return <div className="ca-contenido"><p style={gris}>Cargando…</p></div>;
  if (error) return <div className="ca-contenido"><p style={{ color: "var(--rojo)" }}>{error}</p></div>;

  return (
    <div className="ca-contenido">
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Feedbacks y confirmaciones recibidas</h2>
      <p style={{ ...gris, margin: "0 0 16px" }}>
        Formularios que otras personas completaron y dirigieron a tu nombre.
      </p>

      {items.length === 0 ? (
        <div className="ca-card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📬</div>
          <p style={{ ...gris, margin: 0 }}>Todavía no recibes ninguno.</p>
        </div>
      ) : (
        <>
          <input
            className="ca-input"
            style={{ marginBottom: 16 }}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por persona, formulario o reunión…"
          />

          {visibles.length === 0 && (
            <p style={gris}>Nada coincide con esa búsqueda.</p>
          )}

          {visibles.map((item) => {
            const cfg = configDestinatario(item.formulario);
            const expandida = abierta === item.id;
            return (
              <div key={item.id} className="ca-card" style={{ marginBottom: 12 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
                  onClick={() => setAbierta(expandida ? null : item.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 15 }}>
                      {item.formulario?.titulo || "Formulario"}
                    </p>
                    <p style={{ ...gris, fontSize: 13, margin: "0 0 6px" }}>
                      De <strong>{item.nombreUsuario}</strong>
                      {item.area ? ` · ${item.area}` : ""} · {fecha(item.fecha)}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.reunionNombre && (
                        <span className="ca-chip" style={{ fontSize: 11 }}>{item.reunionNombre}</span>
                      )}
                      <span className="ca-chip ca-chip-ambar" style={{ fontSize: 11 }}>
                        {cfg.etiqueta}: tú
                      </span>
                    </div>
                  </div>
                  <span style={{ ...gris, fontSize: 18, flexShrink: 0 }}>{expandida ? "▴" : "▾"}</span>
                </div>

                {expandida && (
                  <div style={{ marginTop: 12, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
                    {(item.formulario?.preguntas || []).map((p) => {
                      const v = item.respuestas?.[p.id];
                      if (v === undefined || v === null || v === "") return null;
                      return (
                        <div key={p.id} style={{ fontSize: 13, marginBottom: 8 }}>
                          <span style={gris}>{p.texto}: </span>
                          {p.tipo === "imagen" ? (
                            <a href={v} target="_blank" rel="noreferrer">
                              <img src={v} alt="Adjunto" style={{ display: "block", maxWidth: 240, borderRadius: 8, marginTop: 4 }} />
                            </a>
                          ) : (
                            <strong>{Array.isArray(v) ? v.join(", ") : String(v)}</strong>
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
      )}
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

const gris = { color: "var(--texto-suave)", fontSize: 14 };
