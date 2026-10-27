import { useMemo, useState } from "react";
import { TablaBloques } from "./MisCdR.jsx";
import { ETIQUETA_CLASIFICACION } from "./calculo.js";
import { fechaCdR, claveRutina, norm } from "./estadisticas.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const RANGOS = [["1m", "Mes actual"], ["3m", "3 meses"], ["6m", "6 meses"], ["anio", `Año ${new Date().getFullYear()}`]];
export const VISTA_RESULTADOS_INICIAL = { rango: "1m", formularioId: "", reunion: "" };

const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
const pct = (n) => (n === null || n === undefined ? "—" : `${fmt(n)}%`);

function inicioDelRango(rango, hoy = new Date()) {
  const atras = rango === "3m" ? 2 : rango === "6m" ? 5 : 0;
  const d = rango === "anio" ? new Date(hoy.getFullYear(), 0, 1) : new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function textoRango(rango, hoy = new Date()) {
  if (rango === "1m") return `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
  if (rango === "anio") return `año ${hoy.getFullYear()}`;
  return rango === "3m" ? "últimos 3 meses" : "últimos 6 meses";
}

function umbralesDe(lista) {
  const p = lista.find((e) => e.formulario?.parametros)?.formulario.parametros || {};
  return { efectiva: p.umbralEfectiva ?? 85, desarrollo: p.umbralDesarrollo ?? 70 };
}
function clasificar(prom, u, conCritico) {
  if (prom === null) return "";
  return prom >= u.efectiva && !conCritico ? "efectiva" : prom >= u.desarrollo ? "desarrollo" : "intervencion";
}
function clasePill(c) {
  return c === "efectiva" ? "ca-pill-verde" : c === "desarrollo" ? "ca-pill-ambar" : c === "intervencion" ? "ca-pill-rojo" : "";
}
function promedio(lista) {
  const v = lista.map((e) => e.resultado?.indice).filter((x) => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

/** Nota promedio de cada bloque (con el peso del formulario más reciente) y su aporte al promedio total. */
function bloquesPromedio(lista) {
  const ref = lista[0]?.formulario?.bloques || [];
  const acc = new Map();
  lista.forEach((e) =>
    (e.resultado?.bloques || []).forEach((b) => {
      if (b.puntaje === null || b.puntaje === undefined) return;
      const g = acc.get(b.nombre) || { suma: 0, n: 0 };
      g.suma += b.puntaje;
      g.n += 1;
      acc.set(b.nombre, g);
    })
  );
  const filas = ref.map((b) => {
    const g = acc.get(b.nombre);
    return { nombre: b.nombre, peso: Number(b.peso) || 0, puntaje: g ? g.suma / g.n : null };
  });
  const sumaPesos = filas.filter((f) => f.puntaje !== null).reduce((s, f) => s + f.peso, 0);
  filas.forEach((f) => { f.aporte = f.puntaje !== null && sumaPesos > 0 ? Math.round(((f.peso * f.puntaje) / sumaPesos) * 10) / 10 : 0; });
  const indice = filas.reduce((s, f) => s + f.aporte, 0);
  return { filas, indice };
}

/**
 * Evaluaciones recibidas (con clave): solo las CdR que le hicieron a esta persona como líder.
 * Rango de fechas → formulario → reunión → hoja resumen (promedio, evolución de 12 meses, nota por bloque y cada CdR).
 */
export default function ResultadosQR({ persona, evals, vista, onVista, onVer }) {
  const { rango, formularioId, reunion } = vista;
  const cambiar = (c) => onVista({ ...vista, ...c });
  const yo = norm(persona.nombreUsuario);
  const desde = inicioDelRango(rango);

  // Todas las recibidas (para el gráfico de 12 meses) y las del rango elegido (para el resto).
  const recibidas = useMemo(
    () => (evals || []).filter((e) => e.estado === "enviada" && !e.anulada && norm(e.lider) === yo).sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a))),
    [evals, yo]
  );
  const mias = recibidas.filter((e) => fechaCdR(e) >= desde);

  const formularios = useMemo(() => agrupar(mias, (e) => e.formularioId, (e) => e.formulario?.nombre || "Formulario"), [mias]);
  const delForm = mias.filter((e) => e.formularioId === formularioId);
  const reuniones = useMemo(() => agrupar(delForm, claveRutina, (e) => e.rutinaNombre || "Sin reunión"), [delForm]);
  const deReunion = delForm.filter((e) => claveRutina(e) === reunion);
  const historicoReunion = recibidas.filter((e) => e.formularioId === formularioId && claveRutina(e) === reunion);
  const nombreForm = (delForm[0] || recibidas.find((e) => e.formularioId === formularioId))?.formulario?.nombre || "";
  const nombreReunion = (deReunion[0] || historicoReunion[0])?.rutinaNombre || "";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {RANGOS.map(([v, t]) => (
          <button key={v} type="button" style={chip(rango === v)} onClick={() => cambiar({ rango: v })}>{t}</button>
        ))}
      </div>

      {/* Migas */}
      {formularioId && (
        <div style={{ fontSize: 12.5, margin: "4px 0 10px", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          <button type="button" style={miga} onClick={() => cambiar({ formularioId: "", reunion: "" })}>Formularios</button>
          <span style={gris}>›</span>
          {reunion ? (
            <>
              <button type="button" style={miga} onClick={() => cambiar({ reunion: "" })}>{nombreForm}</button>
              <span style={gris}>›</span>
              <span style={{ fontWeight: 700 }}>{nombreReunion}</span>
            </>
          ) : (
            <span style={{ fontWeight: 700 }}>{nombreForm}</span>
          )}
        </div>
      )}

      {!formularioId && (
        <Lista
          titulo={`Evaluaciones recibidas · ${textoRango(rango)}`}
          vacio="Nadie te evaluó como líder en este periodo."
          grupos={formularios}
          onElegir={(g) => cambiar({ formularioId: g.clave })}
        />
      )}
      {formularioId && !reunion && (
        <Lista titulo="Elige la reunión" vacio="Sin evaluaciones de este formulario en el periodo." grupos={reuniones} onElegir={(g) => cambiar({ reunion: g.clave })} />
      )}
      {formularioId && reunion && (
        <HojaResumen lista={deReunion} historico={historicoReunion} rango={rango} nombreForm={nombreForm} nombreReunion={nombreReunion} onVer={onVer} />
      )}
    </div>
  );
}

function agrupar(lista, fnClave, fnNombre) {
  const m = new Map();
  lista.forEach((e) => {
    const k = fnClave(e) || "—";
    const g = m.get(k) || { clave: k, nombre: fnNombre(e), items: [] };
    g.items.push(e);
    m.set(k, g);
  });
  return [...m.values()]
    .map((g) => {
      const prom = promedio(g.items);
      const u = umbralesDe(g.items);
      return { ...g, n: g.items.length, promedio: prom, clasificacion: clasificar(prom, u, false), ultima: g.items.map(fechaCdR).sort().pop() || "" };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function Lista({ titulo, vacio, grupos, onElegir }) {
  return (
    <div>
      <p style={{ fontWeight: 800, fontSize: 15, margin: "6px 0 8px" }}>{titulo}</p>
      {grupos.length === 0 && <p style={{ ...gris, fontSize: 13, textAlign: "center", padding: "12px 0" }}>{vacio}</p>}
      {grupos.map((g) => (
        <button key={g.clave} type="button" style={fila} onClick={() => onElegir(g)}>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{g.nombre}</div>
            <div style={{ ...gris, fontSize: 12 }}>
              {g.n} CdR · última {g.ultima.split("-").reverse().join("-")}
            </div>
          </div>
          <span className={`ca-pill ${clasePill(g.clasificacion)}`} style={{ fontSize: 13 }}>{pct(g.promedio)}</span>
          <span style={{ ...gris, fontSize: 18 }}>›</span>
        </button>
      ))}
    </div>
  );
}

function HojaResumen({ lista, historico, rango, nombreForm, nombreReunion, onVer }) {
  const u = umbralesDe(lista.length ? lista : historico);
  const prom = promedio(lista);
  const conCritico = lista.filter((e) => (e.resultado?.criticosEnCero || []).length > 0);
  const criticos = [...new Set(conCritico.flatMap((e) => e.resultado.criticosEnCero))].sort();
  const clas = clasificar(prom, u, conCritico.length > 0);
  const { filas, indice } = bloquesPromedio(lista);
  const lideres = [...new Set(lista.map((e) => e.lider).filter(Boolean))];
  const parametros = { umbralEfectiva: u.efectiva, umbralDesarrollo: u.desarrollo };

  return (
    <div>
      <div style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 14, background: "#fff", marginBottom: 14 }}>
        <p style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>{nombreReunion}</p>
        <p style={{ ...gris, fontSize: 12.5, margin: "3px 0 0" }}>
          {nombreForm} · Líder: {lideres.join(", ") || "—"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{pct(prom)}</span>
          {clas && <span className={`ca-pill ${clasePill(clas)}`}>{ETIQUETA_CLASIFICACION[clas]}</span>}
          {criticos.length > 0 && <span className="ca-pill ca-pill-rojo">Crítico en 0: {criticos.join(", ")}</span>}
        </div>
        <p style={{ ...gris, fontSize: 12.5, margin: "8px 0 0" }}>
          {lista.length ? `Promedio de ${lista.length} CdR` : "Sin CdR"} · {textoRango(rango)}
          {conCritico.length > 0 ? ` · ${conCritico.length} con crítico en 0` : ""}
        </p>
        <Evolucion historico={historico} umbrales={u} />
      </div>

      {lista.length > 0 && (
        <>
          <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 8px" }}>Nota por bloque{lista.length > 1 ? " (promedio)" : ""}</p>
          <TablaBloques bloques={filas} parametros={parametros} indice={prom ?? indice} />
        </>
      )}

      <p style={{ fontWeight: 800, fontSize: 15, margin: "16px 0 8px" }}>CdR del periodo ({lista.length})</p>
      {lista.map((e) => {
        const r = e.resultado || {};
        return (
          <button key={e.id} type="button" style={fila} onClick={() => onVer(e)}>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fechaCdR(e).split("-").reverse().join("-")}</div>
              <div style={{ ...gris, fontSize: 12 }}>{ETIQUETA_CLASIFICACION[r.clasificacion] || ""}</div>
            </div>
            <span className={`ca-pill ${clasePill(r.clasificacion)}`} style={{ fontSize: 13 }}>{pct(r.indice)}</span>
            <span style={{ ...gris, fontSize: 18 }}>›</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Evolución por bloque: últimos 12 meses móviles ─────────────────── */

const COLORES_BLOQUE = ["#0f7c74", "#d0821c", "#4f63c9", "#c2457a", "#5a8f2c", "#8a5cc2", "#2b8fbf", "#a8552f"];
const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** Un solo gráfico de líneas: una línea por bloque, nota promedio mes a mes de los últimos 12 meses (no depende del filtro). */
export function Evolucion({ historico, umbrales, hoy = new Date() }) {
  const [elegido, setElegido] = useState(undefined); // undefined = el último mes con datos; null = ninguno
  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1);
    return { clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, etiqueta: MESES_CORTOS[d.getMonth()], anio: d.getFullYear(), mes: d.getMonth() };
  });
  // Bloques en el orden del formulario más reciente.
  const nombres = [];
  [...(historico || [])].forEach((e) => (e.formulario?.bloques || []).forEach((b) => !nombres.includes(b.nombre) && nombres.push(b.nombre)));
  const series = nombres.map((nombre, k) => ({
    nombre,
    color: COLORES_BLOQUE[k % COLORES_BLOQUE.length],
    valores: meses.map((m) => {
      const v = (historico || [])
        .filter((e) => fechaCdR(e).startsWith(m.clave))
        .map((e) => (e.resultado?.bloques || []).find((b) => b.nombre === nombre)?.puntaje)
        .filter((x) => typeof x === "number");
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    }),
  }));
  const conDatos = series.some((s) => s.valores.some((v) => v !== null));
  let ultimo = null;
  meses.forEach((_, i) => { if (series.some((s) => s.valores[i] !== null)) ultimo = i; });
  const mesSel = elegido === undefined ? ultimo : elegido;
  const setMesSel = setElegido;
  // Pequeño corrimiento horizontal por bloque, para que los puntos con la misma nota no se tapen.
  const corrimiento = (k) => (k - (series.length - 1) / 2) * 3;

  const W = 320, H = 150, iz = 28, de = 14, ar = 8, ab = 22;
  const x = (i) => iz + (i * (W - iz - de)) / 11;
  const y = (v) => ar + ((100 - v) * (H - ar - ab)) / 100;

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--borde)", paddingTop: 10 }}>
      <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>Evolución por bloque · últimos 12 meses</p>
      {!conDatos ? (
        <p style={{ ...gris, fontSize: 12.5, margin: 0 }}>Aún no hay evaluaciones para mostrar la evolución.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Evolución de la nota por bloque en los últimos 12 meses">
            {[0, 50, 100].map((v) => (
              <g key={v}>
                <line x1={iz} x2={W - de} y1={y(v)} y2={y(v)} stroke="#e3e9e8" strokeWidth="1" />
                <text x={iz - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="#8a9a98">{v}%</text>
              </g>
            ))}
            {[umbrales.efectiva, umbrales.desarrollo].map((v, k) => (
              <line key={`u${k}`} x1={iz} x2={W - de} y1={y(v)} y2={y(v)} stroke={k === 0 ? "#1b7a46" : "#B5820A"} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.55" />
            ))}
            {mesSel !== null && <rect x={x(mesSel) - 9} y={ar} width="18" height={H - ar - ab} fill="#0f7c74" opacity="0.08" rx="3" />}
            {meses.map((m, i) => (
              <text key={m.clave} x={x(i)} y={H - 8} textAnchor="middle" fontSize="8" fontWeight={mesSel === i ? 700 : 400} fill={mesSel === i ? "#0f4f4a" : "#8a9a98"}>{m.etiqueta}</text>
            ))}
            {series.map((s, k) => {
              // Tramos continuos: un mes sin datos corta la línea.
              const tramos = [];
              let actual = [];
              s.valores.forEach((v, i) => {
                if (v === null) { if (actual.length) tramos.push(actual); actual = []; } else actual.push([x(i) + corrimiento(k), y(v)]);
              });
              if (actual.length) tramos.push(actual);
              return (
                <g key={s.nombre}>
                  {tramos.filter((t) => t.length > 1).map((t, k) => (
                    <polyline key={k} points={t.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                  ))}
                  {s.valores.map((v, i) => v !== null && <circle key={i} cx={x(i) + corrimiento(k)} cy={y(v)} r={mesSel === i ? 3.6 : 2.6} fill={s.color} stroke="#fff" strokeWidth="0.8" />)}
                </g>
              );
            })}
            {meses.map((m, i) => (
              <rect key={`t${m.clave}`} x={x(i) - (W - iz - de) / 22} y={0} width={(W - iz - de) / 11} height={H} fill="transparent" style={{ cursor: "pointer" }} onClick={() => setMesSel(i)} />
            ))}
          </svg>
          <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
            {mesSel !== null && (
              <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 10.5, fontWeight: 700, color: "var(--texto-suave)", letterSpacing: 0.3 }}>
                {MESES_CORTOS[meses[mesSel].mes]} {meses[mesSel].anio}
              </div>
            )}
            {series.map((s) => {
              const v = mesSel !== null ? s.valores[mesSel] : null;
              return (
                <div key={s.nombre} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 14, height: 4, borderRadius: 2, background: s.color, flex: "0 0 auto" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{s.nombre}</span>
                  {mesSel !== null && (
                    <b style={{ color: v === null ? "var(--texto-suave)" : colorNota(v, umbrales), whiteSpace: "nowrap" }}>{v === null ? "—" : `${fmt(v)}%`}</b>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ ...gris, fontSize: 11, margin: "8px 0 0" }}>
            Toca un mes del gráfico para ver la nota de cada bloque. Un corte en la línea es un mes sin evaluaciones.
          </p>
        </>
      )}
    </div>
  );
}

function colorNota(v, u) {
  return v >= u.efectiva ? "#1b7a46" : v >= u.desarrollo ? "#B5820A" : "#b02a26";
}

const gris = { color: "var(--texto-suave)" };
const fila = { display: "flex", alignItems: "center", gap: 10, width: "100%", border: "1px solid var(--borde)", borderRadius: 12, padding: "10px 12px", marginBottom: 8, background: "#fff", cursor: "pointer", fontFamily: "inherit", color: "inherit" };
const miga = { background: "none", border: "none", padding: 0, color: "var(--verde-oscuro)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, textDecoration: "underline" };
function chip(sel) {
  return { padding: "6px 12px", borderRadius: 100, border: `2px solid ${sel ? "var(--verde)" : "var(--borde)"}`, background: sel ? "var(--verde-claro)" : "#fff", color: sel ? "var(--verde-oscuro)" : "var(--texto-suave)", fontWeight: sel ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "inherit" };
}
