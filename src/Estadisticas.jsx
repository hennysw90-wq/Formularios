import { useEffect, useMemo, useState } from "react";
import { listarEvaluacionesEnviadas, anularEvaluacion, restaurarEvaluacion } from "./evaluaciones.js";
import { listarFormularios } from "./formularios.js";
import { listarUsuarios } from "./auth.js";
import { Ejecutar } from "./MisCdR.jsx";
import PlanEvaluadores from "./PlanEvaluadores.jsx";
import { ETIQUETA_CLASIFICACION } from "./calculo.js";
import { FILTROS_VACIOS, filtrar, ordenar, opciones, kpis, distribucion, tendencia, promedioPor, porBloque, porCriterio, compromisos, cobertura, rangoPreset, aCSV, hoyISO, fechaCdR } from "./estadisticas.js";

const fmt = (n) => (n === null || n === undefined ? "—" : String(Math.round(n * 10) / 10).replace(".", ","));
const fechaCorta = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const CLASE = { efectiva: "ca-pill-verde", desarrollo: "ca-pill-ambar", intervencion: "ca-pill-rojo" };
const COLOR = { bueno: "#0f6e56", medio: "#ba7517", malo: "#993c1d" };
const colorDe = (v, u) => (v >= u.efectiva ? COLOR.bueno : v >= u.desarrollo ? COLOR.medio : COLOR.malo);

const PRESETS = [["todo", "Todo"], ["7d", "Últimos 7 días"], ["30d", "Últimos 30 días"], ["mes", "Este mes"], ["mesAnterior", "Mes anterior"]];
const ORDENES = [
  ["fecha:desc", "Fecha (más reciente primero)"],
  ["fecha:asc", "Fecha (más antigua primero)"],
  ["indice:desc", "Índice (mayor a menor)"],
  ["indice:asc", "Índice (menor a mayor)"],
  ["rutina:asc", "Rutina (A–Z)"],
  ["lider:asc", "Líder (A–Z)"],
  ["evaluador:asc", "Evaluador (A–Z)"],
  ["formulario:asc", "Formulario (A–Z)"],
];

/* ------------------------------------------------------------------ */

export default function Estadisticas({ usuario }) {
  const [evals, setEvals] = useState(null);
  const [formularios, setFormularios] = useState([]);
  const [usuarios, setUsuarios] = useState(null); // directorio: quién tiene acceso hoy a la CdR
  const [errorUsuarios, setErrorUsuarios] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [vista, setVista] = useState("registros");
  const [orden, setOrden] = useState({ campo: "fecha", dir: "desc" });
  const [detalleId, setDetalleId] = useState(null);
  const [limite, setLimite] = useState(25);

  useEffect(() => {
    const c1 = listarEvaluacionesEnviadas(setEvals, (e) =>
      setError(
        e.code === "permission-denied" || e.code === "auth/operation-not-allowed"
          ? "Sin permiso para leer las CdR. Revisa en Firebase (formularios-7f89a): login Anónimo y reglas publicadas."
          : `No se pudieron cargar las CdR (${e.code || e.message}).`
      )
    );
    const c2 = listarFormularios(setFormularios, () => {});
    const c3 = listarUsuarios(setUsuarios, () => setErrorUsuarios(true));
    return () => {
      c1();
      c2();
      c3();
    };
  }, []);

  const todas = useMemo(() => evals || [], [evals]);
  // Las listas de filtros no ofrecen rutinas, líderes ni evaluadores que solo existen en CdR anuladas (a menos que se pidan).
  const opts = useMemo(() => opciones(todas.filter((e) => filtros.verAnuladas || !e.anulada)), [todas, filtros.verAnuladas]);
  const filtradas = useMemo(() => filtrar(todas, filtros), [todas, filtros]); // registros: incluye anuladas si se pide
  const paraStats = useMemo(() => filtrar(todas, { ...filtros, verAnuladas: false }), [todas, filtros]); // estadísticas: nunca
  const lista = useMemo(() => ordenar(filtradas, orden.campo, orden.dir), [filtradas, orden]);
  const umbrales = useMemo(() => {
    const ultima = ordenar(todas, "fecha", "desc")[0];
    return { efectiva: ultima?.formulario?.parametros?.umbralEfectiva ?? 85, desarrollo: ultima?.formulario?.parametros?.umbralDesarrollo ?? 70 };
  }, [todas]);

  const cambiarFiltros = (f) => {
    setFiltros(f);
    setLimite(25);
  };

  const detalle = detalleId ? todas.find((e) => e.id === detalleId) : null;
  if (detalle) return <DetalleCdR ev={detalle} onVolver={() => setDetalleId(null)} />;

  function descargar() {
    const blob = new Blob([aCSV(lista)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CdR_${hoyISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="cdr-ejecutar" style={{ maxWidth: 1180 }}>
      {error && <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>}
      {evals === null && !error && <p style={ayuda}>Cargando las CdR…</p>}

      {/* Las pestañas están siempre: el plan se puede definir aunque todavía no haya CdR enviadas */}
      {evals !== null && (
        <>
          <div style={S.tabs}>
            {[["registros", `Registros (${filtradas.length})`], ["analisis", "Análisis"], ["compromisos", "Compromisos"], ["plan", "Plan de evaluadores"]].map(([id, t]) => (
              <button key={id} style={{ ...S.tab, ...(vista === id ? S.tabAct : {}) }} onClick={() => setVista(id)}>{t}</button>
            ))}
          </div>

          {vista === "plan" && <PlanEvaluadores todas={todas} formularios={formularios} usuario={usuario} usuarios={usuarios} errorUsuarios={errorUsuarios} />}

          {vista !== "plan" && todas.length === 0 && (
            <div className="cdr-molde">
              <b>Aún no hay CdR enviadas</b>
              Cuando se envíe la primera aparecerá aquí con sus filtros y estadísticas.
            </div>
          )}

          {vista !== "plan" && todas.length > 0 && (
            <>
              <Filtros opts={opts} filtros={filtros} onCambiar={cambiarFiltros} total={todas.filter((e) => filtros.verAnuladas || !e.anulada).length} mostradas={filtradas.length} />
              {vista === "registros" && (
                <Registros lista={lista} orden={orden} onOrden={setOrden} limite={limite} onMas={() => setLimite((l) => l + 25)} onVer={setDetalleId} onDescargar={descargar} umbrales={umbrales} />
              )}
              {vista === "analisis" && <Analisis lista={paraStats} todas={todas} formularios={formularios} umbrales={umbrales} />}
              {vista === "compromisos" && <Compromisos lista={paraStats} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- Filtros ----------------------------- */

function Filtros({ opts, filtros, onCambiar, total, mostradas }) {
  // En el celular los filtros parten plegados para que se vean los resultados; en el computador, desplegados.
  const [abierto, setAbierto] = useState(() => typeof window === "undefined" || window.innerWidth > 640);
  const activos = Object.keys(FILTROS_VACIOS).filter((k) => filtros[k] !== FILTROS_VACIOS[k]).length;
  const set = (k, v) => onCambiar({ ...filtros, [k]: v });
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);
  const presetActivo = (n) => {
    const r = rangoPreset(n);
    return r.desde === filtros.desde && r.hasta === filtros.hasta;
  };
  const Sel = ({ etiqueta, campo, items }) => (
    <div>
      <label className="ca-label">{etiqueta}</label>
      <select className="rp-select" value={filtros[campo]} onChange={(e) => set(campo, e.target.value)}>
        <option value="">Todos</option>
        {items.map((i) => (typeof i === "string" ? <option key={i} value={i}>{i}</option> : <option key={i.id} value={i.id}>{i.nombre}</option>))}
      </select>
    </div>
  );
  return (
    <div className="ca-card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button style={btn} aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
          Filtros{activos > 0 ? ` (${activos} activo${activos > 1 ? "s" : ""})` : ""} {abierto ? "▴" : "▾"}
        </button>
        {hayFiltros && <button style={btn} onClick={() => onCambiar(FILTROS_VACIOS)}>Limpiar filtros</button>}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--texto-suave)" }}>Mostrando <b>{mostradas}</b> de {total} CdR</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: abierto ? 12 : 0 }}>
        {PRESETS.map(([n, t]) => (
          <button key={n} className="ca-chip" style={{ cursor: "pointer", border: "none", fontWeight: 600, ...(presetActivo(n) ? { background: "var(--verde)", color: "#fff" } : {}) }} onClick={() => onCambiar({ ...filtros, ...rangoPreset(n) })}>
            {t}
          </button>
        ))}
      </div>
      {abierto && (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <div>
          <label className="ca-label">Desde</label>
          <input className="rp-input" type="date" value={filtros.desde} onChange={(e) => set("desde", e.target.value)} />
        </div>
        <div>
          <label className="ca-label">Hasta</label>
          <input className="rp-input" type="date" value={filtros.hasta} onChange={(e) => set("hasta", e.target.value)} />
        </div>
        <Sel etiqueta="Formulario" campo="formularioId" items={opts.formularios} />
        <Sel etiqueta="Rutina" campo="rutina" items={opts.rutinas} />
        <Sel etiqueta="Líder" campo="lider" items={opts.lideres} />
        <Sel etiqueta="Evaluador" campo="evaluador" items={opts.evaluadores} />
        <div>
          <label className="ca-label">Resultado</label>
          <select className="rp-select" value={filtros.clasificacion} onChange={(e) => set("clasificacion", e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ETIQUETA_CLASIFICACION).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="ca-label">Buscar</label>
          <input className="rp-input" placeholder="Rutina, líder o evaluador…" value={filtros.texto} onChange={(e) => set("texto", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        <label style={S.check}><input type="checkbox" checked={filtros.soloCriticos} onChange={(e) => set("soloCriticos", e.target.checked)} /> Solo con crítico en 0</label>
        <label style={S.check}><input type="checkbox" checked={filtros.verAnuladas} onChange={(e) => set("verAnuladas", e.target.checked)} /> Incluir anuladas</label>
      </div>
      </>)}
    </div>
  );
}

/* ----------------------------- Registros --------------------------- */

function Registros({ lista, orden, onOrden, limite, onMas, onVer, onDescargar, umbrales }) {
  const valor = `${orden.campo}:${orden.dir}`;
  const encabezado = (campo, texto) => (
    <th style={{ cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => onOrden({ campo, dir: orden.campo === campo ? (orden.dir === "asc" ? "desc" : "asc") : campo === "fecha" || campo === "indice" ? "desc" : "asc" })}>
      {texto} {orden.campo === campo ? (orden.dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
  const visibles = lista.slice(0, limite);
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 700 }}>Ordenar por</label>
        <select className="rp-select" style={{ maxWidth: 260 }} value={ORDENES.some(([v]) => v === valor) ? valor : ""} onChange={(e) => { const [campo, dir] = e.target.value.split(":"); onOrden({ campo, dir }); }}>
          {!ORDENES.some(([v]) => v === valor) && <option value="">—</option>}
          {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <button style={{ ...btn, marginLeft: "auto" }} disabled={!lista.length} onClick={onDescargar}>Descargar Excel (CSV)</button>
      </div>

      {lista.length === 0 ? (
        <div className="cdr-molde"><b>No hay CdR con estos filtros</b>Prueba ampliando el rango de fechas o limpiando los filtros.</div>
      ) : (
        <table className="ca-tabla cdr-apilada">
          <thead>
            <tr>{encabezado("rutina", "Rutina")}{encabezado("fecha", "Fecha")}{encabezado("lider", "Líder")}{encabezado("evaluador", "Evaluador")}{encabezado("indice", "Índice")}<th>Resultado</th>{encabezado("formulario", "Formulario")}<th></th></tr>
          </thead>
          <tbody>
            {visibles.map((e) => (
              <tr key={e.id} style={e.anulada ? { opacity: 0.55 } : undefined}>
                <td><b>{e.rutinaNombre || "—"}</b>{e.anulada && <span className="ca-pill ca-pill-rojo" style={{ marginLeft: 8 }}>Anulada</span>}</td>
                <td data-label="Fecha">{fechaCorta(fechaCdR(e))}</td>
                <td data-label="Líder">{e.lider || "—"}</td>
                <td data-label="Evaluador">{e.evaluadorNombre || "—"}</td>
                <td data-label="Índice"><b style={{ color: colorDe(e.resultado?.indice ?? 0, umbrales) }}>{fmt(e.resultado?.indice)}%</b></td>
                <td data-label="Resultado">
                  <span className={`ca-pill ${CLASE[e.resultado?.clasificacion] || ""}`}>{ETIQUETA_CLASIFICACION[e.resultado?.clasificacion] || "—"}</span>
                  {(e.resultado?.criticosEnCero || []).length > 0 && <span className="ca-pill ca-pill-rojo" style={{ marginLeft: 6 }}>Crítico {e.resultado.criticosEnCero.join(", ")}</span>}
                </td>
                <td data-label="Formulario" style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{e.formulario?.nombre || "—"}</td>
                <td style={{ textAlign: "right" }}><button style={btn} onClick={() => onVer(e.id)}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lista.length > limite && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button style={btn} onClick={onMas}>Mostrar más ({lista.length - limite} restantes)</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Detalle de una CdR ----------------------- */

function DetalleCdR({ ev, onVolver }) {
  async function anular() {
    const motivo = window.prompt("Motivo para anular esta CdR (por ejemplo: prueba). No se borra: deja de contar en las estadísticas y se puede restaurar.", "Prueba");
    if (motivo === null) return;
    try {
      await anularEvaluacion(ev.id, motivo);
    } catch (e) {
      window.alert(e.code === "permission-denied" ? "No se pudo anular: falta publicar las reglas nuevas de Firestore (están en el archivo firestore.rules de la entrega)." : `No se pudo anular (${e.code || e.message}).`);
    }
  }
  async function restaurar() {
    try {
      await restaurarEvaluacion(ev.id);
    } catch (e) {
      window.alert(`No se pudo restaurar (${e.code || e.message}).`);
    }
  }
  return (
    <div className="cdr-ejecutar" style={{ maxWidth: 900 }}>
      {ev.anulada && (
        <div className="cdr-aviso" style={{ background: "#fde8e4", color: "#8a2c12", borderColor: "#f1c0b4" }}>
          Esta CdR está anulada y no cuenta en las estadísticas.{ev.anuladaMotivo ? ` Motivo: ${ev.anuladaMotivo}.` : ""}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {ev.anulada ? <button key="restaurar" style={btn} onClick={restaurar}>Restaurar esta CdR</button> : <button key="anular" style={btnPel} onClick={anular}>Anular esta CdR</button>}
      </div>
      <Ejecutar key={ev.id} evaluacionInicial={ev} onCerrar={onVolver} textoVolver="← Volver a Estadísticas" />
    </div>
  );
}

/* ------------------------------ Análisis --------------------------- */

function Analisis({ lista, todas, formularios, umbrales }) {
  const [verTodosCriterios, setVerTodosCriterios] = useState(false);
  const k = kpis(lista);
  if (!lista.length) return <div className="cdr-molde"><b>No hay CdR con estos filtros</b>Amplía el rango de fechas o limpia los filtros para ver el análisis.</div>;
  const dist = distribucion(lista);
  const tend = tendencia(lista);
  const criterios = porCriterio(lista);
  const verCriterios = verTodosCriterios ? criterios : criterios.slice(0, 8);
  const cob = cobertura(formularios, todas, lista);
  const filas = (arr, sub) => arr.map((x) => ({ clave: x.clave, valor: x.promedio, sub: sub ? sub(x) : "" }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Kpi titulo="CdR realizadas" valor={k.n} sub={`${k.rutinas} rutina(s) · ${k.lideres} líder(es)`} />
        <Kpi titulo="Índice promedio" valor={`${fmt(k.promedio)}%`} color={colorDe(k.promedio, umbrales)} />
        <Kpi titulo="Rutinas efectivas" valor={`${fmt(k.pctEfectiva)}%`} sub={`≥ ${umbrales.efectiva}% y sin crítico en 0`} />
        <Kpi titulo="Con crítico en 0" valor={`${fmt(k.pctCritico)}%`} color={k.pctCritico > 0 ? COLOR.malo : undefined} />
      </div>

      <Tarjeta titulo={`Tendencia del índice promedio (por ${tend.agrupacion})`}>
        <GraficoTendencia puntos={tend.puntos} umbrales={umbrales} />
      </Tarjeta>

      <Tarjeta titulo="Distribución de resultados">
        <Distribucion dist={dist} total={k.n} />
      </Tarjeta>

      <Tarjeta titulo="Nota promedio por bloque">
        <BarrasH filas={filas(porBloque(lista), (x) => `n=${x.n}`)} umbrales={umbrales} />
      </Tarjeta>

      <Tarjeta titulo="Por rutina">
        <BarrasH filas={filas(promedioPor(lista, (e) => e.rutinaNombre), (x) => `${x.n} CdR`)} umbrales={umbrales} />
      </Tarjeta>

      <Tarjeta titulo="Por líder">
        <BarrasH filas={filas(promedioPor(lista, (e) => e.lider), (x) => `${x.n} CdR`)} umbrales={umbrales} />
      </Tarjeta>

      <Tarjeta titulo="Por evaluador" nota="Sirve para ver si hay evaluadores más exigentes o más generosos que el resto.">
        <BarrasH filas={filas(promedioPor(lista, (e) => e.evaluadorNombre), (x) => `${x.n} CdR`)} umbrales={umbrales} />
      </Tarjeta>

      <Tarjeta titulo="Criterios: de más débil a más fuerte" nota="Cumplimiento promedio (2 = 100%, 1 = 50%, 0 = 0%; N/A no cuenta). ★ = criterio crítico.">
        <BarrasH filas={verCriterios.map((c) => ({ clave: `${c.critico ? "★ " : ""}${c.clave}`, valor: c.cumplimiento, sub: `${c.pctCero}% en 0 · n=${c.n}` }))} umbrales={umbrales} />
        {criterios.length > 8 && (
          <button style={{ ...btn, marginTop: 12 }} onClick={() => setVerTodosCriterios((v) => !v)}>{verTodosCriterios ? "Ver solo los 8 más débiles" : `Ver los ${criterios.length} criterios`}</button>
        )}
      </Tarjeta>

      <Tarjeta titulo="Cobertura de rutinas" nota="Primero las rutinas que nunca se evaluaron y luego las que llevan más tiempo sin una CdR. La última CdR se mira en todo el historial; la columna del período respeta los filtros.">
        <table className="ca-tabla cdr-apilada">
          <thead><tr><th>Rutina</th><th>Líder(es)</th><th>CdR en el período</th><th>Última CdR</th><th>Hace</th><th>Último índice</th></tr></thead>
          <tbody>
            {cob.map((r) => (
              <tr key={r.nombre}>
                <td><b>{r.nombre}</b></td>
                <td data-label="Líder(es)">{r.lideres.join(", ") || "—"}</td>
                <td data-label="CdR en el período">{r.enPeriodo}</td>
                <td data-label="Última CdR">{r.ultima ? fechaCorta(r.ultima) : <span className="ca-pill ca-pill-rojo">Nunca evaluada</span>}</td>
                <td data-label="Hace">{r.dias === null ? "—" : `${r.dias} día(s)`}</td>
                <td data-label="Último índice">{r.ultimoIndice === null ? "—" : `${fmt(r.ultimoIndice)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}

function Kpi({ titulo, valor, sub, color }) {
  return (
    <div className="ca-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--texto-suave)" }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || "var(--texto)" }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>{sub}</div>}
    </div>
  );
}

function Tarjeta({ titulo, nota, children }) {
  return (
    <div className="ca-card">
      <p style={{ fontWeight: 800, fontSize: 15, margin: nota ? "0 0 2px" : "0 0 12px" }}>{titulo}</p>
      {nota && <p style={{ ...ayuda, margin: "0 0 12px" }}>{nota}</p>}
      {children}
    </div>
  );
}

function BarrasH({ filas, umbrales }) {
  return (
    <div style={{ display: "grid", gap: 11 }}>
      {filas.map((f) => (
        <div key={f.clave}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              {f.clave}
              {f.sub && <span style={{ color: "var(--texto-suave)" }}> · {f.sub}</span>}
            </span>
            <b style={{ whiteSpace: "nowrap" }}>{fmt(f.valor)}%</b>
          </div>
          <div style={{ height: 10, background: "var(--fondo)", borderRadius: 6, marginTop: 3 }}>
            <div style={{ width: `${Math.max(0, Math.min(100, f.valor))}%`, height: "100%", borderRadius: 6, background: colorDe(f.valor, umbrales) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Distribucion({ dist, total }) {
  const items = [["efectiva", "Rutina efectiva", COLOR.bueno], ["desarrollo", "En desarrollo", COLOR.medio], ["intervencion", "Requiere intervención", COLOR.malo]];
  return (
    <div>
      <div style={{ display: "flex", height: 24, borderRadius: 8, overflow: "hidden", background: "var(--fondo)" }}>
        {items.map(([k, t, c]) => dist[k] > 0 && <div key={k} title={`${t}: ${dist[k]}`} style={{ width: `${(dist[k] * 100) / total}%`, background: c }} />)}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 13.5 }}>
        {items.map(([k, t, c]) => (
          <span key={k}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c, marginRight: 6 }} />{t}: <b>{dist[k]}</b> ({fmt((dist[k] * 100) / total)}%)</span>
        ))}
      </div>
    </div>
  );
}

function GraficoTendencia({ puntos, umbrales }) {
  const W = 640, H = 230, pad = { l: 34, r: 14, t: 16, b: 38 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (puntos.length === 1 ? iw / 2 : (i * iw) / (puntos.length - 1));
  const y = (v) => pad.t + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  const salto = Math.ceil(puntos.length / 8);
  const linea = { stroke: "var(--borde)", strokeWidth: 1 };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Tendencia del índice promedio">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} style={linea} />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--texto-suave)" }}>{v}</text>
        </g>
      ))}
      {[[umbrales.efectiva, COLOR.bueno], [umbrales.desarrollo, COLOR.medio]].map(([v, c]) => (
        <line key={v} x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} strokeDasharray="5 4" strokeWidth="1.3" style={{ stroke: c }} />
      ))}
      {puntos.length > 1 && <polyline fill="none" strokeWidth="2.5" points={puntos.map((p, i) => `${x(i)},${y(p.promedio)}`).join(" ")} style={{ stroke: "var(--verde)" }} />}
      {puntos.map((p, i) => (
        <g key={p.clave}>
          <circle cx={x(i)} cy={y(p.promedio)} r="4.5" style={{ fill: "var(--verde)" }} />
          <text x={x(i)} y={y(p.promedio) - 9} textAnchor="middle" fontSize="11.5" fontWeight="700" style={{ fill: "var(--texto)" }}>{fmt(p.promedio)}</text>
          {i % salto === 0 && <text x={x(i)} y={H - 18} textAnchor="middle" fontSize="11" style={{ fill: "var(--texto-suave)" }}>{p.etiqueta}</text>}
          {i % salto === 0 && <text x={x(i)} y={H - 5} textAnchor="middle" fontSize="10" style={{ fill: "var(--texto-suave)" }}>n={p.n}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ----------------------------- Compromisos ------------------------- */

const CLASE_ESTADO = { Vencido: "ca-pill-rojo", Pendiente: "ca-pill-ambar", Cumplido: "ca-pill-verde", Parcial: "ca-pill-ambar", "No cumplido": "ca-pill-rojo", Revisado: "" };

function Compromisos({ lista }) {
  const [estado, setEstado] = useState("");
  const todos = compromisos(lista);
  const cuenta = (e) => todos.filter((c) => c.estado === e).length;
  const vistos = estado ? todos.filter((c) => c.estado === estado) : todos;
  if (!todos.length) return <div className="cdr-molde"><b>No hay compromisos de mejora en este período</b>Aparecen cuando una CdR enviada registra un compromiso con el líder.</div>;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <span className="ca-pill ca-pill-rojo">Vencidos: {cuenta("Vencido")}</span>
        <span className="ca-pill ca-pill-ambar">Pendientes: {cuenta("Pendiente")}</span>
        <span className="ca-pill ca-pill-verde">Cumplidos: {cuenta("Cumplido")}</span>
        <select className="rp-select" style={{ maxWidth: 200, marginLeft: "auto" }} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {["Vencido", "Pendiente", "Cumplido", "Parcial", "No cumplido", "Revisado"].map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <table className="ca-tabla cdr-apilada">
        <thead><tr><th>Rutina</th><th>Líder</th><th>Compromiso</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead>
        <tbody>
          {vistos.map((c) => (
            <tr key={c.id}>
              <td><b>{c.rutina}</b></td>
              <td data-label="Líder">{c.lider}</td>
              <td className="cdr-libre" data-label="Compromiso" style={{ whiteSpace: "pre-wrap" }}>{c.accion}</td>
              <td data-label="Responsable">{c.responsable}</td>
              <td data-label="Fecha límite">{c.fecha ? fechaCorta(c.fecha) : "—"}</td>
              <td data-label="Estado"><span className={`ca-pill ${CLASE_ESTADO[c.estado] || ""}`}>{c.estado}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Estilos ---------------------------- */

const ayuda = { fontSize: 13.5, color: "var(--texto-suave)", margin: "0 0 12px" };
const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnPel = { ...btn, color: "var(--rojo)", borderColor: "#e8b7a8" };
const S = {
  tabs: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid var(--borde)", marginBottom: 14 },
  tab: { background: "none", border: "none", borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: "transparent", padding: "9px 14px", fontSize: 14.5, fontWeight: 700, color: "var(--texto-suave)", cursor: "pointer" },
  tabAct: { color: "var(--verde-oscuro)", borderBottomColor: "var(--verde)" },
  check: { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, cursor: "pointer" },
};
