import { useState } from "react";
import { verificarClave } from "./auth.js";

// Confirmación con clave para acciones que no se pueden deshacer (eliminar un formulario o una asignación):
// quien está conectado (Excelencia / Master) escribe su clave de las apps.
//   const [modalClave, pedirClave] = useConfirmarConClave(usuario);
//   if (!(await pedirClave("Eliminar formulario", "…"))) return;

const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

function ModalClave({ usuario, titulo, texto, onListo }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  async function confirmar(e) {
    e.preventDefault();
    setError("");
    setTrabajando(true);
    try {
      if (await verificarClave(usuario?.uid, clave)) return onListo(true);
      setError("Clave incorrecta.");
    } catch (err) {
      setError(`No se pudo verificar la clave (${err.code || err.message}).`);
    }
    setTrabajando(false);
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,20,18,.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px" }} onClick={() => onListo(false)}>
      <form className="ca-card" style={{ maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()} onSubmit={confirmar}>
        <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 16, color: "var(--rojo, #993C1D)" }}>{titulo}</p>
        {texto && <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--texto-suave)", whiteSpace: "pre-line" }}>{texto}</p>}
        <label className="ca-label">Escribe tu clave para confirmar</label>
        <input className="rp-input" type="password" aria-label="Clave para confirmar" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus />
        {error && <p style={{ color: "var(--rojo, #993C1D)", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" style={btn} onClick={() => onListo(false)}>Cancelar</button>
          <button type="submit" style={{ ...btn, background: "var(--rojo, #993C1D)", color: "#fff", borderColor: "var(--rojo, #993C1D)" }} disabled={!clave || trabajando}>{trabajando ? "Verificando…" : "Eliminar"}</button>
        </div>
      </form>
    </div>
  );
}

export function useConfirmarConClave(usuario) {
  const [pedido, setPedido] = useState(null);
  const pedir = (titulo, texto = "") => new Promise((resolve) => setPedido({ titulo, texto, resolve }));
  const modal = pedido ? (
    <ModalClave usuario={usuario} titulo={pedido.titulo} texto={pedido.texto} onListo={(ok) => { pedido.resolve(ok); setPedido(null); }} />
  ) : null;
  return [modal, pedir];
}
