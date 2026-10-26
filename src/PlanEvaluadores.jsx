import { useState, useEffect, useMemo } from "react";
import {
  cargarPlanEvaluadores,
  filaPlanDeEvaluador,
  resumenPlanEvaluadores,
  etiquetaCadencia,
  ETIQUETA_ESTADO_PLAN,
} from "./formularios.js";
import { listarUsuarios, APP_ACTUAL_ID } from "./auth.js";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Semáforo: 95–100 verde · 80–95 ámbar · bajo 80 rojo.
function colorPorcentaje(p) {
  if (p === null || p === undefined) return "var(--texto-suave)";
  if (p >= 95) return "var(--verde-oscuro)";
  if (p >= 80) return "var(--ambar)";
  return "var(--rojo)";
}

const COLOR_ESTADO = {
  cumplido: "var(--verde-oscuro)",
  al_dia: "var(--verde)",
  atrasado: "var(--ambar)",
  no_cumplido: "var(--rojo)",
  pendiente: "var(--texto-suave)",
  sin_exigencia: "var(--texto-suave)",
  sin_plan: "var(--texto-suave)",
};

// ¿Esta persona del directorio tiene acceso hoy a la app?
function tieneAcceso(u) {
  if (!u || u.rol === "deshabilitado" || u.estado === "pendiente") return false;
  if (u.rol === "master") return true;
  return !Array.isArray(u.apps) || u.apps.length === 0 || u.apps.includes(APP_ACTUAL_ID);
}

export default function PlanEvaluadores() {
  const hoy = new Date();
  const [datos, setDatos] = useState(null);
  const [usuarios, setUsuarios] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth());
  const [filtro, setFiltro] = useState("");
  const [soloConPendientes, setSoloConPendientes] = useState(false);
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    let vivo = true;
    cargarPlanEvaluadores()
      .then((r) => vivo && setDatos(r))
      .catch(() => vivo && setError("No se pudo cargar el plan de evaluadores."))
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, []);

  // El directorio sirve para mostrar también a quien tiene acceso pero todavía
  // no está asignado a ningún formulario. Si no se puede leer, no pasa nada.
  useEffect(() => listarUsuarios(setUsuarios, () => setUsuarios([])), []);

  const filas = useMemo(() => {
    if (!datos) return [];
    const conAsignaciones = datos.personas.map((p) => filaPlanDeEvaluador(p, anio, mes, hoy));

    // Personas con acceso a la app que no aparecen en ninguna asignación.
    const vistas = new Set();
    conAsignaciones.forEach((f) => {
      if (f.uid) vistas.add(f.uid);
      vistas.add(sinTildes(f.nombre));
    });
    const sinAsignar = (usuarios || [])
      .filter((u) => tieneAcceso(u) && u.rol !== "master")
      .filter((u) => !vistas.has(u.uid) && !vistas.has(sinTildes(u.nombreUsuario)))
      .map((u) => ({
        clave: u.uid,
        uid: u.uid,
        nombre: u.nombreUsuario,
        area: u.area || "",
        detalle: [],
        exigido: 0,
        exigidoVencido: 0,
        hechas: 0,
        porcentaje: null,
        estado: "sin_plan",
      }));

    const orden = { atrasado: 0, no_cumplido: 1, al_dia: 2, cumplido: 3, sin_exigencia: 4, pendiente: 5, sin_plan: 6 };
    return [...conAsignaciones, ...sinAsignar].sort(
      (a, b) => (orden[a.estado] - orden[b.estado]) || a.nombre.localeCompare(b.nombre, "es")
    );
  }, [datos, usuarios, anio, mes]);

  const visibles = useMemo(() => {
    const t = sinTildes(filtro.trim());
    let lista = t
      ? filas.filter((f) => sinTildes(f.nombre).includes(t) || sinTildes(f.area).includes(t))
      : filas;
    if (soloConPendientes) lista = lista.filter((f) => f.estado === "atrasado" || f.estado === "no_cumplido");
    return lista;
  }, [filas, filtro, soloConPendientes]);

  const resumen = useMemo(() => resumenPlanEvaluadores(filas), [filas]);
  const totalExigido = filas.reduce((s, f) => s + f.exigido, 0);
  const totalHecho = filas.reduce((s, f) => s + f.hechas, 0);
  const porcentajeGeneral = totalExigido > 0 ? Math.round((totalHecho / totalExigido) * 100) : null;

  const mesesDisponibles = Array.from({ length: 12 }, (_, i) => i);
  const anios = [hoy.getFullYear() - 1, hoy.getFullYear()];

  if (cargando) return <div className="ca-contenido"><p style={gris}>Cargando plan de evaluadores…</p></div>;
  if (error) return <div className="ca-contenido"><p style={{ color: "var(--rojo)" }}>{error}</p></div>;

  return (
    <div className="ca-contenido">
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Plan de evaluadores</h2>
      <p style={{ ...gris, margin: "0 0 16px" }}>
        Qué le corresponde a cada persona en el mes y cuánto lleva hecho, según la cadencia que tiene
        dentro de cada asignación.
      </p>

      <div className="ca-card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="ca-label">Mes</label>
            <select className="ca-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m} style={{ textTransform: "capitalize" }}>{MESES[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="ca-label">Año</label>
            <select className="ca-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="ca-label">Buscar</label>
            <input
              className="ca-input"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Nombre o área…"
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, paddingBottom: 10 }}>
            <input
              type="checkbox"
              checked={soloConPendientes}
              onChange={(e) => setSoloConPendientes(e.target.checked)}
            />
            Solo con deuda
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Tarjeta titulo="Personas" valor={resumen.personas} />
        <Tarjeta titulo="Cumplido" valor={resumen.cumplido} color="var(--verde-oscuro)" />
        <Tarjeta titulo="Al día" valor={resumen.al_dia} color="var(--verde)" />
        <Tarjeta titulo="Atrasado" valor={resumen.atrasado} color="var(--ambar)" />
        <Tarjeta titulo="No cumplido" valor={resumen.no_cumplido} color="var(--rojo)" />
        <Tarjeta titulo="Sin asignaciones" valor={resumen.sin_plan} />
        <Tarjeta
          titulo="Cumplimiento del mes"
          valor={porcentajeGeneral === null ? "—" : `${porcentajeGeneral}%`}
          color={colorPorcentaje(porcentajeGeneral)}
        />
      </div>

      {visibles.length === 0 ? (
        <div className="ca-card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <p style={{ ...gris, margin: 0 }}>
            {filas.length === 0
              ? "Todavía no hay personas asignadas en ningún formulario."
              : "Nadie coincide con ese filtro."}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--borde)", borderRadius: 10, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: "var(--verde-oscuro)" }}>
                <Th>Persona</Th>
                <Th>Área</Th>
                <Th centro>Asignaciones</Th>
                <Th centro>Hecho / Exigido</Th>
                <Th centro>%</Th>
                <Th centro>Estado</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((f, i) => (
                <FilaPersona
                  key={f.clave}
                  fila={f}
                  impar={i % 2 === 1}
                  abierta={abierta === f.clave}
                  onAlternar={() => setAbierta(abierta === f.clave ? null : f.clave)}
                  esMesActual={anio === hoy.getFullYear() && mes === hoy.getMonth()}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ ...gris, fontSize: 12, marginTop: 10 }}>
        <b>Al día</b> = todavía está dentro del periodo en curso, así que no se le reclama ·{" "}
        <b>Atrasado</b> = le falta de periodos que ya cerraron ·{" "}
        <b>No cumplido</b> = el mes terminó sin completarse · <b>Pendiente</b> = mes futuro.
        El periodo en curso nunca cuenta en contra hasta que termina. Pincha una fila para ver el detalle
        por formulario.
      </p>
    </div>
  );
}

function FilaPersona({ fila, impar, abierta, onAlternar, esMesActual }) {
  const fondo = impar ? "#fafaf7" : "#fff";
  return (
    <>
      <tr
        style={{ background: fondo, borderTop: "1px solid var(--borde)", cursor: fila.detalle.length ? "pointer" : "default" }}
        onClick={() => fila.detalle.length && onAlternar()}
      >
        <Td><b>{fila.nombre}</b></Td>
        <Td>{fila.area || <span style={gris}>—</span>}</Td>
        <Td centro>{fila.detalle.length || <span style={gris}>0</span>}</Td>
        <Td centro>
          {fila.exigido > 0 ? (
            <span style={{ fontWeight: 700, color: colorPorcentaje(fila.porcentaje) }}>
              {fila.hechas} / {fila.exigido}
            </span>
          ) : (
            <span style={gris}>—</span>
          )}
        </Td>
        <Td centro>
          {fila.porcentaje === null ? (
            <span style={gris}>—</span>
          ) : (
            <span style={{ fontWeight: 800, color: colorPorcentaje(fila.porcentaje) }}>{fila.porcentaje}%</span>
          )}
        </Td>
        <Td centro>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: COLOR_ESTADO[fila.estado],
              border: `1.5px solid ${COLOR_ESTADO[fila.estado]}`,
              borderRadius: 100,
              padding: "3px 10px",
              whiteSpace: "nowrap",
            }}
          >
            {ETIQUETA_ESTADO_PLAN[fila.estado]}
          </span>
        </Td>
        <Td centro>
          {fila.detalle.length > 0 && <span style={{ color: "var(--texto-suave)" }}>{abierta ? "▲" : "▼"}</span>}
        </Td>
      </tr>

      {abierta && fila.detalle.length > 0 && (
        <tr style={{ background: "var(--verde-claro)" }}>
          <td colSpan={7} style={{ padding: "10px 14px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "var(--verde-oscuro)", textAlign: "left" }}>
                  <th style={thMini}>Formulario</th>
                  <th style={thMini}>Reunión</th>
                  <th style={thMini}>Cadencia</th>
                  <th style={{ ...thMini, textAlign: "center" }}>Hecho / Exigido</th>
                  {esMesActual && <th style={{ ...thMini, textAlign: "center" }}>Pendiente ahora</th>}
                  <th style={{ ...thMini, textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {fila.detalle.map((d) => (
                  <tr key={`${d.formulario.id}__${d.asignacion.id}`} style={{ borderTop: "1px solid #cfe8e5" }}>
                    <td style={tdMini}>{d.formulario.titulo || d.formulario.nombre || "—"}</td>
                    <td style={tdMini}>{d.asignacion.reunionNombre || <span style={gris}>—</span>}</td>
                    <td style={tdMini}>{etiquetaCadencia(d.cantidad, d.frecuencia)}</td>
                    <td style={{ ...tdMini, textAlign: "center" }}>
                      {d.exigido > 0 ? `${d.hechas} / ${d.exigido}` : <span style={gris}>—</span>}
                    </td>
                    {esMesActual && (
                      <td style={{ ...tdMini, textAlign: "center" }}>
                        {d.pendienteAhora > 0 ? (
                          <b style={{ color: "var(--ambar)" }}>{d.pendienteAhora}</b>
                        ) : (
                          <span style={{ color: "var(--verde-oscuro)" }}>✓</span>
                        )}
                      </td>
                    )}
                    <td style={{ ...tdMini, textAlign: "center", color: COLOR_ESTADO[d.estado], fontWeight: 700 }}>
                      {ETIQUETA_ESTADO_PLAN[d.estado]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {d_desde(fila) && (
              <p style={{ ...gris, fontSize: 11.5, margin: "8px 0 0" }}>
                Las asignaciones que empiezan más adelante no se exigen todavía.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function d_desde(fila) {
  return fila.detalle.some((d) => d.desde);
}

function Tarjeta({ titulo, valor, color }) {
  return (
    <div
      className="ca-card"
      style={{ padding: "10px 14px", minWidth: 110, flex: "0 0 auto", marginBottom: 0 }}
    >
      <p style={{ ...gris, fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</p>
      <p style={{ fontSize: 22, fontWeight: 800, margin: "2px 0 0", color: color || "var(--texto)" }}>{valor}</p>
    </div>
  );
}

function Th({ children, centro }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: "#fff",
        textAlign: centro ? "center" : "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, centro }) {
  return <td style={{ padding: "9px 12px", textAlign: centro ? "center" : "left" }}>{children}</td>;
}

const gris = { color: "var(--texto-suave)" };
const thMini = { padding: "4px 8px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4 };
const tdMini = { padding: "6px 8px" };

function sinTildes(t) {
  return (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
