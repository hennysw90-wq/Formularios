import { useEffect, useState } from "react";
import { listarUsuarios, listarAreas, crearUsuarioPendiente } from "./auth.js";
import { buscarOpciones } from "./BuscarOpcion.jsx";

// Campo «Usuario»: se busca a la persona en el directorio de usuarios (escribiendo parte del nombre). Si no está,
// se puede crear ahí mismo con nombre, área y cargo: queda «por validar» hasta que un administrador la valide en
// Administración (el mismo proceso que el resto de los registros nuevos).

const L = {
  lista: { border: "1px solid var(--borde, #D3D1C7)", borderRadius: 8, marginTop: 4, background: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.08)", overflow: "hidden" },
  fila: { display: "flex", width: "100%", gap: 8, alignItems: "center", textAlign: "left", border: "none", borderTop: "1px solid #fff", borderLeft: "4px solid #0F6E56", padding: "9px 12px", background: "#E1F5EE", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: "#0F3D33" },
  elegido: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1.5px solid #0F6E56", borderRadius: 8, padding: "8px 11px", background: "#E1F5EE" },
  boton: { border: "1px solid #D3D1C7", background: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  prim: { border: "1px solid #0F6E56", background: "#0F6E56", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
};

let cacheUsuarios = null;
export function useUsuariosDirectorio() {
  const [lista, setLista] = useState(cacheUsuarios);
  useEffect(() => listarUsuarios((l) => { cacheUsuarios = l; setLista(l); }, () => setLista((x) => x || [])), []);
  return lista;
}

export default function SelectorUsuario({ valor, etiqueta = "persona", soloLectura = false, onCambiar }) {
  const usuarios = useUsuariosDirectorio();
  const [areas, setAreas] = useState([]);
  const [texto, setTexto] = useState("");
  const [creando, setCreando] = useState(null); // { nombre, area, cargo }
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => listarAreas(setAreas, () => setAreas([])), []);

  const validos = (usuarios || []).filter((u) => u.rol !== "deshabilitado" && String(u.nombreUsuario || "").trim());
  const porNombre = new Map(validos.map((u) => [u.nombreUsuario, u]));
  const actual = valor ? porNombre.get(valor) : null;
  const pill = (u) => (u?.estado === "pendiente" ? <span className="ca-pill ca-pill-ambar" style={{ fontSize: 11 }}>por validar</span> : null);

  if (valor) {
    return (
      <div style={L.elegido}>
        <span style={{ fontWeight: 700 }}>
          {valor}
          {actual?.area ? <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}> · {actual.area}</span> : null} {pill(actual)}
        </span>
        {!soloLectura && <button type="button" style={L.boton} onClick={() => { onCambiar("", ""); setTexto(""); }}>Cambiar</button>}
      </div>
    );
  }
  if (soloLectura) return <div className="rp-input" style={{ background: "var(--fondo)" }}>—</div>;

  const encontrados = buscarOpciones(texto, [...porNombre.keys()], 8);
  const exacto = encontrados.some((n) => n.toLowerCase() === texto.trim().toLowerCase());

  async function crear() {
    setError("");
    if (!creando.nombre.trim()) return setError("Escribe el nombre.");
    if (!creando.area) return setError("Elige el área.");
    setTrabajando(true);
    try {
      const u = await crearUsuarioPendiente(creando.nombre, creando.area, creando.cargo);
      onCambiar(u.nombreUsuario, u.uid);
      setCreando(null);
      setTexto("");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setTrabajando(false);
    }
  }

  if (creando) {
    return (
      <div style={{ border: "1.5px dashed #BA7517", borderRadius: 10, padding: 10, background: "#FFFBF3" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Crear {etiqueta.toLowerCase()} nuevo</div>
        <input className="rp-input" value={creando.nombre} placeholder="Nombre y apellido" aria-label="Nombre de la persona nueva" onChange={(e) => setCreando({ ...creando, nombre: e.target.value })} />
        <select className="rp-select" style={{ marginTop: 6 }} value={creando.area} aria-label="Área de la persona nueva" onChange={(e) => setCreando({ ...creando, area: e.target.value })}>
          <option value="">Área…</option>
          {areas.map((a) => <option key={a.id} value={a.nombre}>{a.nombre}</option>)}
        </select>
        <input className="rp-input" style={{ marginTop: 6 }} value={creando.cargo} placeholder="Cargo (opcional)" aria-label="Cargo de la persona nueva" onChange={(e) => setCreando({ ...creando, cargo: e.target.value })} />
        <div style={{ fontSize: 12, color: "var(--texto-suave)", margin: "6px 0" }}>Quedará «por validar»: un administrador la revisa en Administración (igual que cualquier registro nuevo). Ya puedes elegirla en esta evaluación.</div>
        {error && <div style={{ color: "var(--rojo, #993C1D)", fontSize: 12.5, marginBottom: 6 }}>{error}</div>}
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={L.prim} disabled={trabajando} onClick={crear}>{trabajando ? "Creando…" : "Crear y elegir"}</button>
          <button type="button" style={L.boton} disabled={trabajando} onClick={() => setCreando(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input className="rp-input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={usuarios === null ? "Cargando usuarios…" : "Escribe parte del nombre…"} aria-label={`Buscar ${etiqueta}`} autoComplete="off" />
      {texto.trim().length >= 2 && (
        <div style={L.lista}>
          {encontrados.map((n) => (
            <button key={n} type="button" style={L.fila} onClick={() => { onCambiar(n, porNombre.get(n)?.uid || ""); setTexto(""); }}>
              <span style={{ fontWeight: 700 }}>{n}</span>
              <span style={{ color: "var(--texto-suave)", fontSize: 12.5 }}>{porNombre.get(n)?.area || ""}</span>
              {pill(porNombre.get(n))}
            </button>
          ))}
          {!exacto && (
            <button type="button" style={{ ...L.fila, background: "#FFFBF3", borderLeftColor: "#BA7517", color: "#7A4A0C", fontWeight: 700 }} onClick={() => setCreando({ nombre: texto.trim(), area: "", cargo: "" })}>
              + No está: crear «{texto.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}
