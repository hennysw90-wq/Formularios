import { useMemo, useState } from "react";
import ResultadosQR, { HojaResumen, RANGOS, chip, gris, pct, inicioDelRango, textoRango, promedio, bloquesPromedio, agrupar } from "./ResultadosQR.jsx";
import { TarjetaCompromiso } from "./CompromisosMejora.jsx";
import { fechaCdR, claveRutina, norm } from "./estadisticas.js";
import { referenciaEval } from "./referencia.js";
import { armarCompromisosDe } from "./compromisosLider.js";

export const ESTADO_RESULTADOS_INICIAL = {
  sub: "",
  rec: { rango: "1m", formularioId: "", reunion: "" },
  emi: { rango: "1m", formularioId: "", reunion: "" },
  resumen: { rango: "3m" },
  general: { rango: "3m", persona: "", clave: "" },
};

/**
 * Pestaña "Resultados".
 *  · Todos: Resumen · Evaluaciones recibidas · Evaluaciones emitidas (solo donde figura su nombre).
 *  · Master y Revisor: además "Resumen general": cualquier persona, sin filtrar por usuario.
 */
export default function Resultados({ usuario, enviadas, cierres, estado, onEstado, onVer, veTodo }) {
  const subs = [...(veTodo ? [["general", "Resumen general"]] : []), ["resumen", "Resumen"], ["rec", "Evaluaciones recibidas"], ["emi", "Evaluaciones emitidas"]];
  const sub = subs.some(([id]) => id === estado.sub) ? estado.sub : subs[0][0];
  const persona = { uid: usuario.uid, nombreUsuario: usuario.nombreUsuario };
  const poner = (clave) => (v) => onEstado({ ...estado, [clave]: typeof v === "function" ? v(estado[clave]) : v });

  return (
    <div className="ca-card">
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {subs.map(([id, t]) => (
          <button key={id} type="button" style={chip(sub === id)} onClick={() => onEstado({ ...estado, sub: id })}>{t}</button>
        ))}
      </div>
      {enviadas === null ? (
        <p style={{ color: "var(--texto-suave)" }}>Cargando…</p>
      ) : sub === "general" ? (
        <ResumenGeneral evals={enviadas} cierres={cierres} usuario={usuario} vista={estado.general} onVista={poner("general")} onVer={onVer} />
      ) : sub === "resumen" ? (
        <MiResumen usuario={usuario} evals={enviadas} cierres={cierres} vista={estado.resumen} onVista={poner("resumen")} />
      ) : sub === "emi" ? (
        <>
          <Intro titulo="Evaluaciones emitidas" texto="Las evaluaciones que tú hiciste como evaluador: elige el periodo, el formulario y la reunión o el estándar." />
          <ResultadosQR persona={persona} evals={enviadas} vista={estado.emi} onVista={poner("emi")} onVer={onVer} modo="realizadas" />
        </>
      ) : (
        <>
          <Intro titulo="Evaluaciones recibidas" texto="Las evaluaciones que te han realizado (igual que al revisarlas desde el QR): elige el periodo, el formulario y la reunión o el estándar para ver tu hoja resumen." />
          <ResultadosQR persona={persona} evals={enviadas} vista={estado.rec} onVista={poner("rec")} onVer={onVer} />
        </>
      )}
    </div>
  );
}

const Intro = ({ titulo, texto }) => (
  <>
    <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 18 }}>{titulo}</p>
    <p style={{ margin: "0 0 12px", color: "var(--texto-suave)", fontSize: 14 }}>{texto}</p>
  </>
);

const ES_VALIDA = (e) => e.estado === "enviada" && !e.anulada;

/* ─── Resumen personal: solo donde sale su nombre ─────────────────────── */

function MiResumen({ usuario, evals, cierres, vista, onVista }) {
  const yo = norm(usuario.nombreUsuario);
  const desde = inicioDelRango(vista.rango);
  const { recibidas, emitidas } = useMemo(() => {
    const validas = (evals || []).filter(ES_VALIDA);
    return {
      recibidas: validas.filter((e) => norm(e.lider) === yo && fechaCdR(e) >= desde),
      emitidas: validas.filter((e) => (e.registradoPorUid || e.evaluadorUid) === usuario.uid || e.evaluadorUid === usuario.uid || norm(e.evaluadorNombre) === yo).filter((e) => fechaCdR(e) >= desde),
    };
  }, [evals, yo, usuario.uid, desde]);
  const abiertos = useMemo(() => armarCompromisosDe(recibidas, cierres).filter((c) => c.estado === "pendiente" || c.estado === "vencido").length, [recibidas, cierres]);
  const porForm = useMemo(() => agrupar(recibidas, (e) => e.formularioId, (e) => e.formulario?.nombre || "Formulario"), [recibidas]);

  return (
    <div>
      <Intro titulo="Resumen" texto="Tu situación en el periodo elegido: lo que te evaluaron y lo que tú evaluaste." />
      <Rangos rango={vista.rango} onRango={(rango) => onVista({ ...vista, rango })} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, margin: "12px 0" }}>
        <Kpi titulo="Recibidas" valor={recibidas.length} />
        <Kpi titulo="Índice promedio" valor={pct(promedio(recibidas))} />
        <Kpi titulo="Emitidas" valor={emitidas.length} />
        <Kpi titulo="Compromisos abiertos" valor={abiertos} />
      </div>
      {porForm.length === 0 ? (
        <p style={{ ...gris, fontSize: 14 }}>Nadie te evaluó en este periodo ({textoRango(vista.rango)}).</p>
      ) : (
        porForm.map((g) => <DimensionesDe key={g.clave} titulo={g.nombre} lista={g.items} />)
      )}
    </div>
  );
}

/* ─── Resumen general: cualquier persona (Master / Revisor) ────────── */

function ResumenGeneral({ evals, cierres, usuario, vista, onVista, onVer }) {
  const [texto, setTexto] = useState(vista.persona || ""); // al volver de ver una evaluación, el buscador sigue con la persona elegida
  const validas = useMemo(() => (evals || []).filter(ES_VALIDA), [evals]);
  const personas = useMemo(() => {
    const m = new Map();
    validas.forEach((e) => {
      const n = String(e.lider || "").trim();
      if (n && !m.has(norm(n))) m.set(norm(n), n);
    });
    return [...m.values()].sort((a, b) => a.localeCompare(b, "es"));
  }, [validas]);
  const q = norm(texto);
  const sugerencias = q.length >= 1 && norm(vista.persona) !== q ? personas.filter((n) => norm(n).includes(q)).slice(0, 8) : [];

  const desde = inicioDelRango(vista.rango);
  const deLaPersona = useMemo(() => validas.filter((e) => vista.persona && norm(e.lider) === norm(vista.persona)), [validas, vista.persona]);
  // Combinaciones formulario · reunión que alguna vez tuvo esta persona.
  const opciones = useMemo(() => {
    const m = new Map();
    deLaPersona.forEach((e) => {
      const k = `${e.formularioId}|${claveRutina(e)}`;
      const g = m.get(k) || { clave: k, nombre: `${e.formulario?.nombre || "Formulario"} · ${referenciaEval(e, "—")}`, n: 0 };
      g.n += fechaCdR(e) >= desde ? 1 : 0;
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [deLaPersona, desde]);
  const clave = opciones.some((o) => o.clave === vista.clave) ? vista.clave : opciones[0]?.clave || "";
  const [formId, reunion] = clave.split("|");
  const historico = deLaPersona.filter((e) => e.formularioId === formId && claveRutina(e) === reunion);
  const lista = historico.filter((e) => fechaCdR(e) >= desde);

  function elegir(nombre) {
    setTexto(nombre);
    onVista({ ...vista, persona: nombre, clave: "" });
  }

  return (
    <div>
      <Intro titulo="Resumen general" texto="Busca a una persona y elige el formulario y la reunión: verás sus resultados por dimensión, el feedback que recibió y sus acciones de mejora con su respuesta." />
      <div style={{ position: "relative", maxWidth: 420, marginBottom: 10 }}>
        <input className="rp-input" placeholder="Buscar persona (líder evaluado)…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar persona" />
        {sugerencias.length > 0 && (
          <div style={{ position: "absolute", zIndex: 5, left: 0, right: 0, top: "100%", background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,.12)", marginTop: 2, overflow: "hidden" }}>
            {sugerencias.map((n) => (
              <button key={n} type="button" onClick={() => elegir(n)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid var(--borde)", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>{n}</button>
            ))}
          </div>
        )}
      </div>

      {!vista.persona ? (
        <p style={{ ...gris, fontSize: 14 }}>Escribe un nombre y elígelo de la lista.</p>
      ) : (
        <>
          <p style={{ fontWeight: 800, fontSize: 16, margin: "0 0 8px" }}>{vista.persona}</p>
          {opciones.length === 0 ? (
            <p style={{ ...gris, fontSize: 14 }}>Esta persona no tiene evaluaciones enviadas como líder.</p>
          ) : (
            <>
              <select className="rp-select" style={{ maxWidth: 520, marginBottom: 8 }} value={clave} onChange={(e) => onVista({ ...vista, clave: e.target.value })} aria-label="Formulario y reunión">
                {opciones.map((o) => <option key={o.clave} value={o.clave}>{o.nombre} ({o.n} en el periodo)</option>)}
              </select>
              <Rangos rango={vista.rango} onRango={(rango) => onVista({ ...vista, rango })} />
              <div style={{ marginTop: 12 }}>
                <HojaResumen lista={lista} historico={historico} rango={vista.rango} nombreForm={historico[0]?.formulario?.nombre || ""} nombreReunion={referenciaEval(lista[0] || historico[0] || {}, "")} onVer={onVer} conLider />
              </div>
              <FeedbackYAcciones lista={lista} cierres={cierres} usuario={usuario} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Todo el feedback y las acciones de mejora de esas evaluaciones: quién lo emitió, el responsable y su respuesta. */
function FeedbackYAcciones({ lista, cierres, usuario }) {
  const compromisos = useMemo(() => armarCompromisosDe(lista, cierres), [lista, cierres]);
  const porEval = new Map(compromisos.map((c) => [c.ev.id, c]));
  const ddmm = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("-") : "—");
  const hay = lista.some((e) => (e.feedback?.fortalezas || []).length || (e.feedback?.oportunidades || []).length || porEval.has(e.id));
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 8px" }}>Feedback y acciones de mejora ({lista.length})</p>
      {!hay && <p style={{ ...gris, fontSize: 14 }}>No hay feedback ni acciones de mejora en este periodo.</p>}
      {lista.map((e) => {
        const fb = e.feedback || {};
        const items = [...(fb.fortalezas || []).map((x) => ["Fortaleza", x]), ...(fb.oportunidades || []).map((x) => ["Oportunidad de mejora", x])];
        const c = porEval.get(e.id);
        if (!items.length && !c) return null;
        return (
          <div key={e.id} style={{ border: "1px solid var(--borde)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, background: "#fff" }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{ddmm(fechaCdR(e))} · Emitió: {e.evaluadorNombre || e.registradoPorNombre || "—"}</div>
            <div style={{ ...gris, fontSize: 12.5, marginBottom: 6 }}>Líder: {e.lider || "—"}</div>
            {items.map(([tipo, x], i) => (
              <div key={x.id || i} style={{ fontSize: 13, margin: "6px 0", paddingLeft: 8, borderLeft: `3px solid ${tipo === "Fortaleza" ? "#1b7a46" : "#B5820A"}` }}>
                <b>{tipo}{x.criterio ? ` · ${x.criterio}` : ""}</b>
                {x.situacion && <div><b>Situación:</b> {x.situacion}</div>}
                {x.comportamiento && <div><b>Comportamiento:</b> {x.comportamiento}</div>}
                {x.impacto && <div><b>Impacto:</b> {x.impacto}</div>}
              </div>
            ))}
            {fb.seguimiento && (
              <div style={{ fontSize: 13, margin: "6px 0" }}>
                <b>Seguimiento del compromiso anterior:</b> {{ cumplido: "Cumplido", parcial: "Parcial", no: "No cumplido" }[fb.seguimiento] || fb.seguimiento}
                {fb.seguimientoComentario ? ` — ${fb.seguimientoComentario}` : ""}
              </div>
            )}
            {c && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Acción de mejora · Responsable: {c.responsable || "—"}</div>
                <TarjetaCompromiso c={c} usuario={usuario} soloLectura mostrarLider />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Piezas ──────────────────────────────────────────────────────────── */

function Rangos({ rango, onRango }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {RANGOS.map(([v, t]) => <button key={v} type="button" style={chip(rango === v)} onClick={() => onRango(v)}>{t}</button>)}
    </div>
  );
}

function Kpi({ titulo, valor }) {
  return (
    <div style={{ border: "1px solid var(--borde)", borderRadius: 12, padding: "10px 12px", background: "#fff" }}>
      <div style={{ ...gris, fontSize: 12 }}>{titulo}</div>
      <div style={{ fontWeight: 800, fontSize: 24 }}>{valor}</div>
    </div>
  );
}

function DimensionesDe({ titulo, lista }) {
  const { filas } = bloquesPromedio(lista);
  return (
    <div style={{ border: "1px solid var(--borde)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: 14 }}>{titulo}</b>
        <span style={{ fontSize: 13 }}>{lista.length} · {pct(promedio(lista))}</span>
      </div>
      {filas.map((f) => (
        <div key={f.nombre} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, margin: "4px 0" }}>
          <span style={{ flex: "0 0 40%", minWidth: 0 }}>{f.nombre}</span>
          <span style={{ flex: 1, height: 8, background: "var(--fondo)", borderRadius: 4, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(100, f.puntaje ?? 0))}%`, background: "var(--verde)" }} />
          </span>
          <span style={{ width: 44, textAlign: "right" }}>{pct(f.puntaje)}</span>
        </div>
      ))}
    </div>
  );
}
