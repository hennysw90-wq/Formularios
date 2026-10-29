import { useMemo, useState } from "react";
import { fechaCdR } from "./estadisticas.js";
import { celdaDelMes, hechasEnAsignacion, asignacionesDe, esLaPersona, etiquetaCadencia, desdeEfectivo } from "./asignaciones.js";

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
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
export default function CumplimientoPlan({ persona, asignaciones, evals, titulo = "Mi cumplimiento", compacto = false, nombreArchivo = "", conHistorial = false, onVer = null }) {
  const [rango, setRango] = useState(compacto ? "1m" : "6m"); // 1m | 3m | 6m | anio
  const ahora = new Date();

  const columnas = useMemo(() => {
    const hoy = new Date();
    if (rango === "anio") return Array.from({ length: hoy.getMonth() + 1 }, (_, i) => ({ anio: hoy.getFullYear(), mes: i }));
    const n = rango === "1m" ? 1 : rango === "3m" ? 3 : 6;
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
        const hasta = frecuencia === "unica" ? p.hasta || "" : "";
        const celdas = columnas.map(({ anio, mes }) => celdaDelMes(frecuencia, cantidad, desde, hechas, anio, mes, ahora, hasta));
        const totalExigido = celdas.reduce((s, c) => s + c.exigido, 0);
        const totalHecho = celdas.reduce((s, c) => s + c.hechas, 0);
        const totalReal = celdas.reduce((s, c) => s + (c.reales ?? c.hechas), 0);
        return { asignacion: a, cantidad, frecuencia, desde, hasta, celdas, totalExigido, totalHecho, totalReal, porcentaje: totalExigido > 0 ? Math.round((totalHecho / totalExigido) * 100) : null };
      })
      .sort((x, y) => (x.porcentaje ?? 999) - (y.porcentaje ?? 999));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignaciones, evals, persona, columnas]);

  const totalesColumna = columnas.map((_, i) => ({
    hechas: filas.reduce((s, f) => s + f.celdas[i].hechas, 0),
    reales: filas.reduce((s, f) => s + (f.celdas[i].reales ?? f.celdas[i].hechas), 0),
    exigido: filas.reduce((s, f) => s + f.celdas[i].exigido, 0),
  }));
  const granExigido = filas.reduce((s, f) => s + f.totalExigido, 0);
  const granHecho = filas.reduce((s, f) => s + f.totalHecho, 0);
  const granReal = filas.reduce((s, f) => s + f.totalReal, 0); // lo hecho de verdad (puede superar el plan)
  const granPorcentaje = granExigido > 0 ? Math.round((granHecho / granExigido) * 100) : null;

  // Historial: todos los formularios que esta persona envió (más reciente primero), sin importar el rango.
  const historial = useMemo(() => {
    if (!conHistorial) return [];
    const yo = normTexto(persona.nombreUsuario || persona.nombre);
    return (evals || [])
      .filter((e) => e.estado === "enviada" && !e.anulada)
      .filter((e) => (persona.uid && (e.evaluadorUid === persona.uid || e.registradoPorUid === persona.uid)) || (yo && normTexto(e.evaluadorNombre) === yo))
      .map((e) => ({ e, fecha: fechaCdR(e) || "" }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [conHistorial, evals, persona]);

  function exportarCSV() {
    const cab = ["% Periodo", "Formulario", "Reunión", "Cadencia", ...columnas.map((c) => `${MESES_CORTOS[c.mes]}-${c.anio}`), "Total"];
    const lineas = [cab, ...filas.map((f) => [
      f.porcentaje === null ? "" : `${f.porcentaje}%`,
      f.asignacion.formularioNombre || "",
      f.asignacion.reunionNombre || "",
      etiquetaCadencia(f.cantidad, f.frecuencia, f.hasta),
      ...f.celdas.map((c) => (c.exigido === 0 ? "" : `${c.reales ?? c.hechas}/${c.exigido}`)),
      `${f.totalReal}/${f.totalExigido}`,
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

  // Texto del periodo elegido: "octubre 2026", "agosto – octubre 2026", "enero – octubre 2026"…
  const ini = columnas[0];
  const fin = columnas[columnas.length - 1];
  const textoPeriodo = columnas.length === 1
    ? `${MESES_LARGOS[ini.mes]} ${ini.anio}`
    : `${MESES_LARGOS[ini.mes]}${ini.anio !== fin.anio ? ` ${ini.anio}` : ""} – ${MESES_LARGOS[fin.mes]} ${fin.anio}`;
  const cortoPeriodo = columnas.length === 1
    ? MESES_CORTOS[ini.mes]
    : `${MESES_CORTOS[ini.mes]}–${MESES_CORTOS[fin.mes]}`;
  const total = (h, r, e) => ({ hechas: h, reales: r, exigido: e });
  const real = (c) => c.reales ?? c.hechas;

  return (
    <div>
      {titulo && <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: compacto ? 15 : 17 }}>{titulo}</p>}
      {compacto && (
        <div style={{ textAlign: "center", background: "var(--fondo)", border: "1px solid var(--borde)", borderRadius: 12, padding: "14px 12px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--texto-suave)" }}>Cumplimiento general</div>
          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, color: color(granPorcentaje) }}>{granPorcentaje === null ? "—" : `${granPorcentaje}%`}</div>
          <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
            {textoPeriodo}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10 }}>
            <div style={cajita}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--verde-oscuro)" }}>{granReal}</div>
              <div style={{ fontSize: 11.5, color: "var(--texto-suave)", fontWeight: 600 }}>Realizados</div>
            </div>
            <div style={cajita}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{granExigido}</div>
              <div style={{ fontSize: 11.5, color: "var(--texto-suave)", fontWeight: 600 }}>Plan</div>
            </div>
          </div>
        </div>
      )}
      <p style={{ color: "var(--texto-suave)", fontSize: 12.5, margin: "0 0 10px" }}>
        {compacto
          ? "Cuántas ejecutaste sobre cuántas se te exigían en el periodo elegido, según la cadencia de cada asignación."
          : "Cada celda muestra cuántas ejecutaste sobre cuántas se te exigían ese mes, según la cadencia de cada asignación."}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(compacto ? [["1m", "Mes actual"], ["3m", "3 meses"], ["6m", "6 meses"], ["anio", `Año ${ahora.getFullYear()}`]] : [["6m", "Últimos 6 meses"], ["anio", `Año ${ahora.getFullYear()}`]]).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setRango(v)} style={chip(rango === v)}>{t}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!compacto && granPorcentaje !== null && (
            <span style={{ fontSize: 14 }}>
              Cumplimiento <strong style={{ fontSize: 20, color: color(granPorcentaje) }}>{granPorcentaje}%</strong>
              <span style={{ color: "var(--texto-suave)", fontSize: 13 }}> · {granReal} de {granExigido}</span>
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
              {compacto ? (
                <th style={{ ...th, width: 84 }}>
                  <div>{cortoPeriodo}</div>
                  <div style={{ fontSize: 9, opacity: 0.85 }}>{fin.anio}</div>
                </th>
              ) : (
                <>
                  {columnas.map((c) => (
                    <th key={`${c.anio}-${c.mes}`} style={{ ...th, width: 58 }}>
                      <div>{MESES_CORTOS[c.mes]}</div>
                      <div style={{ fontSize: 9, opacity: 0.85 }}>{c.anio}</div>
                    </th>
                  ))}
                  <th style={{ ...th, width: 64 }}>TOTAL</th>
                </>
              )}
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
                      {f.asignacion.reunionNombre} · {etiquetaCadencia(f.cantidad, f.frecuencia, f.hasta)}
                    </div>
                  )}
                </td>
                {!compacto && <td style={td}>{f.asignacion.reunionNombre || "—"}</td>}
                {!compacto && (
                  <td style={{ ...td, textAlign: "center", color: "var(--texto-suave)", fontSize: 12 }}>
                    {etiquetaCadencia(f.cantidad, f.frecuencia, f.hasta)}
                    {f.desde && <div style={{ fontSize: 10, marginTop: 2 }}>desde {f.desde.split("-").reverse().join("-")}</div>}
                  </td>
                )}
                {(compacto ? [total(f.totalHecho, f.totalReal, f.totalExigido)] : f.celdas).map((c, i) => (
                  <td key={i} style={{ ...td, textAlign: "center", ...fondo(c) }}>
                    {c.exigido === 0 ? <span style={{ color: "#d7e2e0" }}>·</span> : <strong style={{ color: color((c.hechas / c.exigido) * 100) }}>{real(c)}/{c.exigido}</strong>}
                  </td>
                ))}
                {!compacto && <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{f.totalReal}/{f.totalExigido}</td>}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--borde)", background: "var(--fondo)" }}>
              <td style={{ ...td, textAlign: "center" }}>{granPorcentaje !== null && <span style={badge(granPorcentaje)}>{granPorcentaje}%</span>}</td>
              <td style={{ ...td, fontWeight: 700 }} colSpan={compacto ? 1 : 3}>TOTAL</td>
              {(compacto ? [total(granHecho, granReal, granExigido)] : totalesColumna).map((c, i) => (
                <td key={i} style={{ ...td, textAlign: "center", fontWeight: 700, ...fondo(c) }}>
                  {c.exigido === 0 ? <span style={{ color: "#d7e2e0" }}>·</span> : `${real(c)}/${c.exigido}`}
                </td>
              ))}
              {!compacto && <td style={{ ...td, textAlign: "center", fontWeight: 800 }}>{granReal}/{granExigido}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
      <p style={{ color: "var(--texto-suave)", fontSize: 11.5, marginTop: 8 }}>
        {compacto ? `Periodo: ${textoPeriodo}. ` : "Cada celda es ejecutadas / exigidas en ese mes. El punto gris indica que ese mes no tenía exigencia. "}
        Los periodos que aún no empiezan no se cuentan, así el mes en curso no aparece castigado antes de tiempo.
      </p>
      {conHistorial && <HistorialRealizados historial={historial} onVer={onVer} />}
    </div>
  );
}

/** Últimos 5 realizados y, debajo, un buscador por mes-año. Abrir uno en detalle pide la clave (lo resuelve onVer). */
function HistorialRealizados({ historial, onVer }) {
  const hoy = new Date();
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { clave, texto: `${MESES_LARGOS[d.getMonth()][0].toUpperCase()}${MESES_LARGOS[d.getMonth()].slice(1)} ${d.getFullYear()}`, n: historial.filter((x) => x.fecha.startsWith(clave)).length };
  });
  const [mesBuscado, setMesBuscado] = useState("");
  const delMes = mesBuscado ? historial.filter((x) => x.fecha.startsWith(mesBuscado)) : [];
  const textoMes = meses.find((m) => m.clave === mesBuscado)?.texto || "";

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: 15 }}>Últimos 5 formularios realizados</p>
      <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--texto-suave)" }}>
        {historial.length === 0 ? "Todavía no envías formularios." : onVer ? "Toca uno para revisarlo en detalle (pide tu clave)." : ""}
      </p>
      {historial.slice(0, 5).map((x) => <ItemRealizado key={x.e.id} {...x} onVer={onVer} />)}

      <div style={{ marginTop: 14, borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
        <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Buscar por mes</label>
        <select className="rp-select" value={mesBuscado} onChange={(e) => setMesBuscado(e.target.value)}>
          <option value="">Elige mes y año…</option>
          {meses.map((m) => (
            <option key={m.clave} value={m.clave}>{m.texto} ({m.n})</option>
          ))}
        </select>
        {mesBuscado && (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>{textoMes}: {delMes.length} {delMes.length === 1 ? "realizado" : "realizados"}</p>
            {delMes.length === 0 && <p style={{ color: "var(--texto-suave)", fontSize: 13, margin: 0 }}>No enviaste formularios ese mes.</p>}
            {delMes.map((x) => <ItemRealizado key={x.e.id} {...x} onVer={onVer} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRealizado({ e, fecha, onVer }) {
  return (
    <div role={onVer ? "button" : undefined} tabIndex={onVer ? 0 : undefined} onClick={onVer ? () => onVer(e) : undefined}
      onKeyDown={onVer ? (k) => (k.key === "Enter" || k.key === " ") && onVer(e) : undefined}
      style={{ border: "1px solid var(--borde)", borderRadius: 10, padding: "9px 12px", marginBottom: 6, background: "#fff", cursor: onVer ? "pointer" : "default" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 13.5 }}>{e.formulario?.nombre || "Formulario"}</strong>
        <span style={{ fontSize: 12, color: "var(--texto-suave)", whiteSpace: "nowrap" }}>{fecha.split("-").reverse().join("-")}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 2 }}>
        {e.rutinaNombre || "Sin reunión"}{e.lider ? ` · Líder: ${e.lider}` : ""}
      </div>
      {onVer && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--verde-oscuro)", marginTop: 4 }}>Revisar ›</div>}
    </div>
  );
}

function normTexto(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const cajita = { flex: 1, maxWidth: 130, background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, padding: "8px 6px" };
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
