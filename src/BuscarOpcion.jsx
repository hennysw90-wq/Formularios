import { useState } from "react";

// Pregunta "Lista con búsqueda": quien responde escribe parte del texto (sin importar mayúsculas, acentos ni
// espacios) y elige de las coincidencias. Solo se puede elegir algo de la lista.

const compacto = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function buscarOpciones(texto, opciones, max = 8) {
  const partes = String(texto || "").split(/\s+/).map(compacto).filter(Boolean);
  if (!partes.length) return [];
  const q = partes.join("");
  return (opciones || [])
    .filter((o) => partes.every((p) => compacto(o).includes(p)))
    .sort((a, b) => Number(!compacto(a).startsWith(q)) - Number(!compacto(b).startsWith(q)) || a.localeCompare(b))
    .slice(0, max);
}

const L = {
  lista: { border: "1px solid var(--borde, #D3D1C7)", borderRadius: 8, marginTop: 4, background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", overflow: "hidden" },
  fila: { display: "block", width: "100%", textAlign: "left", border: "none", borderTop: "1px solid #fff", borderLeft: "4px solid #0F6E56", padding: "9px 12px", background: "#E1F5EE", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: "#0F3D33", fontWeight: 600 },
  elegido: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1.5px solid #0F6E56", borderRadius: 8, padding: "8px 11px", background: "#E1F5EE" },
  boton: { border: "1px solid #D3D1C7", background: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
};

export default function BuscarOpcion({ opciones = [], valor, onCambiar, soloLectura = false, etiqueta = "" }) {
  const [texto, setTexto] = useState("");
  if (valor) {
    return (
      <div style={L.elegido}>
        <b style={{ color: "#0F3D33", fontSize: 14.5 }}>{valor}</b>
        {!soloLectura && (
          <button type="button" style={L.boton} onClick={() => { onCambiar(""); setTexto(""); }} aria-label={`Cambiar ${etiqueta}`.trim()}>Cambiar</button>
        )}
      </div>
    );
  }
  if (soloLectura) return <div style={{ color: "#8A877D", fontSize: 14 }}>—</div>;
  const encontrados = texto.trim().length >= 1 ? buscarOpciones(texto, opciones, 8) : [];
  return (
    <div>
      <input
        className="rp-input"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`Escribe para buscar (${opciones.length} opciones)`}
        aria-label={etiqueta ? `Buscar ${etiqueta}` : "Buscar opción"}
        autoComplete="off"
      />
      {texto.trim() && (
        <div style={L.lista} role="listbox">
          {encontrados.map((o) => (
            <button key={o} type="button" role="option" style={L.fila} onClick={() => { onCambiar(o); setTexto(""); }}>{o}</button>
          ))}
          {encontrados.length === 0 && <div style={{ fontSize: 13, color: "#8A877D", padding: "8px 12px" }}>No hay opciones que coincidan con "{texto.trim()}".</div>}
        </div>
      )}
    </div>
  );
}
