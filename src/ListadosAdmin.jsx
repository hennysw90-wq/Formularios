import { useState } from "react";
import { guardarListados, usosDeListados, lineasDeListado, parsearLineasListado, useEstadoPortalEO, filasDeListado, unirAreaNombre } from "./listados.js";
import { useUsuariosDirectorio } from "./SelectorUsuario.jsx";
import { buscarOpciones } from "./BuscarOpcion.jsx";
import { NOMBRE_LISTADO_PORTAL } from "./firebasePortalEO.js";
import { nuevoId } from "./formularios.js";

// Formularios → Listados: listas reutilizables (ej. Estándares, Equipos) para las preguntas "Lista con búsqueda" y
// "Lista de opciones". Al cambiar un listado, se actualiza en todos los formularios que lo usan.

const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnPrim = { ...btn, background: "var(--verde, #009899)", borderColor: "var(--verde, #009899)", color: "#fff" };

// Listado sincronizado con el Portal EO: solo lectura (se edita en el Portal, en "Gestionar Estándares").
function TarjetaSincronizada({ l, usos, estado }) {
  const [abierto, setAbierto] = useState(false);
  const subs = [...new Set(Object.values(l?.subareas || {}))].sort((a, b) => a.localeCompare(b, "es"));
  return (
    <div className="ca-card" style={{ marginBottom: 10, padding: 14, borderLeft: "4px solid #0F6E56" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button style={{ ...btn, border: "none", padding: "2px 6px" }} onClick={() => setAbierto(!abierto)} aria-label={`${abierto ? "Cerrar" : "Abrir"} listado ${NOMBRE_LISTADO_PORTAL}`}>{abierto ? "▾" : "▸"}</button>
        <b style={{ fontSize: 15 }}>{NOMBRE_LISTADO_PORTAL}</b>
        <span className="ca-pill ca-pill-verde">🔄 Sincronizado</span>
        <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>
          {estado === "error" ? "No se pudo leer el Portal EO" : !l ? "Leyendo el Portal EO…" : `${l.opciones.length} estándares · ${subs.length} área${subs.length === 1 ? "" : "s"}`}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{usos.length ? `· Lo usa: ${usos.join(", ")}` : "· Ningún formulario lo usa todavía"}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginTop: 6 }}>
        Se actualiza solo con el Portal EO (Gestionar Estándares): cada opción es «código · nombre» y su sub área es el área del estándar. Para cambiarlo, edítalo en el Portal.
      </div>
      {abierto && l && (
        <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto", border: "1px solid #EEECE6", borderRadius: 8 }}>
          {l.opciones.map((o) => (
            <div key={o} style={{ display: "flex", gap: 8, padding: "5px 10px", fontSize: 13, borderBottom: "1px solid #F3F1EC" }}>
              <span style={{ flex: 1 }}>{o}</span>
              <span style={{ color: "var(--texto-suave)" }}>{l.subareas?.[o] || "Sin área"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// Editor en tabla: Área · Nombre · Líderes (uno o varios, elegidos del directorio de usuarios).
function EditorTabla({ filas, setFilas, nombreDato }) {
  const usuarios = useUsuariosDirectorio();
  const areas = [...new Set(filas.map((f) => f.area.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const cambiar = (i, parte) => setFilas(filas.map((f, j) => (j === i ? { ...f, ...parte } : f)));
  const cab = { fontSize: 12, fontWeight: 800, color: "var(--texto-suave)", textTransform: "uppercase", letterSpacing: ".04em" };
  return (
    <div>
      <datalist id="dl-areas-tabla">{areas.map((a) => <option key={a} value={a} />)}</datalist>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,1fr) minmax(160px,1.6fr) minmax(200px,2fr) 36px", gap: 8, alignItems: "start" }}>
        <span style={cab}>Área</span><span style={cab}>{nombreDato}</span><span style={cab}>Líder(es) · del panel de usuarios</span><span />
        {filas.map((f, i) => (
          <FilaTabla key={i} f={f} i={i} cambiar={cambiar} usuarios={usuarios} quitar={() => setFilas(filas.filter((_, j) => j !== i))} nombreDato={nombreDato} />
        ))}
      </div>
      <button type="button" style={{ ...btn, marginTop: 10 }} onClick={() => setFilas([...filas, { area: filas[filas.length - 1]?.area || "", nombre: "", lideres: [] }])}>+ Agregar {nombreDato.toLowerCase()}</button>
    </div>
  );
}

// Buscador de líderes: lista las personas del Panel de usuarios (directorio) y filtra al escribir.
function BuscarLider({ usuarios, elegidos, placeholder, aria, onAgregar }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const validos = (usuarios || []).filter((u) => u.rol !== "deshabilitado" && String(u.nombreUsuario || "").trim() && !elegidos.includes(String(u.nombreUsuario).trim()));
  const porNombre = new Map(validos.map((u) => [String(u.nombreUsuario).trim(), u]));
  const nombres = [...porNombre.keys()];
  const hallados = texto.trim() ? buscarOpciones(texto, nombres, 8) : nombres.slice(0, 8);
  const elegir = (n) => { onAgregar(n); setTexto(""); setAbierto(false); };
  return (
    <div style={{ position: "relative" }}>
      <input className="rp-input" value={texto} placeholder={placeholder} aria-label={aria} autoComplete="off"
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hallados.length) elegir(hallados[0]); } }} />
      {abierto && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, background: "#fff", border: "1px solid var(--borde, #D3D1C7)", borderRadius: 8, marginTop: 2, boxShadow: "0 6px 18px rgba(0,0,0,.15)", maxHeight: 260, overflowY: "auto" }}>
          {usuarios === null ? <div style={{ padding: "9px 12px", fontSize: 13, color: "var(--texto-suave)" }}>Leyendo usuarios…</div>
            : hallados.length === 0 ? <div style={{ padding: "9px 12px", fontSize: 13, color: "var(--texto-suave)" }}>{texto.trim() ? "Nadie coincide en el panel de usuarios." : "No hay usuarios."}</div>
            : hallados.map((n) => {
              const u = porNombre.get(n);
              return (
                <button key={n} type="button" onMouseDown={(e) => { e.preventDefault(); elegir(n); }} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #F1EFE8", background: "#fff", padding: "8px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5 }}>
                  <b>{n}</b>{u?.estado === "pendiente" ? <span style={{ color: "#BA7517", fontSize: 11.5 }}> · por validar</span> : null}
                  {(u?.area || u?.cargo) && <span style={{ display: "block", fontSize: 12, color: "var(--texto-suave)" }}>{[u.area, u.cargo].filter(Boolean).join(" · ")}</span>}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
function FilaTabla({ f, i, cambiar, usuarios, quitar, nombreDato }) {
  return (
    <>
      <input className="rp-input" list="dl-areas-tabla" value={f.area} onChange={(e) => cambiar(i, { area: e.target.value })} placeholder="Ej. Mina" aria-label={`Área, fila ${i + 1}`} />
      <input className="rp-input" value={f.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} placeholder={nombreDato} aria-label={`${nombreDato}, fila ${i + 1}`} />
      <div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: f.lideres.length ? 5 : 0 }}>
          {f.lideres.map((l) => (
            <span key={l} className="ca-chip" style={{ fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center" }}>
              {l}
              <button type="button" aria-label={`Quitar a ${l}`} onClick={() => cambiar(i, { lideres: f.lideres.filter((x) => x !== l) })} style={{ border: 0, background: "none", cursor: "pointer", padding: 0, fontSize: 13, color: "var(--rojo, #993C1D)" }}>✕</button>
            </span>
          ))}
        </div>
        <BuscarLider usuarios={usuarios} elegidos={f.lideres} placeholder={f.lideres.length ? "+ Otro líder (busca en usuarios)" : "Líder: busca en el panel de usuarios"} aria={`Agregar líder, fila ${i + 1}`}
          onAgregar={(n) => cambiar(i, { lideres: [...f.lideres, n] })} />
      </div>
      <button type="button" aria-label={`Quitar fila ${i + 1}`} onClick={quitar} style={{ ...btn, padding: "6px 0", color: "var(--rojo, #993C1D)" }}>✕</button>
    </>
  );
}

function TarjetaListado({ l, usos, onGuardar, onEliminar }) {
  const [abierto, setAbierto] = useState(!l.opciones?.length);
  const [nombre, setNombre] = useState(l.nombre);
  const [texto, setTexto] = useState(lineasDeListado(l).join("\n"));
  const [tabla, setTabla] = useState(!!l.tabla);
  const [filas, setFilas] = useState(() => filasDeListado(l).map(({ area, nombre, lideres }) => ({ area, nombre, lideres })));
  const [trabajando, setTrabajando] = useState(false);
  // Lo que se guardaría, según el modo (texto o tabla).
  const calc = (() => {
    if (!tabla) { const p = parsearLineasListado(texto); return { opciones: p.opciones, subareas: p.subareas, lideres: Object.fromEntries(Object.entries(l.lideres || {}).filter(([o]) => p.opciones.includes(o))) }; }
    const opciones = [], subareas = {}, lideres = {};
    filas.forEach((f) => {
      if (!f.nombre.trim()) return;
      const o = unirAreaNombre(f.area, f.nombre);
      if (opciones.includes(o)) return;
      opciones.push(o);
      if (f.area.trim()) subareas[o] = f.area.trim();
      if (f.lideres.length) lideres[o] = f.lideres;
    });
    return { opciones, subareas, lideres };
  })();
  const { opciones, subareas, lideres } = calc;
  const cambiado = nombre.trim() !== l.nombre || tabla !== !!l.tabla || lineasDeListado({ opciones, subareas }).join("\n") !== lineasDeListado(l).join("\n") || JSON.stringify(lideres) !== JSON.stringify(l.lideres || {});
  const nSub = new Set(Object.values(subareas)).size;
  function pasarATabla() {
    const p = parsearLineasListado(texto);
    setFilas(filasDeListado({ opciones: p.opciones, subareas: p.subareas, lideres: l.lideres || {} }).map(({ area, nombre, lideres }) => ({ area, nombre, lideres })));
    setTabla(true);
  }
  function pasarATexto() {
    setTexto(lineasDeListado({ opciones, subareas }).join("\n"));
    setTabla(false);
  }
  async function guardar() {
    if (!nombre.trim()) return window.alert("El listado necesita un nombre.");
    setTrabajando(true);
    try {
      await onGuardar({ ...l, nombre: nombre.trim(), opciones, subareas, lideres, tabla });
    } finally {
      setTrabajando(false);
    }
  }
  return (
    <div className="ca-card" style={{ marginBottom: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button style={{ ...btn, border: "none", padding: "2px 6px" }} onClick={() => setAbierto(!abierto)} aria-label={`${abierto ? "Cerrar" : "Abrir"} listado ${l.nombre}`}>{abierto ? "▾" : "▸"}</button>
        <input className="rp-input" style={{ maxWidth: 260, fontWeight: 700 }} value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label={`Nombre del listado ${l.nombre}`} placeholder="Nombre del listado" />
        <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>{opciones.length} opciones{nSub ? ` · ${nSub} ${tabla ? "área" : "sub área"}${nSub === 1 ? "" : "s"}` : ""}{tabla ? ` · ${Object.keys(lideres).length} con líder` : ""}</span>
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
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            {tabla ? <button type="button" style={btn} onClick={pasarATexto}>Ver como texto</button> : <button type="button" style={btnPrim} onClick={pasarATabla}>▦ Editar como tabla (Área · Nombre · Líderes)</button>}
            <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{tabla ? "Cada fila: un área, el nombre (ej. patio) y uno o varios líderes. En el formulario se filtra por área → nombre y el líder sale solo." : "En tabla puedes asignar el área y los líderes de cada opción."}</span>
          </div>
          {tabla ? <EditorTabla filas={filas} setFilas={setFilas} nombreDato={/patio/i.test(l.nombre) ? "Patio" : "Nombre"} /> : <textarea
            className="rp-textarea"
            rows={8}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label={`Opciones del listado ${l.nombre}`}
            placeholder={"Una opción por línea. Para darle sub área, agrégala después de una barra:\nEST-01 Bloqueo y etiquetado | Eléctrica\nEST-02 Trabajo en altura | Mecánica"}
          />}
          {!tabla && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>
            Una opción por línea; las repetidas y las líneas vacías se quitan solas. Sub área (opcional): después de « | », ej. «EST-01 Bloqueo | Eléctrica».
            En el Plan de evaluadores se puede asignar a cada evaluador una opción, una sub área completa o varias.
          </div>}
          {nSub > 0 && !tabla && (
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
  const estadoPortal = useEstadoPortalEO();
  const sincronizado = (listados || []).find((l) => l.sincronizado) || null;
  const lista = (listados || []).filter((l) => !l.sincronizado);
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
      <TarjetaSincronizada l={sincronizado} usos={usos[sincronizado?.id] || []} estado={estadoPortal} />
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
