import { useState } from "react";
import { cerrarCompromiso, comentarCompromiso, reabrirCompromiso } from "./compromisosLider.js";
import { fechaCdR } from "./estadisticas.js";
import { ETIQUETA_CLASIFICACION } from "./calculo.js";

const ddmm = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("-") : "—");
const PILL = { pendiente: "ca-pill-ambar", vencido: "ca-pill-rojo", ejecutado: "ca-pill-verde" };
const TEXTO = { pendiente: "Pendiente", vencido: "Vencido", ejecutado: "Ejecutado" };
const PILL_RES = { efectiva: "ca-pill-verde", desarrollo: "ca-pill-ambar", intervencion: "ca-pill-rojo" };
const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Un compromiso de mejora, con su comentario y el botón para marcarlo como ejecutado (o reabrirlo). */
export function TarjetaCompromiso({ c, usuario }) {
  const [comentario, setComentario] = useState(c.cierre?.comentario || "");
  const [trabajando, setTrabajando] = useState("");
  const [error, setError] = useState("");
  const ej = c.estado === "ejecutado";
  async function hacer(tipo) {
    setTrabajando(tipo);
    setError("");
    try {
      if (tipo === "cerrar") await cerrarCompromiso(c.ev, usuario, comentario);
      else if (tipo === "comentar") await comentarCompromiso(c.ev, usuario, comentario);
      else await reabrirCompromiso(c.ev, usuario);
    } catch (e) {
      setError(e.code === "permission-denied" ? "La base no permite guardar compromisos: revisa las reglas de Firestore." : `No se pudo guardar (${e.code || e.message}).`);
    } finally {
      setTrabajando("");
    }
  }
  const cambio = comentario.trim() !== (c.cierre?.comentario || "").trim();
  return (
    <div className="ca-card" style={{ marginBottom: 10, padding: 14, borderLeft: `4px solid ${ej ? "#0f6e56" : c.estado === "vencido" ? "#993c1d" : "#ba7517"}` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{c.accion}</div>
          <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginTop: 3 }}>
            {c.ev.formulario?.nombre || "Formulario"} · {c.ev.rutinaNombre || "Sin reunión"} · CdR del {ddmm(fechaCdR(c.ev))}
            {c.responsable ? ` · Responsable: ${c.responsable}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className={`ca-pill ${PILL[c.estado]}`}>{TEXTO[c.estado]}</span>
          <span style={{ fontSize: 12, color: c.estado === "vencido" ? "#993c1d" : "var(--texto-suave)", fontWeight: 600 }}>Plazo: {ddmm(c.fecha)}</span>
        </div>
      </div>
      {ej ? (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <span style={{ color: "#0f6e56", fontWeight: 700 }}>✓ Ejecutado el {ddmm(c.cierre.cerradoFecha)}</span>
          {c.cierre.comentario && <div style={{ marginTop: 4, background: "var(--fondo)", borderRadius: 8, padding: "6px 10px", whiteSpace: "pre-wrap" }}>{c.cierre.comentario}</div>}
          <button className="cdr-nav-btn" style={{ marginTop: 8 }} disabled={!!trabajando} onClick={() => hacer("reabrir")}>{trabajando === "reabrir" ? "Reabriendo…" : "Reabrir"}</button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <textarea className="rp-textarea" rows={2} value={comentario} aria-label="Comentario del compromiso" placeholder="Comentario: qué hiciste o cómo vas…" onChange={(e) => setComentario(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <button className="cdr-nav-btn prim" disabled={!!trabajando} onClick={() => hacer("cerrar")}>{trabajando === "cerrar" ? "Guardando…" : "✓ Marcar como ejecutado"}</button>
            <button className="cdr-nav-btn" disabled={!!trabajando || !cambio || !comentario.trim()} onClick={() => hacer("comentar")}>{trabajando === "comentar" ? "Guardando…" : "Guardar comentario"}</button>
          </div>
          {c.cierre?.comentadoFecha && !cambio && <div style={{ fontSize: 11.5, color: "var(--texto-suave)", marginTop: 4 }}>Comentario guardado el {ddmm(c.cierre.comentadoFecha)}</div>}
        </div>
      )}
      {error && <p style={{ color: "var(--rojo)", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

/** Pestaña exclusiva: todos los compromisos de mejora que recibí, para comentarlos y cerrarlos. */
export default function CompromisosMejora({ compromisos, usuario, cargando }) {
  const [filtro, setFiltro] = useState("abiertos");
  const n = (e) => compromisos.filter((c) => c.estado === e).length;
  const vistos = filtro === "abiertos" ? compromisos.filter((c) => c.estado !== "ejecutado") : filtro === "ejecutados" ? compromisos.filter((c) => c.estado === "ejecutado") : compromisos;
  return (
    <div>
      <div className="ca-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>Compromisos de mejora</p>
        <p style={{ margin: "6px 0 10px", color: "var(--texto-suave)", fontSize: 14 }}>
          Los compromisos que acordaron contigo en las CdR que te hicieron. Cuando lo cumplas, márcalo como ejecutado y deja un comentario.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="ca-pill ca-pill-rojo">Vencidos: {n("vencido")}</span>
          <span className="ca-pill ca-pill-ambar">Pendientes: {n("pendiente")}</span>
          <span className="ca-pill ca-pill-verde">Ejecutados: {n("ejecutado")}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {[["abiertos", "Por cerrar"], ["ejecutados", "Ejecutados"], ["todos", "Todos"]].map(([v, t]) => (
          <button key={v} className={`cdr-nav-btn ${filtro === v ? "prim" : ""}`} onClick={() => setFiltro(v)}>{t}</button>
        ))}
      </div>
      {cargando ? <p style={{ color: "var(--texto-suave)" }}>Cargando…</p>
        : vistos.length === 0 ? <div className="cdr-molde"><b>{filtro === "ejecutados" ? "Aún no cierras compromisos" : "No tienes compromisos de mejora por cerrar"}</b>Aparecen cuando en una CdR que te hicieron se acuerda un compromiso contigo.</div>
        : vistos.map((c) => <TarjetaCompromiso key={c.ev.id} c={c} usuario={usuario} />)}
    </div>
  );
}

/** Lista de las CdR que me han realizado (sin el nombre de quien evaluó). */
export function EvaluacionesRecibidas({ lista, onVer, limite }) {
  const [todas, setTodas] = useState(false);
  const vistas = todas || !limite ? lista : lista.slice(0, limite);
  if (!lista.length) return <p style={{ color: "var(--texto-suave)", fontSize: 13.5, margin: 0 }}>Todavía no te han realizado CdR.</p>;
  return (
    <div>
      {vistas.map((e) => {
        const r = e.resultado || {};
        return (
          <button key={e.id} type="button" onClick={() => onVer(e)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "1px solid var(--borde)", borderRadius: 10, padding: "9px 12px", marginBottom: 6, background: "#fff", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.formulario?.nombre || "Formulario"} · {e.rutinaNombre || "Sin reunión"}</div>
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
