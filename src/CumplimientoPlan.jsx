import { useMemo, useState } from "react";
import { fechaCdR } from "./estadisticas.js";
import { celdaDelMes, hechasEnAsignacion, asignacionesDe, esLaPersona, etiquetaCadencia, desdeEfectivo } from "./asignaciones.js";

const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

// Semáforo: 95–100 verde · 80–95 ámbar · bajo 80 rojo.
function color(p) {
  if (p === null || p === undefined) return "var(--texto-suave)";
  if (p >= 95) return "#1b7a46";
  if (p >= 80) return "#B5820A";
  return "#b02a26";
}
function fondo(c) {
  if (!c.exigido) return {};
  const p = (c.hechas / c.exigido) * 100;
  if (p >= 95) return { background: "#f0faf5" };
  if (p >= 80) return { background: "#fffaf0" };
  return { background: "#fdf3f3" };
}
function badge(p) {
  return { display: "inline-block", padding: "3px 9px", borderRadius: 100, fontSize: 12, fontWeight: 700, color: "#fff", background: color(p) };
}

/**
 * "Cumplimiento de mi plan", igual que en la app Formularios: una fila por asignación (formulario, reunión,
 * cadencia), una columna por mes con ejecutadas / exigidas, totales por fila y por mes.
 * El periodo en curso no castiga antes de tiempo (se usa la misma celdaDelMes que el resto de la app).
 */
export default function CumplimientoPlan({ persona, asignaciones, evals, titulo = "Mi cumplimiento", compacto = false, nombreArchivo = "", conHistorial = false }) {
  const [rango, setRango] = useState(compacto ? "3m" : "6m"); // 3m | 6m | anio
  const ahora = new Date();

  const columnas = useMemo(() => {
    const hoy = new Date();
    if (rango === "anio") return Array.from({ length: hoy.getMonth() + 1 }, (_, i) => ({ anio: hoy.getFullYear(), mes: i }));
    const n = rango === "3m" ? 3 : 6;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (n - 1 - i), 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  }, [rango]);

  const filas = useMemo(() => {
    return asignacionesDe(asignaciones || [], persona)
      .map((a) => {
        const p = a.personas.find((x) => esLaPersona(x, persona));
        const cantidad = Math.max(1, Number(p.cantidad) || 1);
        const frecuencia = p.frecuencia || "semanal";
        const desde = desdeEfectivo(a, p);
        const hechas = hechasEnAsignacion(a, p, evals || [], frecuencia);
        const celdas = columnas.map(({ anio, mes }) => celdaDelMes(frecuencia, cantidad, desde, hechas, anio, mes, ahora));
        const totalExigido = celdas.reduce((s, c) => s + c.exigido, 0);
        const totalHecho = celdas.reduce((s, c) => s + c.hechas, 0);
        return { asignacion: a, cantidad, frecuencia, desde, celdas, totalExigido, totalHecho, porcentaje: totalExigido > 0 ? Math.round((totalHecho / totalExigido) * 100) : null };
      })
      .sort((x, y) => (x.porcentaje ?? 999) - (y.porcentaje ?? 999));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones, evals, persona, columnas]);

  const totalesColumna = columnas.map((_, i) => ({
    hechas: filas.reduce((s, f) => s + f.celdas[i].hechas, 0),
    exigido: filas.reduce((s, f) => s + f.celdas[i].exigido, 0),
  }));
  const granExigido = filas.reduce((s, f) => s + f.totalExigido, 0);
  const granHecho = filas.reduce((s, f) => s + f.totalHecho, 0);
  const granPorcentaje = granExigido > 0 ? Math.round((granHecho / granExigido) * 100) : null;

  // Historial: los formularios que esta persona envió dentro del rango elegido (más reciente primero).
  const historial = useMemo(() => {
    if (!conHistorial) return [];
    const inicio = `${columnas[0].anio}-${String(columnas[0].mes + 1).padStart(2, "0")}-01`;
    const yo = normTexto(persona.nombreUsuario || persona.nombre);
    return (evals || [])
      .filter((e) => e.estado === "enviada" && !e.anulada)
      .filter((e) => (persona.uid && (e.evaluadorUid === persona.uid || e.registradoPorUid === persona.uid)) || (yo && normTexto(e.evaluadorNombre) === yo))
      .map((e) => ({ e, fecha: fechaCdR(e) || "" }))
      .filter((x) => x.fecha >= inicio)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [conHistorial, evals, persona, columnas]);

  function exportarCSV() {
    const cab = ["% Periodo", "Formulario", "Reunión", "Cadencia", ...columnas.map((c) => `${MESES_CORTOS[c.mes]}-${c.anio}`), "Total"];
    const lineas = [cab, ...filas.map((f) => [
      f.porcentaje === null ? "" : `${f.porcentaje}%`,
      f.asignacion.formularioNombre || "",
      f.asignacion.reunionNombre || "",
      etiquetaCadencia(f.cantidad, f.frecuencia),
      ...f.celdas.map((c) => (c.exigido === 0 ? "" : `${c.hechas}/${c.exigido}`)),
      `${f.totalHecho}/${f.totalExigido}`,
    ])];
    const csv = lineas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cumplimiento-${nombreArchivo || persona.nombreUsuario || persona.nombre || "plan"}-${rango}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (filas.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px 8px" }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🗓️</div>
        <p style={{ fontWeight: 700, margin: "0 0 4px" }}>Ningún formulario te tiene asignado.</p>
        <p style={{ color: "var(--texto-suave)", fontSize: 13, margin: 0 }}>Cuando un administrador te asigne uno, aquí verás tu cumplimiento mes a mes.</p>
      </div>
    );
  }

  return (
    <div>
      {titulo && <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: compacto ? 15 : 17 }}>{titulo}</p>}
      {compacto && (
        <div style={{ textAlign: "center", background: "var(--fondo)", border: "1px solid var(--borde)", borderRadius: 12, padding: "14px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--texto-suave)" }}>Cumplimiento general</div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, color: color(granPorcentaje) }}>{granPorcentaje === null ? "—" : `${granPorcentaje}%`}</div>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
            {granExigido > 0 ? `${granHecho} de ${granExigido} exigidos` : "Sin exigencia en este periodo"} · {rango === "3m" ? "últimos 3 meses" : rango === "6m" ? "últimos 6 meses" : `año ${ahora.getFullYear()}`}
          </div>
        </div>
      )}
      <p style={{ color: "var(--texto-suave)", fontSize: 12.5, margin: "0 0 10px" }}>
        Cada celda muestra cuántas ejecutaste sobre cuántas se te exigían ese mes, según la cadencia de cada asignación.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(compacto ? [["3m", "3 meses"], ["6m", "6 meses"], ["anio", `Año ${ahora.getFullYear()}`]] : [["6m", "Últimos 6 meses"], ["anio", `Año ${ahora.getFullYear()}`]]).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setRango(v)} style={chip(rango === v)}>{t}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!compacto && granPorcentaje !== null && (
            <span style={{ fontSize: 14 }}>
              Cumplimiento <strong style={{ fontSize: 20, color: color(granPorcentaje) }}>{granPorcentaje}%</strong>
              <span style={{ color: "var(--texto-suave)", fontSize: 13 }}> · {granHecho} de {granExigido}</span>
            </span>
          )}
          {!compacto && <button type="button" className="cdr-nav-btn" onClick={exportarCSV}>↓ Exportar (CSV)</button>}
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 12, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--verde)" }}>
              <th style={{ ...th, width: 58 }}>%</th>
              <th style={{ ...th, textAlign: "left", minWidth: compacto ? 140 : 190 }}>FORMULARIO</th>
              {!compacto && <th style={{ ...th, textAlign: "left", minWidth: 150 }}>REUNIÓN</th>}
              {!compacto && <th style={{ ...th, minWidth: 110 }}>CADENCIA</th>}
              {columnas.map((c) => (
                <th key={`${c.anio}-${c.mes}`} style={{ ...th, width: 58 }}>
                  <div>{MESES_CORTOS[c.mes]}</div>
                  <div style={{ fontSize: 9, opacity: 0.85 }}>{c.anio}</div>
                </th>
              ))}
              <th style={{ ...th, width: 64 }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.asignacion.id} style={{ borderTop: "1px solid var(--borde)" }}>
                <td style={{ ...td, textAlign: "center" }}>
                  {f.porcentaje === null ? <span style={{ color: "var(--texto-suave)", fontSize: 12 }}>—</span> : <span style={badge(f.porcentaje)}>{f.porcentaje}%</span>}
                </td>
                <td style={{ ...td, fontWeight: 600 }}>
                  {f.asignacion.formularioNombre || "—"}
                  {compacto && (
                    <div style={{ fontWeight: 400, fontSize: 11.5, color: "var(--texto-suave)" }}>
                      {f.asignacion.reunionNombre} · {etiquetaCadencia(f.cantidad, f.frecuencia)}
                    </div>
                  )}
                </td>
                {!compacto && <td style={td}>{f.asignacion.reunionNombre || "—"}</td>}
                {!compacto && (
                  <td style={{ ...td, textAlign: "center", color: "var(--texto-suave)", fontSize: 12 }}>
                    {etiquetaCadencia(f.cantidad, f.frecuencia)}
                    {f.desde && <div style={{ fontSize: 10, marginTop: 2 }}>desde {f.desde.split("-").reverse().join("-")}</div>}
                  </td>
                )}
                {f.celdas.map((c, i) => (
                  <td key={i} style={{ ...td, textAlign: "center", ...fondo(c) }}>
                    {c.exigido === 0 ? <span style={{ color: "#d7e2e0" }}>·</span> : <strong style={{ color: color((c.hechas / c.exigido) * 100) }}>{c.hechas}/{c.exigido}</strong>}
                  </td>
                ))}
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{f.totalHecho}/{f.totalExigido}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--borde)", background: "var(--fondo)" }}>
              <td style={{ ...td, textAlign: "center" }}>{granPorcentaje !== null && <span style={badge(granPorcentaje)}>{granPorcentaje}%</span>}</td>
              <td style={{ ...td, fontWeight: 700 }} colSpan={compacto ? 1 : 3}>TOTAL</td>
              {totalesColumna.map((c, i) => (
                <td key={i} style={{ ...td, textAlign: "center", fontWeight: 700, ...fondo(c) }}>
                  {c.exigido === 0 ? <span style={{ color: "#d7e2e0" }}>·</span> : `${c.hechas}/${c.exigido}`}
                </td>
              ))}
              <td style={{ ...td, textAlign: "center", fontWeight: 800 }}>{granHecho}/{granExigido}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style={{ color: "var(--texto-suave)", fontSize: 11.5, marginTop: 8 }}>
        Cada celda es ejecutadas / exigidas en ese mes. El punto gris indica que ese mes no tenía exigencia. Los periodos que
        aún no empiezan no se cuentan, así el mes en curso no aparece castigado antes de tiempo.
      </p>
      {conHistorial && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 15 }}>Historial de formularios realizados ({historial.length})</p>
          {historial.length === 0 ? (
            <p style={{ color: "var(--texto-suave)", fontSize: 13, margin: 0 }}>No enviaste formularios en este periodo.</p>
          ) : (
            historial.map(({ e, fecha }) => (
              <div key={e.id} style={{ border: "1px solid var(--borde)", borderRadius: 10, padding: "9px 12px", marginBottom: 6, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 13.5 }}>{e.formulario?.nombre || "Formulario"}</strong>
                  <span style={{ fontSize: 12, color: "var(--texto-suave)", whiteSpace: "nowrap" }}>{fecha.split("-").reverse().join("-")}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 2 }}>
                  {e.rutinaNombre || "Sin reunión"}{e.lider ? ` · Líder: ${e.lider}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function normTexto(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const th = { padding: "9px 8px", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textAlign: "center", whiteSpace: "nowrap" };
const td = { padding: "8px 8px", verticalAlign: "middle" };
function chip(sel) {
  return {
    padding: "6px 12px",
    borderRadius: 100,
    border: `2px solid ${sel ? "var(--verde)" : "var(--borde)"}`,
    background: sel ? "var(--verde-claro)" : "#fff",
    color: sel ? "var(--verde-oscuro)" : "var(--texto-suave)",
    fontWeight: sel ? 700 : 500,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "inherit",
  };
}
