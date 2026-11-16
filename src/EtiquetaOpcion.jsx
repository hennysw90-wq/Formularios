// Muestra una opción de listado de forma prolija. Las del Portal EO vienen como "LB-SS-GPR-GPR-0005 · Adición de
// reactivos": el nombre va destacado y el código en una etiqueta chica debajo (el valor guardado no cambia).

const RX = /^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\s+·\s+(.+)$/;

export function partesOpcion(texto) {
  const t = String(texto || "").trim();
  const m = t.match(RX);
  return m ? { codigo: m[1], nombre: m[2].replace(/^[A-Z]{1,4}_/, "").trim() } : { codigo: "", nombre: t };
}

/** Solo el nombre (para textos corridos). */
export const nombreOpcion = (texto) => partesOpcion(texto).nombre;

const chip = { fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace', fontSize: 11, fontWeight: 600, color: "#046566", background: "#E6F4F4", borderRadius: 5, padding: "1px 6px", letterSpacing: ".02em", whiteSpace: "nowrap" };

export default function EtiquetaOpcion({ texto, extra = "", grande = false, color = "inherit" }) {
  const { codigo, nombre } = partesOpcion(texto);
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={{ fontWeight: 650, fontSize: grande ? 17 : 14.5, lineHeight: 1.3, color }}>{nombre}</span>
      {(codigo || extra) && (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {codigo && <span style={chip}>{codigo}</span>}
          {extra && <span style={{ fontSize: 12, color: "var(--texto-suave, #6B6960)", fontWeight: 500 }}>{extra}</span>}
        </span>
      )}
    </span>
  );
}
