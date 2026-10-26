import { useMemo } from "react";
import { TablaBloques } from "./MisCdR.jsx";
import { ETIQUETA_CLASIFICACION } from "./calculo.js";
import { fechaCdR, claveRutina, norm } from "./estadisticas.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const RANGOS = [["1m", "Mes actual"], ["3m", "3 meses"], ["6m", "6 meses"], ["anio", `Año ${new Date().getFullYear()}`]];
export const VISTA_RESULTADOS_INICIAL = { rango: "1m", rol: "hice", formularioId: "", reunion: "" };

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
 * Resultados (con clave): rango de fechas → formulario → reunión → hoja resumen de esa reunión
 * (promedio, clasificación, nota por bloque y cada CdR, que se puede abrir).
 */
export default function ResultadosQR({ persona, evals, vista, onVista, onVer }) {
  const { rango, rol, formularioId, reunion } = vista;
  const cambiar = (c) => onVista({ ...vista, ...c });
  const yo = norm(persona.nombreUsuario);
  const desde = inicioDelRango(rango);

  const delRango = useMemo(
    () => (evals || []).filter((e) => e.estado === "enviada" && !e.anulada && fechaCdR(e) >= desde),
    [evals, desde]
  );
  const hice = (e) => e.evaluadorUid === persona.uid || e.registradoPorUid === persona.uid || norm(e.evaluadorNombre) === yo;
  const meHicieron = (e) => norm(e.lider) === yo;
  const nHice = delRango.filter(hice).length;
  const nMeHicieron = delRango.filter(meHicieron).length;
  const mias = delRango.filter(rol === "hice" ? hice : meHicieron).sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a)));

  const formularios = useMemo(() => agrupar(mias, (e) => e.formularioId, (e) => e.formulario?.nombre || "Formulario"), [mias]);
  const delForm = mias.filter((e) => e.formularioId === formularioId);
  const reuniones = useMemo(() => agrupar(delForm, claveRutina, (e) => e.rutinaNombre || "Sin reunión"), [delForm]);
  const deReunion = delForm.filter((e) => claveRutina(e) === reunion);
  const nombreForm = delForm[0]?.formulario?.nombre || "";
  const nombreReunion = deReunion[0]?.rutinaNombre || "";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {RANGOS.map(([v, t]) => (
          <button key={v} type="button" style={chip(rango === v)} onClick={() => cambiar({ rango: v })}>{t}</button>
        ))}
      </div>
      <div style={segmento}>
        <button type="button" style={segBtn(rol === "hice")} onClick={() => cambiar({ rol: "hice", formularioId: "", reunion: "" })}>Las que hice ({nHice})</button>
        <button type="button" style={segBtn(rol === "lider")} onClick={() => cambiar({ rol: "lider", formularioId: "", reunion: "" })}>Me hicieron como líder ({nMeHicieron})</button>
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
          titulo={`Formularios · ${textoRango(rango)}`}
          vacio={rol === "hice" ? "No enviaste formularios en este periodo." : "Nadie te evaluó como líder en este periodo."}
          grupos={formularios}
          onElegir={(g) => cambiar({ formularioId: g.clave })}
        />
      )}
      {formularioId && !reunion && (
        <Lista titulo="Elige la reunión" vacio="Sin registros de este formulario en el periodo." grupos={reuniones} onElegir={(g) => cambiar({ reunion: g.clave })} />
      )}
      {formularioId && reunion && <HojaResumen lista={deReunion} rol={rol} rango={rango} nombreForm={nombreForm} nombreReunion={nombreReunion} onVer={onVer} />}
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

function HojaResumen({ lista, rol, rango, nombreForm, nombreReunion, onVer }) {
  const u = umbralesDe(lista);
  const prom = promedio(lista);
  const conCritico = lista.filter((e) => (e.resultado?.criticosEnCero || []).length > 0);
  const criticos = [...new Set(conCritico.flatMap((e) => e.resultado.criticosEnCero))].sort();
  const clas = clasificar(prom, u, conCritico.length > 0);
  const { filas, indice } = bloquesPromedio(lista);
  const lideres = [...new Set(lista.map((e) => e.lider).filter(Boolean))];
  const evaluadores = [...new Set(lista.map((e) => e.evaluadorNombre).filter(Boolean))];
  const parametros = { umbralEfectiva: u.efectiva, umbralDesarrollo: u.desarrollo };

  return (
    <div>
      <div style={{ border: "1px solid var(--borde)", borderRadius: 14, padding: 14, background: "#fff", marginBottom: 14 }}>
        <p style={{ fontWeight: 800, fontSize: 17, margin: 0 }}>{nombreReunion}</p>
        <p style={{ ...gris, fontSize: 12.5, margin: "3px 0 0" }}>
          {nombreForm} · Líder: {lideres.join(", ") || "—"} · Evaluó: {evaluadores.join(", ") || "—"}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <span style={{ fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{pct(prom)}</span>
          {clas && <span className={`ca-pill ${clasePill(clas)}`}>{ETIQUETA_CLASIFICACION[clas]}</span>}
          {criticos.length > 0 && <span className="ca-pill ca-pill-rojo">Crítico en 0: {criticos.join(", ")}</span>}
        </div>
        <p style={{ ...gris, fontSize: 12.5, margin: "8px 0 0" }}>
          Promedio de {lista.length} CdR · {textoRango(rango)}
          {conCritico.length > 0 ? ` · ${conCritico.length} con crítico en 0` : ""}
        </p>
      </div>

      <p style={{ fontWeight: 800, fontSize: 15, margin: "0 0 8px" }}>Nota por bloque{lista.length > 1 ? " (promedio)" : ""}</p>
      <TablaBloques bloques={filas} parametros={parametros} indice={prom ?? indice} />

      <p style={{ fontWeight: 800, fontSize: 15, margin: "16px 0 8px" }}>CdR del periodo ({lista.length})</p>
      {lista.map((e) => {
        const r = e.resultado || {};
        return (
          <button key={e.id} type="button" style={fila} onClick={() => onVer(e)}>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{fechaCdR(e).split("-").reverse().join("-")}</div>
              <div style={{ ...gris, fontSize: 12 }}>{rol === "hice" ? `Líder: ${e.lider || "—"}` : `Evaluó: ${e.evaluadorNombre || "—"}`}</div>
            </div>
            <span className={`ca-pill ${clasePill(r.clasificacion)}`} style={{ fontSize: 13 }}>{pct(r.indice)}</span>
            <span style={{ ...gris, fontSize: 18 }}>›</span>
          </button>
        );
      })}
    </div>
  );
}

const gris = { color: "var(--texto-suave)" };
const fila = { display: "flex", alignItems: "center", gap: 10, width: "100%", border: "1px solid var(--borde)", borderRadius: 12, padding: "10px 12px", marginBottom: 8, background: "#fff", cursor: "pointer", fontFamily: "inherit", color: "inherit" };
const miga = { background: "none", border: "none", padding: 0, color: "var(--verde-oscuro)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, textDecoration: "underline" };
const segmento = { display: "flex", background: "var(--fondo)", border: "1px solid var(--borde)", borderRadius: 10, padding: 3, gap: 3, marginBottom: 10 };
function segBtn(sel) {
  return { flex: 1, border: "none", borderRadius: 8, padding: "7px 6px", fontSize: 12.5, fontWeight: sel ? 700 : 600, background: sel ? "#fff" : "transparent", color: sel ? "var(--verde-oscuro)" : "var(--texto-suave)", boxShadow: sel ? "0 1px 3px rgba(0,0,0,0.08)" : "none", cursor: "pointer", fontFamily: "inherit" };
}
function chip(sel) {
  return { padding: "6px 12px", borderRadius: 100, border: `2px solid ${sel ? "var(--verde)" : "var(--borde)"}`, background: sel ? "var(--verde-claro)" : "#fff", color: sel ? "var(--verde-oscuro)" : "var(--texto-suave)", fontWeight: sel ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "inherit" };
}
