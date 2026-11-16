import { useState } from "react";
import { guardarListados, usosDeListados, lineasDeListado, parsearLineasListado } from "./listados.js";
import { nuevoId } from "./formularios.js";

// Formularios → Listados: listas reutilizables (ej. Estándares, Equipos) para las preguntas "Lista con búsqueda" y
// "Lista de opciones". Al cambiar un listado, se actualiza en todos los formularios que lo usan.

const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnPrim = { ...btn, background: "var(--verde, #009899)", borderColor: "var(--verde, #009899)", color: "#fff" };

function TarjetaListado({ l, usos, onGuardar, onEliminar }) {
  const [abierto, setAbierto] = useState(!l.opciones?.length);
  const [nombre, setNombre] = useState(l.nombre);
  const [texto, setTexto] = useState(lineasDeListado(l).join("\n"));
  const [trabajando, setTrabajando] = useState(false);
  const { opciones, subareas } = parsearLineasListado(texto);
  const cambiado = nombre.trim() !== l.nombre || lineasDeListado({ opciones, subareas }).join("\n") !== lineasDeListado(l).join("\n");
  const nSub = new Set(Object.values(subareas)).size;
  async function guardar() {
    if (!nombre.trim()) return window.alert("El listado necesita un nombre.");
    setTrabajando(true);
    try {
      await onGuardar({ ...l, nombre: nombre.trim(), opciones, subareas });
    } finally {
      setTrabajando(false);
    }
  }
  return (
    <div className="ca-card" style={{ marginBottom: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button style={{ ...btn, border: "none", padding: "2px 6px" }} onClick={() => setAbierto(!abierto)} aria-label={`${abierto ? "Cerrar" : "Abrir"} listado ${l.nombre}`}>{abierto ? "▾" : "▸"}</button>
        <input className="rp-input" style={{ maxWidth: 260, fontWeight: 700 }} value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label={`Nombre del listado ${l.nombre}`} placeholder="Nombre del listado" />
        <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>{opciones.length} opciones{nSub ? ` · ${nSub} sub área${nSub === 1 ? "" : "s"}` : ""}</span>
        <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{usos.length ? `· Lo usa: ${usos.join(", ")}` : "· Ningún formulario lo usa todavía"}</span>
        <span style={{ flex: 1 }} />
        {cambiado && <button style={btnPrim} disabled={trabajando} onClick={guardar}>{trabajando ? "Guardando…" : "Guardar listado"}</button>}
        <button
          style={{ ...btn, color: "var(--rojo, #993C1D)" }}
          disabled={trabajando}
          onClick={() => {
            if (usos.length) return window.alert(`No se puede eliminar: lo usa ${usos.join(", ")}. Cambia esas preguntas a otro listado primero.`);
            if (window.confirm(`¿Eliminar el listado "${l.nombre}"?`)) onEliminar(l);
          }}
        >
          Eliminar
        </button>
      </div>
      {abierto && (
        <div style={{ marginTop: 10 }}>
          <textarea
            className="rp-textarea"
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label={`Opciones del listado ${l.nombre}`}
            placeholder={"Una opción por línea. Para darle sub área, agrégala después de una barra:\nEST-01 Bloqueo y etiquetado | Eléctrica\nEST-02 Trabajo en altura | Mecánica"}
          />
          <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>
            Una opción por línea; las repetidas y las líneas vacías se quitan solas. Sub área (opcional): después de « | », ej. «EST-01 Bloqueo | Eléctrica».
            En el Plan de evaluadores se puede asignar a cada evaluador una opción, una sub área completa o varias.
          </div>
          {nSub > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {[...new Set(Object.values(subareas))].sort((a, b) => a.localeCompare(b, "es")).map((s) => (
                <span key={s} className="ca-chip" style={{ fontSize: 12 }}>{s} · {Object.values(subareas).filter((x) => x === s).length}</span>
              ))}
              {opciones.some((o) => !subareas[o]) && <span className="ca-chip" style={{ fontSize: 12, opacity: 0.7 }}>Sin sub área · {opciones.filter((o) => !subareas[o]).length}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ListadosAdmin({ listados, formularios, usuario }) {
  const [error, setError] = useState("");
  const usos = usosDeListados(formularios);
  async function guardarTodo(nuevos) {
    setError("");
    try {
      await guardarListados(nuevos, usuario);
    } catch (e) {
      console.error(e);
      setError(`No se pudo guardar (${e.code || e.message}).`);
    }
  }
  const lista = listados || [];
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Listados ({lista.length})</h2>
        <button
          style={btnPrim}
          onClick={() => {
            const nombre = window.prompt("Nombre del listado nuevo (ej. Estándares):", "");
            if (!nombre || !nombre.trim()) return;
            if (lista.some((l) => l.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())) return window.alert(`Ya existe el listado "${nombre.trim()}".`);
            guardarTodo([...lista, { id: nuevoId("l"), nombre: nombre.trim(), opciones: [] }]);
          }}
        >
          + Nuevo listado
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", margin: "0 0 12px" }}>
        Listas reutilizables (por ejemplo Estándares o Equipos). En A · Datos generales, una pregunta «Lista con búsqueda» o «Lista de opciones» puede tomar sus opciones
        de un listado: al cambiar el listado aquí, se actualiza en todos los formularios que lo usan.
      </p>
      {error && <p style={{ color: "var(--rojo, #993C1D)", fontSize: 13.5 }}>{error}</p>}
      {listados === null && <p style={{ color: "var(--texto-suave)" }}>Cargando listados…</p>}
      {listados !== null && lista.length === 0 && <p style={{ color: "var(--texto-suave)", fontSize: 14 }}>Todavía no hay listados. Crea uno con «+ Nuevo listado».</p>}
      {lista.map((l) => (
        <TarjetaListado
          key={l.id + l.nombre + (l.opciones || []).length}
          l={l}
          usos={usos[l.id] || []}
          onGuardar={(nuevo) => guardarTodo(lista.map((x) => (x.id === nuevo.id ? nuevo : x)))}
          onEliminar={(borrado) => guardarTodo(lista.filter((x) => x.id !== borrado.id))}
        />
      ))}
    </div>
  );
}
