import { useState, useEffect, useMemo } from "react";
import {
  datosCumplimiento,
  diasDelMes,
  periodosDelMes,
  periodoVigente,
  mismaFecha,
  etiquetaCadencia,
} from "./formularios.js";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_CORTOS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

export default function MiPlan({ usuario, onAbrirFormulario }) {
  const [datos, setDatos] = useState([]);
  const [diagnostico, setDiagnostico] = useState({ totalFormularios: 0, conAsignaciones: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());

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

  const dias = useMemo(() => diasDelMes(anio, mes), [anio, mes]);

  // Una fila por asignación, con el estado de cada día del mes.
  const filas = useMemo(() => {
    const salida = [];
    const ahora = new Date();
    // Un periodo que cierra hoy todavía está a tiempo: el ✗ solo se marca
    // desde ayer hacia atrás.
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    for (const { formulario, asignaciones, respuestas } of datos) {
      for (const asig of asignaciones) {
        const cantidad = Number(asig.cantidad) || 1;
        const mias = respuestas.filter((r) => r.asignacionId === asig.id);
        const periodos = periodosDelMes(asig.frecuencia, anio, mes);

        // Cuántas ejecuciones hay en cada periodo del mes.
        const hechasPorPeriodo = new Map();
        for (const p of periodos) {
          hechasPorPeriodo.set(p.clave, mias.filter((r) => r.periodo === p.clave).length);
        }

        const celdas = dias.map((dia) => {
          const ejecuciones = mias.filter((r) => mismaFecha(r.fecha, dia)).length;
          if (ejecuciones > 0) return { estado: "ok", ejecuciones };

          // Un ✗ solo se marca el día en que cierra un periodo que quedó
          // incompleto y que ya pasó. Los demás días quedan neutros: no
          // haber respondido un martes no es una falta si la exigencia
          // era semanal.
          const cierra = periodos.find((p) => mismaFecha(p.cierra.toISOString(), dia));
          if (cierra && dia < inicioHoy) {
            const hechas = hechasPorPeriodo.get(cierra.clave) || 0;
            if (hechas < cantidad) return { estado: "falta", ejecuciones: 0 };
          }
          return { estado: "neutro", ejecuciones: 0 };
        });

        // % del mes: lo cumplido sobre lo exigido en los periodos ya cerrados
        // más el que corre. Los periodos futuros no castigan el porcentaje.
        const periodoActual = periodoVigente(asig.frecuencia, ahora);
        const considerados = periodos.filter((p) => p.cierra <= ahora || p.clave === periodoActual);
        const exigido = considerados.length * cantidad;
        const cumplido = considerados.reduce(
          (s, p) => s + Math.min(hechasPorPeriodo.get(p.clave) || 0, cantidad), 0
        );

        salida.push({
          clave: `${formulario.id}__${asig.id}`,
          formulario,
          asignacion: asig,
          celdas,
          exigido,
          cumplido,
          porcentaje: exigido > 0 ? Math.round((cumplido / exigido) * 100) : null,
        });
      }
    }
    return salida.sort((a, b) => (a.porcentaje ?? 999) - (b.porcentaje ?? 999));
  }, [datos, dias, anio, mes]);

  const totalExigido = filas.reduce((s, f) => s + f.exigido, 0);
  const totalCumplido = filas.reduce((s, f) => s + f.cumplido, 0);
  const porcentajeMes = totalExigido > 0 ? Math.round((totalCumplido / totalExigido) * 100) : null;

  function cambiarMes(delta) {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  }

  function exportarCSV() {
    const cab = ["% Mes", "Formulario", "Reunión", "Cadencia", "Cumplido", "Exigido",
      ...dias.map((d) => `${String(d.getDate()).padStart(2, "0")}-${String(mes + 1).padStart(2, "0")}`)];
    const lineas = [cab];
    for (const f of filas) {
      lineas.push([
        f.porcentaje === null ? "" : `${f.porcentaje}%`,
        f.formulario.titulo,
        f.asignacion.reunionNombre || "",
        etiquetaCadencia(f.asignacion.cantidad, f.asignacion.frecuencia),
        f.cumplido,
        f.exigido,
        ...f.celdas.map((c) => (c.estado === "ok" ? (c.ejecuciones > 1 ? c.ejecuciones : "SI") : c.estado === "falta" ? "NO" : "")),
      ]);
    }
    const csv = lineas
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cumplimiento-${usuario.nombreUsuario}-${anio}-${String(mes + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cargando) return <div className="ca-contenido"><p style={gris}>Cargando tu plan…</p></div>;
  if (error) return <div className="ca-contenido"><p style={{ color: "var(--rojo)" }}>{error}</p></div>;

  return (
    <div style={{ padding: "18px 28px 60px" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Cumplimiento de mi plan</h2>
      <p style={{ ...gris, margin: "0 0 16px" }}>
        Cada fila es una asignación tuya. El ✓ marca el día en que la ejecutaste;
        el ✗ aparece solo cuando se cerró un periodo sin cumplir la cantidad pedida.
      </p>

      {/* Barra de mes */}
      <div style={barra}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="ca-btn ca-btn-secundario" style={btnMes} onClick={() => cambiarMes(-1)}>‹</button>
          <strong style={{ fontSize: 15, minWidth: 150, textAlign: "center" }}>
            {MESES[mes]} {anio}
          </strong>
          <button className="ca-btn ca-btn-secundario" style={btnMes} onClick={() => cambiarMes(1)}>›</button>
          <button
            className="ca-btn-texto"
            style={{ fontSize: 13 }}
            onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()); }}
          >
            Hoy
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {porcentajeMes !== null && (
            <span style={{ fontSize: 14 }}>
              Avance del mes{" "}
              <strong style={{ fontSize: 20, color: color(porcentajeMes) }}>{porcentajeMes}%</strong>
              <span style={{ ...gris, fontSize: 13 }}> · {totalCumplido} de {totalExigido}</span>
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
          <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
            Ningún formulario te tiene asignado.
          </p>
          <p style={{ ...gris, margin: "0 auto", maxWidth: 520, fontSize: 13 }}>
            {diagnostico.totalFormularios === 0
              ? "Todavía no hay formularios creados."
              : diagnostico.conAsignaciones === 0
              ? `Hay ${diagnostico.totalFormularios} formulario(s), pero ninguno tiene asignaciones cargadas. Al editar un formulario, agrega una asignación con su reunión, las personas, la cantidad y la frecuencia.`
              : `Hay ${diagnostico.conAsignaciones} formulario(s) con asignaciones, pero en ninguna apareces como ${usuario.nombreUsuario}. Revisa que te hayan marcado entre las personas de la asignación.`}
          </p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 12, background: "#fff" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--verde)" }}>
                  <th style={{ ...th, width: 62 }}>% MES</th>
                  <th style={{ ...th, textAlign: "left", minWidth: 190 }}>FORMULARIO</th>
                  <th style={{ ...th, textAlign: "left", minWidth: 150 }}>REUNIÓN</th>
                  <th style={{ ...th, minWidth: 110 }}>CADENCIA</th>
                  {dias.map((d) => (
                    <th key={d.getDate()} style={{ ...th, width: 34, padding: "6px 2px" }}>
                      <div style={{ fontSize: 12 }}>{String(d.getDate()).padStart(2, "0")}</div>
                      <div style={{ fontSize: 9, opacity: 0.85 }}>{DIAS_CORTOS[d.getDay()]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.clave} style={{ borderTop: "1px solid var(--borde)" }}>
                    <td style={{ ...td, textAlign: "center" }}>
                      {f.porcentaje === null ? (
                        <span style={{ ...gris, fontSize: 12 }}>—</span>
                      ) : (
                        <span style={badge(f.porcentaje)}>{f.porcentaje}%</span>
                      )}
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
                    </td>
                    {f.celdas.map((c, i) => (
                      <td key={i} style={{ ...td, textAlign: "center", padding: "6px 2px", ...fondoCelda(c.estado) }}>
                        {c.estado === "ok" ? (
                          <span style={{ color: "var(--verde-oscuro)", fontWeight: 700 }}>
                            {c.ejecuciones > 1 ? c.ejecuciones : "✓"}
                          </span>
                        ) : c.estado === "falta" ? (
                          <span style={{ color: "var(--rojo)", fontWeight: 700 }}>✕</span>
                        ) : (
                          <span style={{ color: "#d7e2e0" }}>·</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ ...gris, fontSize: 12, marginTop: 10 }}>
            ✓ ejecutada ese día (un número indica cuántas veces) · ✕ cerró el periodo sin
            completar la cantidad · · día sin exigencia pendiente. El % del mes compara lo
            cumplido contra lo exigido en los periodos ya cerrados más el que corre: los
            periodos que aún no empiezan no bajan la nota.
          </p>
        </>
      )}
    </div>
  );
}

function color(p) {
  if (p >= 100) return "var(--verde-oscuro)";
  if (p >= 70) return "var(--ambar)";
  return "var(--rojo)";
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

function fondoCelda(estado) {
  if (estado === "ok") return { background: "#f0faf7" };
  if (estado === "falta") return { background: "#fdf3f3" };
  return {};
}

const gris = { color: "var(--texto-suave)", fontSize: 14 };
const th = { color: "#fff", fontSize: 11, fontWeight: 700, padding: "8px 8px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0 };
const td = { padding: "8px 8px", verticalAlign: "middle" };
const barra = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 };
const btnMes = { width: "auto", padding: "6px 14px", fontSize: 16, lineHeight: 1 };
const enlace = { background: "none", border: "none", padding: 0, color: "var(--verde-oscuro)", fontWeight: 600, fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit" };
