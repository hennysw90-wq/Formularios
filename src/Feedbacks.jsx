import { useMemo, useState } from "react";
import { fechaCdR, claveRutina, norm } from "./estadisticas.js";
import { referenciaEval, conFeedbackReunion, TITULO_FEEDBACK_REUNION } from "./referencia.js";
import { gris, pct } from "./ResultadosQR.jsx";

const ddmm = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("-") : "—");

/**
 * Hoja «Feedbacks»: el feedback de cada sesión, por líder y por reunión, del más reciente al más antiguo.
 * Master y Revisor ven el de todos; un líder ve solo el que recibió él.
 */
export default function Feedbacks({ usuario, enviadas, veTodo, onVer, revisables = null }) {
  const [texto, setTexto] = useState("");
  const yo = norm(usuario.nombreUsuario);
  const permitidas = useMemo(() => (revisables ? new Set(revisables) : null), [revisables]);
  const lista = useMemo(
    () =>
      (enviadas || [])
        .filter((e) => e.estado === "enviada" && !e.anulada)
        .filter((e) => (veTodo && (!permitidas || permitidas.has(e))) || norm(e.lider) === yo)
        .filter((e) => (e.feedback?.reunion || "").trim() || (e.feedback?.fortalezas || []).length || (e.feedback?.oportunidades || []).length),
    [enviadas, permitidas, veTodo, yo]
  );
  const q = norm(texto);
  // Líder → reunión → evaluaciones (más reciente primero en los tres niveles).
  const grupos = useMemo(() => {
    const filtradas = lista.filter((e) => !q || norm(`${e.lider} ${referenciaEval(e, "")} ${e.evaluadorNombre} ${e.feedback?.reunion || ""}`).includes(q));
    const porLider = new Map();
    filtradas.forEach((e) => {
      const l = String(e.lider || "").trim() || "Sin líder";
      const g = porLider.get(norm(l)) || { lider: l, reuniones: new Map() };
      const k = claveRutina(e) || "—";
      const r = g.reuniones.get(k) || { nombre: referenciaEval(e, "Sin reunión"), formulario: e.formulario?.nombre || "", items: [] };
      r.items.push(e);
      g.reuniones.set(k, r);
      porLider.set(norm(l), g);
    });
    const ultima = (items) => items.reduce((m, e) => (fechaCdR(e) > m ? fechaCdR(e) : m), "");
    return [...porLider.values()]
      .map((g) => {
        const reuniones = [...g.reuniones.values()]
          .map((r) => ({ ...r, items: r.items.sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a))), ultima: ultima(r.items) }))
          .sort((a, b) => b.ultima.localeCompare(a.ultima));
        return { lider: g.lider, reuniones, ultima: reuniones[0]?.ultima || "", total: reuniones.reduce((n, r) => n + r.items.length, 0) };
      })
      .sort((a, b) => b.ultima.localeCompare(a.ultima));
  }, [lista, q]);

  return (
    <div className="ca-card">
      <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 18 }}>Feedbacks</p>
      <p style={{ margin: "0 0 12px", color: "var(--texto-suave)", fontSize: 14 }}>
        {veTodo ? "El feedback de cada sesión, por líder y por reunión, del más reciente al más antiguo." : "El feedback que recibiste en cada sesión, por reunión, del más reciente al más antiguo."}
      </p>
      {enviadas === null ? (
        <p style={gris}>Cargando…</p>
      ) : (
        <>
          {veTodo && <input className="rp-input" style={{ maxWidth: 420, marginBottom: 12 }} placeholder="Buscar por líder, reunión, evaluador o texto…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar feedback" />}
          {grupos.length === 0 && <p style={{ ...gris, fontSize: 14 }}>{lista.length === 0 ? "Aún no hay feedback registrado." : "Nada coincide con lo que escribiste."}</p>}
          {grupos.map((g, i) => (
            <details key={g.lider} open={i < 3 || !!q || !veTodo} style={{ border: "1px solid var(--borde)", borderRadius: 12, marginBottom: 10, background: "#fff" }}>
              <summary style={{ cursor: "pointer", padding: "10px 14px", fontWeight: 800, fontSize: 15 }}>
                {veTodo ? g.lider : "Mis feedbacks"} <span style={{ ...gris, fontWeight: 600, fontSize: 12.5 }}>· {g.total} {g.total === 1 ? "sesión" : "sesiones"} · última {ddmm(g.ultima)}</span>
              </summary>
              <div style={{ padding: "0 14px 12px" }}>
                {g.reuniones.map((r) => (
                  <div key={r.nombre + r.formulario} style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.nombre} <span style={{ ...gris, fontWeight: 500, fontSize: 12.5 }}>· {r.formulario}</span></div>
                    {r.items.map((e) => <TarjetaFeedback key={e.id} e={e} onVer={onVer} />)}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}

function TarjetaFeedback({ e, onVer }) {
  const fb = e.feedback || {};
  const reunion = (fb.reunion || "").trim();
  const items = [...(fb.fortalezas || []).map((x) => ["Fortaleza", x, "#1b7a46"]), ...(fb.oportunidades || []).map((x) => ["Oportunidad de mejora", x, "#B5820A"])];
  return (
    <div style={{ borderLeft: "3px solid var(--verde)", background: "var(--fondo)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
        <b>{ddmm(fechaCdR(e))}</b>
        <span style={gris}>Emitió: {e.evaluadorNombre || e.registradoPorNombre || "—"}</span>
        {typeof e.resultado?.indice === "number" && <span className="ca-pill" style={{ fontSize: 12 }}>{pct(e.resultado.indice)}</span>}
        <button type="button" className="cdr-nav-btn" style={{ marginLeft: "auto" }} onClick={() => onVer(e)}>Ver evaluación</button>
      </div>
      {conFeedbackReunion(e.formulario) && (
        <div style={{ marginTop: 6, fontSize: 13.5 }}>
          <b>{TITULO_FEEDBACK_REUNION}</b>
          <div style={{ whiteSpace: "pre-wrap", color: reunion ? "inherit" : "var(--texto-suave)" }}>{reunion || "Sin feedback de la reunión (evaluación anterior a este campo)."}</div>
        </div>
      )}
      {items.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Fortalezas y oportunidades ({items.length})</summary>
          {items.map(([tipo, x, color], i) => (
            <div key={x.id || i} style={{ fontSize: 13, margin: "6px 0", paddingLeft: 8, borderLeft: `3px solid ${color}` }}>
              <b>{tipo}{x.criterio ? ` · ${x.criterio}` : ""}</b>
              {x.situacion && <div><b>Situación:</b> {x.situacion}</div>}
              {x.comportamiento && <div><b>Comportamiento:</b> {x.comportamiento}</div>}
              {x.impacto && <div><b>Impacto:</b> {x.impacto}</div>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
