import { useState, useEffect, useMemo } from "react";
import {
  datosCumplimiento,
  periodosDelMes,
  periodoVigente,
  etiquetaCadencia,
  desdeDePersona,
  periodoDentroDelControl,
} from "./formularios.js";

const MESES_CORTOS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

export default function MiPlan({ usuario, onAbrirFormulario }) {
  const [datos, setDatos] = useState([]);
  const [diagnostico, setDiagnostico] = useState({ totalFormularios: 0, conAsignaciones: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [rango, setRango] = useState("6m"); // "6m" | "anio"

  useEffect(() => {
    let vivo = true;
    datosCumplimiento(usuario)
      .then((r) => {
        if (!vivo) return;
        setDatos(r.filas);
        setDiagnostico({ totalFormularios: r.totalFormularios, conAsignaciones: r.conAsignaciones });
      })
      .catch(() => vivo && setError("No se pudo cargar tu plan."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, [usuario.uid, usuario.nombreUsuario]);

  // Columnas: los últimos 6 meses terminando en el actual, o los meses
  // transcurridos del año en curso.
  const columnas = useMemo(() => {
    const hoy = new Date();
    if (rango === "anio") {
      return Array.from({ length: hoy.getMonth() + 1 }, (_, i) => ({
        anio: hoy.getFullYear(),
        mes: i,
      }));
    }
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
      return { anio: d.getFullYear(), mes: d.getMonth() };
    });
  }, [rango]);

  const filas = useMemo(() => {
    const ahora = new Date();
    const periodoActual = (frec) => periodoVigente(frec, ahora);
    const salida = [];

    for (const { formulario, asignaciones, respuestas } of datos) {
      for (const asig of asignaciones) {
        const cantidad = Number(asig.cantidad) || 1;
        const mias = respuestas.filter((r) => r.asignacionId === asig.id);
        const desde = desdeDePersona(asig, usuario);

        const celdas = columnas.map(({ anio, mes }) => {
          const periodos = periodosDelMes(asig.frecuencia, anio, mes);

          // "Una sola vez" no tiene periodos: se cuenta lo ejecutado en el mes
          // contra la cantidad pedida, una única vez en total.
          if (periodos.length === 0) {
            const hechas = mias.filter((r) => {
              const f = new Date(r.fecha);
              return f.getFullYear() === anio && f.getMonth() === mes;
            }).length;
            return { hechas: Math.min(hechas, cantidad), exigido: hechas > 0 ? cantidad : 0 };
          }

          // Los periodos que todavía no empiezan no se exigen.
          const actual = periodoActual(asig.frecuencia);
          const considerados = periodos.filter(
            (p) =>
              (p.cierra <= ahora || p.clave === actual) &&
              periodoDentroDelControl(p.cierra, desde)
          );
          const exigido = considerados.length * cantidad;
          const hechas = considerados.reduce((s, p) => {
            const n = mias.filter((r) => r.periodo === p.clave).length;
            return s + Math.min(n, cantidad);
          }, 0);
          return { hechas, exigido };
        });

        const totalExigido = celdas.reduce((s, c) => s + c.exigido, 0);
        const totalHecho = celdas.reduce((s, c) => s + c.hechas, 0);

        salida.push({
          clave: `${formulario.id}__${asig.id}`,
          formulario,
          asignacion: asig,
          desde,
          celdas,
          totalExigido,
          totalHecho,
          porcentaje: totalExigido > 0 ? Math.round((totalHecho / totalExigido) * 100) : null,
        });
      }
    }
    return salida.sort((a, b) => (a.porcentaje ?? 999) - (b.porcentaje ?? 999));
  }, [datos, columnas, usuario]);

  // Totales por columna y generales.
  const totalesColumna = columnas.map((_, i) => {
    const hechas = filas.reduce((s, f) => s + f.celdas[i].hechas, 0);
    const exigido = filas.reduce((s, f) => s + f.celdas[i].exigido, 0);
    return { hechas, exigido };
  });
  const granExigido = filas.reduce((s, f) => s + f.totalExigido, 0);
  const granHecho = filas.reduce((s, f) => s + f.totalHecho, 0);
  const granPorcentaje = granExigido > 0 ? Math.round((granHecho / granExigido) * 100) : null;

  function exportarCSV() {
    const cab = ["% Periodo", "Formulario", "Reunión", "Cadencia",
      ...columnas.map((c) => `${MESES_CORTOS[c.mes]}-${c.anio}`), "Total"];
    const lineas = [cab];
    for (const f of filas) {
      lineas.push([
        f.porcentaje === null ? "" : `${f.porcentaje}%`,
        f.formulario.titulo,
        f.asignacion.reunionNombre || "",
        etiquetaCadencia(f.asignacion.cantidad, f.asignacion.frecuencia),
        ...f.celdas.map((c) => (c.exigido === 0 ? "" : `${c.hechas}/${c.exigido}`)),
        `${f.totalHecho}/${f.totalExigido}`,
      ]);
    }
    const csv = lineas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cumplimiento-${usuario.nombreUsuario}-${rango}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cargando) return <div className="ca-contenido"><p style={gris}>Cargando tu plan…</p></div>;
  if (error) return <div className="ca-contenido"><p style={{ color: "var(--rojo)" }}>{error}</p></div>;

  return (
    <div style={{ padding: "18px 28px 60px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Cumplimiento de mi plan</h2>
      <p style={{ ...gris, margin: "0 0 16px" }}>
        Cada celda muestra cuántas ejecutaste sobre cuántas se te exigían ese mes,
        según la cadencia de cada asignación.
      </p>

      <div style={barra}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={rango === "6m" ? "ca-btn" : "ca-btn ca-btn-secundario"}
            style={btnRango}
            onClick={() => setRango("6m")}
          >
            Últimos 6 meses
          </button>
          <button
            className={rango === "anio" ? "ca-btn" : "ca-btn ca-btn-secundario"}
            style={btnRango}
            onClick={() => setRango("anio")}
          >
            Año {new Date().getFullYear()}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {granPorcentaje !== null && (
            <span style={{ fontSize: 14 }}>
              Cumplimiento{" "}
              <strong style={{ fontSize: 20, color: color(granPorcentaje) }}>{granPorcentaje}%</strong>
              <span style={{ ...gris, fontSize: 13 }}> · {granHecho} de {granExigido}</span>
            </span>
          )}
          {filas.length > 0 && (
            <button className="ca-btn" style={{ width: "auto", padding: "9px 16px" }} onClick={exportarCSV}>
              ↓ Exportar (CSV)
            </button>
          )}
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="ca-card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🗓️</div>
          <p style={{ fontWeight: 700, margin: "0 0 6px" }}>Ningún formulario te tiene asignado.</p>
          <p style={{ ...gris, margin: "0 auto", maxWidth: 540, fontSize: 13 }}>
            {diagnostico.totalFormularios === 0
              ? "Todavía no hay formularios creados."
              : diagnostico.conAsignaciones === 0
              ? `Hay ${diagnostico.totalFormularios} formulario(s), pero ninguno tiene asignaciones cargadas. Al editar un formulario, agrega una asignación con su reunión, las personas, la cantidad y la frecuencia.`
              : `Hay ${diagnostico.conAsignaciones} formulario(s) con asignaciones, pero en ninguna apareces como ${usuario.nombreUsuario}. Esta pestaña muestra el plan de quien tiene la sesión abierta, así que revisa que te hayan marcado entre las personas de la asignación.`}
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 12, background: "#fff" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--verde)" }}>
                  <th style={{ ...th, width: 64 }}>%</th>
                  <th style={{ ...th, textAlign: "left", minWidth: 200 }}>FORMULARIO</th>
                  <th style={{ ...th, textAlign: "left", minWidth: 160 }}>REUNIÓN</th>
                  <th style={{ ...th, minWidth: 120 }}>CADENCIA</th>
                  {columnas.map((c) => (
                    <th key={`${c.anio}-${c.mes}`} style={{ ...th, width: 62 }}>
                      <div>{MESES_CORTOS[c.mes]}</div>
                      <div style={{ fontSize: 9, opacity: 0.85 }}>{c.anio}</div>
                    </th>
                  ))}
                  <th style={{ ...th, width: 70 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.clave} style={{ borderTop: "1px solid var(--borde)" }}>
                    <td style={{ ...td, textAlign: "center" }}>
                      {f.porcentaje === null
                        ? <span style={{ ...gris, fontSize: 12 }}>—</span>
                        : <span style={badge(f.porcentaje)}>{f.porcentaje}%</span>}
                    </td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {onAbrirFormulario ? (
                        <button onClick={() => onAbrirFormulario(f.formulario)} style={enlace}>
                          {f.formulario.titulo}
                        </button>
                      ) : f.formulario.titulo}
                    </td>
                    <td style={td}>{f.asignacion.reunionNombre || "—"}</td>
                    <td style={{ ...td, textAlign: "center", color: "var(--texto-suave)", fontSize: 12 }}>
                      {etiquetaCadencia(f.asignacion.cantidad, f.asignacion.frecuencia)}
                      {f.desde && (
                        <div style={{ fontSize: 10, marginTop: 2 }}>desde {fechaCorta(f.desde)}</div>
                      )}
                    </td>
                    {f.celdas.map((c, i) => (
                      <td key={i} style={{ ...td, textAlign: "center", ...fondo(c) }}>
                        {c.exigido === 0
                          ? <span style={{ color: "#d7e2e0" }}>·</span>
                          : <strong style={{ color: colorRazon(c) }}>{c.hechas}/{c.exigido}</strong>}
                      </td>
                    ))}
                    <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>
                      {f.totalHecho}/{f.totalExigido}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--borde)", background: "var(--fondo)" }}>
                  <td style={{ ...td, textAlign: "center" }}>
                    {granPorcentaje !== null && <span style={badge(granPorcentaje)}>{granPorcentaje}%</span>}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }} colSpan={3}>TOTAL DEL PERIODO</td>
                  {totalesColumna.map((c, i) => (
                    <td key={i} style={{ ...td, textAlign: "center", fontWeight: 700, ...fondo(c) }}>
                      {c.exigido === 0 ? <span style={{ color: "#d7e2e0" }}>·</span> : `${c.hechas}/${c.exigido}`}
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: "center", fontWeight: 800 }}>
                    {granHecho}/{granExigido}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p style={{ ...gris, fontSize: 12, marginTop: 10 }}>
            Cada celda es ejecutadas / exigidas en ese mes. El punto gris indica que
            ese mes no tenía exigencia. Los periodos que aún no empiezan no se cuentan,
            así el mes en curso no aparece castigado antes de tiempo.
          </p>
        </>
      )}
    </div>
  );
}

// "2026-10-15" -> "15-10-2026", sin pasar por Date para que no se corra un
// día por la zona horaria.
function fechaCorta(iso) {
  const [a, m, d] = (iso || "").split("-");
  return a && m && d ? `${d}-${m}-${a}` : iso;
}

function color(p) {
  if (p >= 100) return "var(--verde-oscuro)";
  if (p >= 70) return "var(--ambar)";
  return "var(--rojo)";
}

function colorRazon(c) {
  if (c.exigido === 0) return "var(--texto-suave)";
  const p = (c.hechas / c.exigido) * 100;
  return color(p);
}

function fondo(c) {
  if (c.exigido === 0) return {};
  const p = (c.hechas / c.exigido) * 100;
  if (p >= 100) return { background: "#f0faf7" };
  if (p >= 70) return { background: "#fffaf0" };
  return { background: "#fdf3f3" };
}

function badge(p) {
  const verde = p >= 100;
  const medio = p >= 70;
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 700,
    background: verde ? "#e3f3ea" : medio ? "#fbe8c8" : "#fdeaea",
    color: verde ? "#1b7a46" : medio ? "#8a5a00" : "#b02a26",
  };
}

const gris = { color: "var(--texto-suave)", fontSize: 14 };
const th = { color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px", textAlign: "center", whiteSpace: "nowrap" };
const td = { padding: "9px 8px", verticalAlign: "middle" };
const barra = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 };
const btnRango = { width: "auto", padding: "8px 16px", fontSize: 13 };
const enlace = { background: "none", border: "none", padding: 0, color: "var(--verde-oscuro)", fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" };
