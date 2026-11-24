import { useState } from "react";
import { subareasDe, opcionesDelAlcance } from "./listados.js";

// Alcance de un evaluador en un formulario asignado por listado: una opción específica, una o varias sub áreas,
// o varias opciones. Al evaluar, la persona elige dentro de su alcance.

const compacto = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const chip = { display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 14, padding: "3px 10px", fontSize: 12.5, fontWeight: 600 };
const quitar = { border: "none", background: "none", cursor: "pointer", padding: 0, fontSize: 12, color: "inherit" };
const fila = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", textAlign: "left", border: "none", borderTop: "1px solid #fff", padding: "7px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5 };

export default function AlcanceEvaluador({ etiqueta, datos, alcance, onCambiar, nombre }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [lista, setLista] = useState(false);
  const a = { opciones: alcance?.opciones || [], subareas: alcance?.subareas || [] };
  const subareas = subareasDe(datos);
  const cubre = opcionesDelAlcance(a, datos);
  const vacio = !a.opciones.length && !a.subareas.length;
  const partes = texto.split(/\s+/).map(compacto).filter(Boolean);
  const coincide = (t) => partes.every((p) => compacto(t).includes(p));
  const subEncontradas = texto.trim() ? subareas.filter((s) => coincide(s) && !a.subareas.includes(s)) : subareas.filter((s) => !a.subareas.includes(s));
  const opEncontradas = texto.trim() ? (datos?.opciones || []).filter((o) => coincide(`${o} ${datos?.subareas?.[o] || ""}`) && !a.opciones.includes(o)).slice(0, 8) : [];
  const poner = (cambio) => {
    onCambiar({ ...a, ...cambio });
    setTexto("");
  };
  // El alcance se guarda por patio (opción): una sub área completa se expande a sus opciones.
  const ponerOpciones = (lista) => { onCambiar({ opciones: [...new Set(lista)], subareas: [] }); setTexto(""); };
  const todas = datos?.opciones || [];
  const grupos = {};
  todas.forEach((o) => (grupos[datos?.subareas?.[o] || "Sin sub área"] = grupos[datos?.subareas?.[o] || "Sin sub área"] || []).push(o));
  const nombresGrupos = Object.keys(grupos).sort((x, y) => x.localeCompare(y, "es"));
  const marcada = (o) => cubre.includes(o);
  const alternar = (o) => ponerOpciones(marcada(o) ? cubre.filter((x) => x !== o) : [...cubre, o]);
  const alternarGrupo = (g) => { const ops = grupos[g]; const todasMarcadas = ops.every(marcada); ponerOpciones(todasMarcadas ? cubre.filter((x) => !ops.includes(x)) : [...cubre, ...ops]); };

  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--texto-suave)", marginBottom: 3 }}>
        {etiqueta} que le tocan *
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {(vacio ? [] : cubre).map((o) => (
          <span key={"o" + o} style={{ ...chip, background: "#E1F5EE", color: "#0F3D33", border: "1px solid #9fd8c6" }}>
            {o}
            <button style={quitar} aria-label={`Quitar ${o}`} onClick={() => ponerOpciones(cubre.filter((x) => x !== o))}>✕</button>
          </span>
        ))}
        {vacio && <span style={{ fontSize: 12.5, color: "var(--rojo)" }}>Elige al menos una opción o sub área.</span>}
      </div>
      <div style={{ marginBottom: 6 }}>
        <button type="button" style={ border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--texto)", cursor: "pointer" } onClick={() => setLista((v) => !v)}>{lista ? "▲ Ocultar listado" : `☑ Elegir del listado (${cubre.length}/${todas.length})`}</button>
        {!vacio && <button type="button" style={{ ...{ border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--texto)", cursor: "pointer" }, marginLeft: 6 }} onClick={() => ponerOpciones([])}>Quitar todos</button>}
      </div>
      {lista && (
        <div style={{ maxWidth: 520, maxHeight: 320, overflowY: "auto", border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", marginBottom: 6 }}>
          {nombresGrupos.map((g) => (
            <div key={g}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#F1EFE8", fontWeight: 800, fontSize: 12.5, cursor: "pointer", position: "sticky", top: 0 }}>
                <input type="checkbox" checked={grupos[g].every(marcada)} onChange={() => alternarGrupo(g)} /> {g} <span style={{ fontWeight: 500, opacity: 0.7 }}>({grupos[g].filter(marcada).length}/{grupos[g].length})</span>
              </label>
              {grupos[g].map((o) => (
                <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px 5px 26px", fontSize: 13.5, cursor: "pointer", borderTop: "1px solid #F1EFE8" }}>
                  <input type="checkbox" checked={marcada(o)} onChange={() => alternar(o)} /> {o}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
      <input
        className="rp-input"
        style={{ maxWidth: 420 }}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={subareas.length ? "Busca una opción o sub área…" : "Busca una opción…"}
        aria-label={`Alcance de ${nombre}`}
        autoComplete="off"
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
      />
      {(abierto || texto.trim()) && (texto.trim() || subareas.length > 0) && (subEncontradas.length > 0 || opEncontradas.length > 0 || texto.trim()) && (
        <div style={{ maxWidth: 420, border: "1px solid #D3D1C7", borderRadius: 8, marginTop: 4, overflow: "hidden", background: "#fff" }}>
          {subEncontradas.map((s) => (
            <button key={"s" + s} style={{ ...fila, background: "#0F6E56", color: "#fff" }} onClick={() => ponerOpciones([...cubre, ...grupos[s]])}>
              <span>Sub área completa: <b>{s}</b></span>
              <span style={{ fontSize: 12 }}>{(datos?.opciones || []).filter((o) => datos?.subareas?.[o] === s).length} opciones</span>
            </button>
          ))}
          {opEncontradas.map((o) => (
            <button key={"o" + o} style={{ ...fila, background: "#E1F5EE", color: "#0F3D33", borderLeft: "4px solid #0F6E56" }} onClick={() => ponerOpciones([...cubre, o])}>
              <b>{o}</b>
              {datos?.subareas?.[o] && <span style={{ fontSize: 12, opacity: 0.8 }}>{datos.subareas[o]}</span>}
            </button>
          ))}
          {texto.trim() && subEncontradas.length + opEncontradas.length === 0 && <div style={{ padding: "7px 10px", fontSize: 13, color: "var(--texto-suave)" }}>Nada coincide con "{texto.trim()}".</div>}
        </div>
      )}
      {!vacio && (
        <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 4 }}>
          Cubre {cubre.length} {cubre.length === 1 ? `opción: siempre le toca ${cubre[0]}` : "opciones (patios): cada periodo le toca una al azar (rota hasta pasar por todas)"}.
        </div>
      )}
    </div>
  );
}
