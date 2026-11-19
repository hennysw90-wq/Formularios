import { useState } from "react";
import { cerrarCompromiso, reabrirCompromiso, rechazarCompromiso, estaCerrado, MOTIVOS_RECHAZO } from "./compromisosLider.js";
import { fechaCdR } from "./estadisticas.js";
import { ETIQUETA_CLASIFICACION } from "./calculo.js";
import { referenciaEval, valorAsignado } from "./referencia.js";

const ddmm = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("-") : "—");
const PILL = { pendiente: "ca-pill-ambar", vencido: "ca-pill-rojo", ejecutado: "ca-pill-verde", rechazado: "" };
const TEXTO = { pendiente: "Pendiente", vencido: "Vencido", ejecutado: "Ejecutado", rechazado: "Rechazado" };
const PILL_RES = { efectiva: "ca-pill-verde", desarrollo: "ca-pill-ambar", intervencion: "ca-pill-rojo" };
const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Un compromiso de mejora, con su comentario y el botón para marcarlo como ejecutado (o reabrirlo). */
export function TarjetaCompromiso({ c, usuario, soloLectura = false, mostrarLider = false }) {
  const [comentario, setComentario] = useState(c.cierre?.comentario || "");
  const [trabajando, setTrabajando] = useState("");
  const [error, setError] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const ej = estaCerrado(c);
  async function hacer(tipo) {
    setError("");
    // Para marcarlo ejecutado o rechazarlo hay que dejar un comentario.
    if ((tipo === "cerrar" || tipo === "rechazar") && !comentario.trim()) {
      setError(tipo === "cerrar" ? "Escribe un comentario: qué hiciste para cumplirlo." : "Escribe un comentario explicando el rechazo.");
      return;
    }
    setTrabajando(tipo);
    try {
      if (tipo === "cerrar") await cerrarCompromiso(c.ev, usuario, comentario);
      else if (tipo === "rechazar") { await rechazarCompromiso(c.ev, usuario, motivo, comentario); setRechazando(false); }
      else await reabrirCompromiso(c.ev, usuario);
    } catch (e) {
      setError(e.code === "permission-denied" ? "La base no permite guardar compromisos: revisa las reglas de Firestore." : `No se pudo guardar (${e.code || e.message}).`);
    } finally {
      setTrabajando("");
    }
  }
  return (
    <div className="ca-card" style={{ marginBottom: 10, padding: 14, borderLeft: `4px solid ${c.estado === "ejecutado" ? "#0f6e56" : c.estado === "rechazado" ? "#8992a0" : c.estado === "vencido" ? "#993c1d" : "#ba7517"}` }}>
      <div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{c.accion}</div>
          <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginTop: 3 }}>
            {c.ev.formulario?.nombre || "Formulario"} · {valorAsignado(c.ev) ? <b>{valorAsignado(c.ev)}</b> : c.ev.rutinaNombre || "Sin reunión"} · {String(c.ev.formulario?.sigla || "").trim() || (String(c.ev.formulario?.nombre || "").match(/^(C[a-z][A-Z])\b/) || [])[1] || "CdR"} del {ddmm(fechaCdR(c.ev))}
            {c.responsable ? ` · Responsable: ${c.responsable}` : ""}
          </div>
          {/* Quién hizo la evaluación donde se acordó el compromiso. */}
          {c.ev.evaluadorNombre && <div style={{ fontSize: 12.5, marginTop: 2 }}>Evaluó: <b>{c.ev.evaluadorNombre}</b></div>}
          {mostrarLider && <div style={{ fontSize: 12.5, marginTop: 2 }}>{String(c.ev.formulario?.receptor || "").trim() || "Líder"}: <b>{c.ev.lider || "—"}</b>{c.cierre?.cerradoPorNombre && c.cierre.cerradoPorNombre !== c.ev.lider ? ` · cerrado por ${c.cierre.cerradoPorNombre}` : ""}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <span className={`ca-pill ${PILL[c.estado]}`}>{TEXTO[c.estado]}</span>
          <span style={{ fontSize: 12, color: c.estado === "vencido" ? "#993c1d" : "var(--texto-suave)", fontWeight: 600 }}>Plazo: {ddmm(c.fecha)}</span>
        </div>
      </div>
      {ej ? (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          {c.estado === "rechazado"
            ? <span style={{ color: "#5b6472", fontWeight: 700, display: "block" }}>✕ Rechazado el {ddmm(c.cierre.cerradoFecha)} · {MOTIVOS_RECHAZO[c.cierre.motivoRechazo] || "Sin motivo"}</span>
            : <span style={{ color: "#0f6e56", fontWeight: 700, display: "block" }}>✓ Ejecutado el {ddmm(c.cierre.cerradoFecha)}</span>}
          {c.cierre.comentario && <div style={{ marginTop: 4, background: "var(--fondo)", borderRadius: 8, padding: "6px 10px", whiteSpace: "pre-wrap" }}>{c.cierre.comentario}</div>}
          {!soloLectura && <button className="cdr-nav-btn" style={{ marginTop: 8 }} disabled={!!trabajando} onClick={() => hacer("reabrir")}>{trabajando === "reabrir" ? "Reabriendo…" : "Reabrir"}</button>}
        </div>
      ) : soloLectura ? (
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--texto-suave)" }}>
          El líder aún no lo cierra.
          {c.cierre?.comentario && <div style={{ marginTop: 4, background: "var(--fondo)", borderRadius: 8, padding: "6px 10px", whiteSpace: "pre-wrap", color: "var(--texto)" }}>Comentario del líder: {c.cierre.comentario}</div>}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <textarea className="rp-textarea" rows={2} value={comentario} aria-label="Comentario del compromiso" placeholder="Comentario (obligatorio): qué hiciste…" onChange={(e) => setComentario(e.target.value)} />
          {/* Dos opciones: el comentario se guarda junto con la que se elija. */}
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="cdr-nav-btn prim" style={{ flex: "1 1 0", minWidth: 0 }} disabled={!!trabajando} onClick={() => hacer("cerrar")}>{trabajando === "cerrar" ? "Guardando…" : "✓ Ejecutado"}</button>
            <button className={`cdr-nav-btn ${rechazando ? "prim" : ""}`} style={{ flex: "1 1 0", minWidth: 0, ...(rechazando ? { background: "var(--rojo)", borderColor: "var(--rojo)", color: "#fff" } : { color: "var(--rojo)" }) }} disabled={!!trabajando} onClick={() => { setRechazando(!rechazando); setMotivo(""); }}>✕ Rechazar</button>
          </div>
          {rechazando && (
            <div style={{ marginTop: 8, background: "var(--fondo)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>¿Por qué lo rechazas?</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(MOTIVOS_RECHAZO).map(([k, t]) => (
                  <button key={k} className={`cdr-nav-btn ${motivo === k ? "prim" : ""}`} onClick={() => setMotivo(k)}>{t}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button className="cdr-nav-btn" style={{ background: motivo ? "var(--rojo)" : undefined, color: motivo ? "#fff" : undefined, borderColor: motivo ? "var(--rojo)" : undefined }} disabled={!motivo || !!trabajando} onClick={() => hacer("rechazar")}>
                  {trabajando === "rechazar" ? "Guardando…" : "Confirmar rechazo"}
                </button>
                <button className="cdr-nav-btn" onClick={() => setRechazando(false)}>Cancelar</button>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--texto-suave)", marginTop: 4 }}>El comentario de arriba es obligatorio y se guarda junto con el rechazo.</div>
            </div>
          )}
        </div>
      )}
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

/**
 * Compromisos de mejora: "Recibidos" (los que acordaron conmigo, para comentarlos y cerrarlos), "Entregados"
 * (los que acordé yo como evaluador, solo para ver si el líder los cerró) y, para el Master, "Todos".
 */
export default function CompromisosMejora({ recibidos = [], entregados = [], todos = null, usuario, cargando, compacto = false }) {
  const [grupo, setGrupo] = useState(todos ? "todos" : "recibidos");
  const [filtro, setFiltro] = useState("abiertos");
  const [lider, setLider] = useState("");
  const [formSel, setFormSel] = useState(""); // separar por formulario ("" = todos)
  // Formularios que aparecen en los compromisos (con su nombre guardado en la evaluación).
  const formularios = (() => {
    const m = new Map();
    [...recibidos, ...entregados, ...(todos || [])].forEach((c) => c.ev.formularioId && !m.has(c.ev.formularioId) && m.set(c.ev.formularioId, c.ev.formulario?.nombre || "Formulario"));
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  })();
  const delForm = (l) => (formSel ? l.filter((c) => c.ev.formularioId === formSel) : l);
  const fRec = delForm(recibidos);
  const fEnt = delForm(entregados);
  const fTod = todos ? delForm(todos) : null;
  const base = grupo === "todos" ? fTod || [] : grupo === "entregados" ? fEnt : fRec;
  const formElegido = formularios.find((f) => f.id === formSel);
  const ejemplo = base[0]?.ev?.formulario;
  const rotulo = formElegido && String(ejemplo?.receptor || "").trim() ? String(ejemplo.receptor).trim() : "Líder";
  const lideres = grupo === "todos" ? [...new Set(base.map((c) => c.ev.lider).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")) : [];
  const delLider = lider && grupo === "todos" ? base.filter((c) => c.ev.lider === lider) : base;
  const n = (e) => delLider.filter((c) => c.estado === e).length;
  const vistos = filtro === "abiertos" ? delLider.filter((c) => !estaCerrado(c)) : filtro === "cerrados" ? delLider.filter(estaCerrado) : delLider;
  const grupos = [["recibidos", `Recibidos (${fRec.length})`], ["entregados", `Entregados (${fEnt.length})`], ...(fTod ? [["todos", `Todos (${fTod.length})`]] : [])];
  const textos = {
    recibidos: "Los que acordaron contigo en las evaluaciones que te hicieron. Cuando lo cumplas, márcalo como ejecutado y deja un comentario; si no corresponde, recházalo.",
    entregados: "Los que acordaste tú como evaluador con cada líder: aquí ves si ya los cerró y su comentario.",
    todos: "Todos los compromisos de todos los líderes. Como Master puedes comentarlos, cerrarlos, rechazarlos o reabrirlos (el Supervisor solo los ve).",
  };
  return (
    <div>
      <div className={compacto ? "" : "ca-card"} style={{ marginBottom: 14 }}>
        {!compacto && <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>Compromisos de mejora</p>}
        {formularios.length > 1 && (
          <div style={{ margin: compacto ? "0 0 10px" : "10px 0 4px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--texto-suave)", marginBottom: 6 }}>Formulario</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ id: "", nombre: "Todos los formularios" }, ...formularios].map((f) => {
                const act = formSel === f.id;
                return (
                  <button key={f.id || "todos"} type="button" onClick={() => { setFormSel(f.id); setLider(""); }}
                    style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, padding: "7px 12px", borderRadius: 10, border: act ? "2px solid var(--verde, #009899)" : "1px solid var(--borde, #D3D1C7)", background: act ? "var(--verde, #009899)" : "#fff", color: act ? "#fff" : "inherit" }}>
                    {f.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: compacto ? "0 0 8px" : "10px 0 8px" }}>
          {grupos.map(([v, t]) => (
            <button key={v} className={`cdr-nav-btn ${grupo === v ? "prim" : ""}`} onClick={() => { setGrupo(v); setLider(""); }}>{t}</button>
          ))}
        </div>
        <p style={{ margin: "0 0 10px", color: "var(--texto-suave)", fontSize: 13.5 }}>{textos[grupo]}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="ca-pill ca-pill-rojo">Vencidos: {n("vencido")}</span>
          <span className="ca-pill ca-pill-ambar">Pendientes: {n("pendiente")}</span>
          <span className="ca-pill ca-pill-verde">Ejecutados: {n("ejecutado")}</span>
          <span className="ca-pill">Rechazados: {n("rechazado")}</span>
          {grupo === "todos" && (
            <select className="rp-select" aria-label={`Filtrar por ${rotulo.toLowerCase()}`} style={{ maxWidth: 240, marginLeft: "auto" }} value={lider} onChange={(e) => setLider(e.target.value)}>
              <option value="">{rotulo === "Líder" ? "Todos los líderes" : `Todos (${rotulo})`}</option>
              {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {[["abiertos", "Por cerrar"], ["cerrados", "Cerrados"], ["todos", "Todos"]].map(([v, t]) => (
          <button key={v} className={`cdr-nav-btn ${filtro === v ? "prim" : ""}`} onClick={() => setFiltro(v)}>{t}</button>
        ))}
      </div>
      {cargando ? <p style={{ color: "var(--texto-suave)" }}>Cargando…</p>
        : vistos.length === 0 ? <div className="cdr-molde"><b>{filtro === "cerrados" ? "No hay compromisos cerrados" : "No hay compromisos por cerrar"}</b>{grupo === "entregados" ? "Aparecen cuando en una CdR que hiciste acuerdas un compromiso con el líder." : "Aparecen cuando en una CdR se acuerda un compromiso con el líder."}</div>
        : vistos.map((c) => <TarjetaCompromiso key={c.ev.id} c={c} usuario={usuario} soloLectura={grupo === "entregados" || (grupo === "todos" && usuario?.rol === "supervisor")} mostrarLider={grupo !== "recibidos"} />)}
    </div>
  );
}

/** Lista de las CdR que me han realizado (sin el nombre de quien evaluó). */
export function EvaluacionesRecibidas({ lista, onVer, limite }) {
  const [todas, setTodas] = useState(false);
  const vistas = todas || !limite ? lista : lista.slice(0, limite);
  if (!lista.length) return <p style={{ color: "var(--texto-suave)", fontSize: 13.5, margin: 0 }}>Todavía no te han realizado evaluaciones.</p>;
  return (
    <div>
      {vistas.map((e) => {
        const r = e.resultado || {};
        return (
          <button key={e.id} type="button" onClick={() => onVer(e)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "1px solid var(--borde)", borderRadius: 10, padding: "9px 12px", marginBottom: 6, background: "#fff", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.formulario?.nombre || "Formulario"} · {referenciaEval(e)}</div>
              <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{ddmm(fechaCdR(e))}{r.clasificacion ? ` · ${ETIQUETA_CLASIFICACION[r.clasificacion]}` : ""}</div>
            </div>
            <span className={`ca-pill ${PILL_RES[r.clasificacion] || ""}`}>{typeof r.indice === "number" ? `${fmt(r.indice)}%` : "—"}</span>
            <span style={{ color: "var(--texto-suave)" }}>›</span>
          </button>
        );
      })}
      {limite && lista.length > limite && (
        <button className="cdr-nav-btn" onClick={() => setTodas(!todas)}>{todas ? "Ver menos" : `Ver las ${lista.length}`}</button>
      )}
    </div>
  );
}
