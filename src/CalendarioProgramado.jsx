import { useEffect, useState } from "react";
import { hechasEnAsignacion, hoyLocalISO, etiquetaCadencia } from "./asignaciones.js";
import { useConfirmarConClave } from "./ConfirmarConClave.jsx";

// Calendario de una asignación, con formato "ejecutivo" para mostrar o sacar pantallazo:
//  - Programado al azar: cada día con quién le toca y si ya está hecha (✓), atrasada, hoy o por venir.
//    Con «Mover días» (pide clave) se arrastra o toca un nombre para cambiarlo de día.
//  - Otras frecuencias (semanal, mensual…): las evaluaciones hechas, en el día en que se hicieron.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// Un color por persona (suaves, distinguibles entre sí).
const COLORES = ["#0F6E56", "#2F5FA3", "#8A4FB0", "#C04F15", "#B8860B", "#0E7C86", "#A23B6B", "#4E6E2E", "#6B5B95", "#9C5B2E", "#2E6E8E", "#7A6A1F"];
const ESTADO = {
  hecha: { etiqueta: "Hecha", fondo: "#E1F5EE", texto: "#0F6E56" },
  atrasada: { etiqueta: "Atrasada", fondo: "#FAECE7", texto: "#993C1D" },
  hoy: { etiqueta: "Hoy", fondo: "#FAEEDA", texto: "#8A5A12" },
  futura: { etiqueta: "Por venir", fondo: "#F1EFE8", texto: "#5F5E5A" },
};
const corto = (n) => { const p = String(n || "").trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : p[0] || ""; };
const iniciales = (n) => String(n || "").trim().split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "6px 11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const ddmm = (f) => String(f || "").split("-").reverse().slice(0, 2).join("-");

export default function CalendarioProgramado({ asignacion, evals, usuario = null, onGuardar = null, formularioNombre = "", onAnclar = null, pedirAnclaje = false, patioDe = null }) {
  const hoy = hoyLocalISO();
  const [modalClave, pedirClave] = useConfirmarConClave(usuario);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [elegido, setElegido] = useState(null); // { clave, fecha }
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [vista, setVista] = useState("calendario"); // "calendario" | "gantt"
  const [anclando, setAnclando] = useState(false);
  // Al anclar se pide el horario en que aparece en el calendario (parte con el de la reunión, si lo tiene).
  const [horario, setHorario] = useState(null); // { inicio, fin } mientras se elige
  const pedirHorario = () => setHorario({
    inicio: asignacion.calendarioHorario?.inicio || asignacion.horaInicio || "09:00",
    fin: asignacion.calendarioHorario?.fin || asignacion.horaFin || "10:00",
    // Sin días sorteados: qué días de la semana se muestra (lunes a viernes por defecto).
    dias: asignacion.calendarioHorario?.dias?.length ? asignacion.calendarioHorario.dias : [1, 2, 3, 4, 5],
    sinHorario: asignacion.calendarioHorario ? !!asignacion.calendarioHorario.sinHorario : !programada,
  });
  // Abierto desde «📌 Anclar» en la lista: parte mostrando el horario a elegir.
  useEffect(() => { if (pedirAnclaje && onAnclar) pedirHorario(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function anclar(si, h = null) {
    if (si && h && !h.sinHorario && !(h.inicio && h.fin && h.fin > h.inicio)) return setAviso("La hora de término debe ser después de la de inicio.");
    setAnclando(true);
    try {
      await onAnclar(si, h);
      setHorario(null);
      setAviso(si ? "✓ Anclado: estas fechas aparecen en el Calendario Ejecutivo del portal y se actualizan solas." : "✓ Quitado del Calendario Ejecutivo.");
    } catch (e) {
      setAviso(`No se pudo ${si ? "anclar" : "quitar"} (${e.code || e.message}).`);
    } finally {
      setAnclando(false);
    }
  }
  const claveDe = (p) => p.uid || `n:${p.nombre}`;
  const base = editando && borrador ? borrador : asignacion.personas || [];
  const programada = base.some((p) => (p.fechas || []).length);
  const personas = base.filter((p) => !programada || (p.fechas || []).length);
  const color = Object.fromEntries(personas.map((p, i) => [claveDe(p), COLORES[i % COLORES.length]]));

  const items = personas.flatMap((p) => {
    if (programada && (p.fechas || []).length) {
      const hechas = new Set(hechasEnAsignacion(asignacion, p, evals, "programada").map((h) => h.periodo));
      return (p.fechas || []).map((f) => ({ fecha: f, patio: patioDe ? patioDe(p, f) : "", nombre: p.nombre, clave: claveDe(p), estado: hechas.has(f) ? "hecha" : f < hoy ? "atrasada" : f === hoy ? "hoy" : "futura" }));
    }
    // Sin programación: cada evaluación hecha, en su día.
    return hechasEnAsignacion(asignacion, p, evals, p.frecuencia || "semanal").map((h) => ({ fecha: String(h.fecha).slice(0, 10), nombre: p.nombre, clave: claveDe(p), estado: "hecha" }));
  });
  const mesesConDatos = [...items.map((i) => i.fecha.slice(0, 7)), hoy.slice(0, 7)].sort();
  // Todos los meses entre el primero y el último con datos (aunque alguno quede vacío), para poder recorrerlos.
  const meses = (() => {
    const out = [];
    let [y, m] = mesesConDatos[0].split("-").map(Number);
    const fin = mesesConDatos[mesesConDatos.length - 1];
    while (`${y}-${String(m).padStart(2, "0")}` <= fin && out.length < 60) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
    return out;
  })();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const offset = (new Date(a, m - 1, 1).getDay() + 6) % 7; // lunes primero
  const diasMes = new Date(a, m, 0).getDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const isoDia = (d) => `${mes}-${String(d).padStart(2, "0")}`;
  const delDia = (d) => items.filter((i) => i.fecha === isoDia(d) && (!soloPendientes || i.estado !== "hecha"));
  const delMes = items.filter((i) => i.fecha.startsWith(mes));
  const n = (e) => delMes.filter((i) => i.estado === e).length;
  const exigidoMes = delMes.filter((i) => i.estado !== "futura").length;
  const cumplimiento = programada && exigidoMes ? Math.round((n("hecha") * 100) / exigidoMes) : null;
  const moverMes = (k) => { const i = meses.indexOf(mes); const x = meses[i + k]; if (x) setMes(x); };

  const movible = (it) => editando && it.estado !== "hecha" && it.fecha >= hoy;
  function moverA(destino) {
    if (!elegido || destino < hoy || destino === elegido.fecha) return setElegido(null);
    const p = borrador.find((x) => claveDe(x) === elegido.clave);
    if ((p?.fechas || []).includes(destino)) { setAviso(`${p.nombre} ya tiene ese día.`); return setElegido(null); }
    setBorrador((b) => b.map((x) => (claveDe(x) === elegido.clave ? { ...x, fechas: [...x.fechas.filter((f) => f !== elegido.fecha), destino].sort() } : x)));
    setAviso("");
    setElegido(null);
  }
  function eliminarElegido() {
    if (!elegido) return;
    const p = borrador.find((x) => claveDe(x) === elegido.clave);
    if (!p) return setElegido(null);
    setBorrador((b) => b.map((x) => (claveDe(x) === elegido.clave ? { ...x, fechas: (x.fechas || []).filter((f) => f !== elegido.fecha) } : x)));
    setAviso(`Se quitó ${p.nombre} del ${ddmm(elegido.fecha)} (se aplica al guardar).`);
    setElegido(null);
  }
  async function empezarEdicion() {
    if (!(await pedirClave("Mover o eliminar días del calendario", "Para mover o eliminar la asignación de un día confirma con tu clave."))) return;
    setBorrador(JSON.parse(JSON.stringify(asignacion.personas || [])));
    setEditando(true);
    setAviso("");
  }
  async function guardar() {
    setGuardando(true);
    try {
      await onGuardar(borrador);
      setEditando(false);
      setBorrador(null);
      setAviso("✓ Calendario guardado.");
    } catch (e) {
      setAviso(`No se pudo guardar (${e.code || e.message}).`);
    } finally {
      setGuardando(false);
    }
  }
  const cambios = editando && borrador && JSON.stringify(borrador.map((p) => p.fechas || [])) !== JSON.stringify((asignacion.personas || []).map((p) => p.fechas || []));

  const plan = asignacion.planComun || (asignacion.personas || [])[0] || {};
  const reglas = programada
    ? `${etiquetaCadencia(plan.cantidad || 1, "programada", plan.hasta || plan.hastaProgramado || "", plan.base)}${(plan.dias || []).length === 7 ? " · todos los días" : (plan.dias || []).length ? ` · ${[[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"], [6, "Sáb"], [0, "Dom"]].filter(([i]) => (plan.dias || []).includes(i)).map(([, t]) => t).join(", ")}` : ""}`
    : etiquetaCadencia(plan.cantidad || 1, plan.frecuencia || "semanal", plan.frecuencia === "unica" ? plan.hasta : "");

  const Chip = ({ it, ancho = false }) => {
    const sel = elegido && elegido.clave === it.clave && elegido.fecha === it.fecha;
    const c = color[it.clave];
    const est = ESTADO[it.estado];
    return (
      <div
        draggable={movible(it)}
        onDragStart={() => setElegido({ clave: it.clave, fecha: it.fecha })}
        onClick={(e) => { if (!movible(it)) return; e.stopPropagation(); setElegido(sel ? null : { clave: it.clave, fecha: it.fecha }); }}
        title={`${it.nombre} · ${ddmm(it.fecha)}${it.patio ? ` · ${it.patio}` : ""} · ${est.etiqueta}`}
        style={{ display: "flex", alignItems: "center", gap: 4, background: it.estado === "hecha" ? c : "#fff", color: it.estado === "hecha" ? "#fff" : "#2C2C2A", border: `1.5px solid ${it.estado === "atrasada" ? "#C0392B" : it.estado === "hoy" ? "#D69A2D" : c}`, borderRadius: 6, padding: "2px 5px", fontSize: 11.5, fontWeight: 700, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: movible(it) ? "grab" : "default", maxWidth: ancho ? "none" : "100%", ...(sel ? { boxShadow: "0 0 0 2px #009899" } : {}) }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: it.estado === "hecha" ? "#fff" : c, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{it.estado === "hecha" ? "✓ " : it.estado === "atrasada" ? "! " : ""}{corto(it.nombre)}{it.patio ? <span style={{ fontWeight: 500, opacity: 0.85 }}> · {it.patio.includes(": ") ? it.patio.split(": ").slice(1).join(": ") : it.patio}</span> : null}</span>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 10 }}>
      {modalClave}
      {/* Controles (fuera del área para pantallazo) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button style={btn} onClick={() => moverMes(-1)} disabled={meses.indexOf(mes) <= 0} aria-label="Mes anterior">‹</button>
        <button style={btn} onClick={() => moverMes(1)} disabled={meses.indexOf(mes) >= meses.length - 1} aria-label="Mes siguiente">›</button>
        <div style={{ display: "flex", border: "1px solid var(--borde, #D3D1C7)", borderRadius: 8, overflow: "hidden" }}>
          {[["calendario", "📅 Calendario"], ["gantt", "▤ Gantt"]].map(([v, t]) => (
            <button key={v} type="button" onClick={() => setVista(v)} style={{ border: "none", padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: vista === v ? "var(--verde, #009899)" : "#fff", color: vista === v ? "#fff" : "inherit" }}>{t}</button>
          ))}
        </div>
        {programada && <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}><input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Ocultar las hechas</label>}
        <span style={{ flex: 1 }} />
        {onAnclar && !editando && (
          asignacion.anclarCalendario
            ? <>
                <button type="button" style={{ ...btn, background: "#EEE9FB", borderColor: "#6D28D9", color: "#5B21B6" }} disabled={anclando} onClick={pedirHorario} title="Cambiar el horario con que aparece en el Calendario Ejecutivo">📌 Calendario ejecutivo{asignacion.calendarioHorario?.sinHorario ? " · sin horario" : asignacion.calendarioHorario?.inicio ? ` · ${asignacion.calendarioHorario.inicio}–${asignacion.calendarioHorario.fin}` : ""}</button>
                <button type="button" style={btn} disabled={anclando} onClick={() => anclar(false)} title="Quitar del Calendario Ejecutivo del portal">Quitar</button>
              </>
            : <button type="button" style={btn} disabled={anclando} onClick={pedirHorario} title="Muestra estas fechas en el Calendario Ejecutivo del portal">📌 Anclar a calendario ejecutivo</button>
        )}
        {programada && onGuardar && !editando && <button type="button" style={btn} onClick={empezarEdicion}>✋ Mover o eliminar días (pide clave)</button>}
        {editando && <>
          <button type="button" style={{ ...btn, background: "var(--verde, #009899)", color: "#fff", borderColor: "var(--verde, #009899)" }} disabled={!cambios || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
          <button type="button" style={btn} disabled={guardando} onClick={() => { setEditando(false); setBorrador(null); setElegido(null); setAviso(""); }}>Cancelar</button>
        </>}
      </div>
      {horario && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", margin: "0 0 10px", padding: "10px 12px", background: "#F6F3FD", border: "1px solid #CFC3F2", borderRadius: 10 }}>
          <div style={{ flex: "1 1 220px", fontSize: 13, color: "#3B2A6B" }}>
            <b>¿En qué horario aparece en el Calendario Ejecutivo?</b>
            <div style={{ fontSize: 12, color: "#6B5F86" }}>{programada ? "Se muestra en cada día programado, con quién evalúa." : "Se muestra arriba de cada día de su periodo (ej. «1 asignación · jue 19 – dom 22»), con quién evalúa y qué le toca."}</div>
          </div>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: "#3B2A6B", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", alignSelf: "center" }}>
            <input type="checkbox" checked={!!horario.sinHorario} onChange={(e) => setHorario({ ...horario, sinHorario: e.target.checked })} /> Sin horario (arriba del día)
          </label>
          {!horario.sinHorario && <>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#3B2A6B" }}>Desde<br />
              <input type="time" step="1800" value={horario.inicio} onChange={(e) => setHorario({ ...horario, inicio: e.target.value })} style={{ fontSize: 14, padding: "5px 6px", border: "1px solid #CFC3F2", borderRadius: 8 }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#3B2A6B" }}>Hasta<br />
              <input type="time" step="1800" value={horario.fin} onChange={(e) => setHorario({ ...horario, fin: e.target.value })} style={{ fontSize: 14, padding: "5px 6px", border: "1px solid #CFC3F2", borderRadius: 8 }} />
            </label>
          </>}
          <button type="button" style={{ ...btn, background: "#6D28D9", borderColor: "#6D28D9", color: "#fff" }} disabled={anclando} onClick={() => anclar(true, horario)}>{anclando ? "Guardando…" : asignacion.anclarCalendario ? "Guardar horario" : "📌 Anclar"}</button>
          <button type="button" style={btn} disabled={anclando} onClick={() => setHorario(null)}>Cancelar</button>
        </div>
      )}
      {editando && <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600, color: "#8A5A12" }}>Modo mover: arrastra un nombre a otro día, o tócalo y luego toca el día (en Gantt, la casilla de su fila). Solo lo que no está hecho, a hoy o después.</p>}
      {editando && elegido && (() => { const p = (borrador || []).find((x) => claveDe(x) === elegido.clave); return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 10px", padding: "8px 12px", background: "#FFF6E5", border: "1px solid #E8C879", borderRadius: 10, fontSize: 13 }}>
          <span><b>{p?.nombre}</b> · {ddmm(elegido.fecha)} — toca otro día para moverla, o:</span>
          <button type="button" style={{ ...btn, background: "#C0392B", borderColor: "#C0392B", color: "#fff" }} onClick={eliminarElegido}>🗑 Eliminar solo este día</button>
          <button type="button" style={btn} onClick={() => setElegido(null)}>Cancelar selección</button>
        </div>); })()}
      {aviso && <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: aviso.startsWith("✓") ? "#0F6E56" : "#993C1D" }}>{aviso}</p>}

      {/* Área para pantallazo */}
      <div style={{ background: "#fff", border: "1px solid #E2DFD6", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", padding: "14px 18px", background: "linear-gradient(135deg, #0F6E56 0%, #009899 100%)", color: "#fff" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.85 }}>{formularioNombre || "Plan de evaluadores"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, marginTop: 2 }}>{asignacion.reunionNombre}{asignacion.area ? <span style={{ fontWeight: 500, opacity: 0.85 }}> · {asignacion.area}</span> : null}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
              {(asignacion.lideres || []).length ? `Líderes: ${asignacion.lideres.join(", ")} · ` : ""}{reglas}{asignacion.soloDiaProgramado !== false && (asignacion.personas || []).some((p) => p.frecuencia === "programada") ? " · solo el día programado" : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, textTransform: "capitalize", lineHeight: 1 }}>{MESES[m - 1]} {a}</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
              {cumplimiento !== null && <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>Cumplimiento {cumplimiento}%</span>}
              <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>✓ {n("hecha")} hechas</span>
              {programada && <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{n("atrasada")} atrasadas</span>}
              {programada && <span style={{ background: "rgba(255,255,255,.22)", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{n("futura") + n("hoy")} por venir</span>}
            </div>
          </div>
        </div>

        <div style={{ padding: 14 }}>
          {vista === "gantt" ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 2, fontSize: 11, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left", padding: "2px 10px 2px 0", minWidth: 150, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#5F5E5A" }}>Evaluador</th>
                    {Array.from({ length: diasMes }, (_, i) => {
                      const dia = new Date(a, m - 1, i + 1);
                      return (
                        <th key={i} style={{ minWidth: 24, textAlign: "center", fontWeight: 700, color: isoDia(i + 1) === hoy ? "#8A5A12" : [0, 6].includes(dia.getDay()) ? "#B4B2A9" : "#5F5E5A" }}>
                          <div style={{ fontSize: 10 }}>{"DLMMJVS"[dia.getDay()]}</div><div>{i + 1}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={claveDe(p)}>
                      <td style={{ position: "sticky", left: 0, background: "#fff", fontWeight: 700, fontSize: 12, padding: "2px 10px 2px 0", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: color[claveDe(p)], marginRight: 6 }} />{p.nombre}
                      </td>
                      {Array.from({ length: diasMes }, (_, i) => {
                        const iso = isoDia(i + 1);
                        const it = items.find((x) => x.clave === claveDe(p) && x.fecha === iso && (!soloPendientes || x.estado !== "hecha"));
                        const finde = [0, 6].includes(new Date(a, m - 1, i + 1).getDay());
                        const sel = elegido && elegido.clave === claveDe(p) && elegido.fecha === iso;
                        const destino = editando && elegido && elegido.clave === claveDe(p) && !it && iso >= hoy;
                        const c = color[claveDe(p)];
                        return (
                          <td key={i} onClick={() => { if (!editando) return; if (it && movible(it)) setElegido(sel ? null : { clave: claveDe(p), fecha: iso }); else if (destino) moverA(iso); }}
                            title={it ? `${p.nombre} · ${ddmm(iso)} · ${ESTADO[it.estado].etiqueta}` : ""}
                            style={{ height: 22, borderRadius: 5, textAlign: "center", fontWeight: 800, fontSize: 11, cursor: editando && ((it && movible(it)) || destino) ? "pointer" : "default",
                              ...(it ? { background: it.estado === "hecha" ? c : "#fff", color: it.estado === "hecha" ? "#fff" : c, border: `1.5px solid ${it.estado === "atrasada" ? "#C0392B" : it.estado === "hoy" ? "#D69A2D" : c}` } : { background: destino ? "#E9F6F4" : finde ? "#F4F3EF" : "#FAFAF7" }),
                              ...(sel ? { boxShadow: "0 0 0 2px #009899" } : {}) }}>
                            {it ? (it.estado === "hecha" ? "✓" : it.estado === "atrasada" ? "!" : "•") : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: "#E9E7E0", border: "1px solid #E9E7E0", borderRadius: 10, overflow: "hidden" }}>
              {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((d, i) => (
                <div key={d} style={{ background: "#F7F6F2", fontSize: 11, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: i >= 5 ? "#9A988F" : "#5F5E5A", textAlign: "center", padding: "6px 2px" }}>{d.slice(0, 3)}</div>
              ))}
              {celdas.map((d, i) => {
                const iso = d ? isoDia(d) : "";
                const esHoy = iso === hoy;
                const finde = i % 7 >= 5;
                return (
                  <div key={i}
                    onClick={() => d && elegido && moverA(iso)}
                    onDragOver={(e) => { if (d && editando) e.preventDefault(); }}
                    onDrop={(e) => { e.preventDefault(); if (d && elegido) moverA(iso); }}
                    style={{ minHeight: 78, padding: "5px 6px", cursor: elegido && d ? "pointer" : "default", background: !d ? "#FBFAF7" : elegido && iso >= hoy ? "#F4FBF9" : finde ? "#FCFBF8" : "#fff", boxShadow: esHoy ? "inset 0 0 0 2px #D69A2D" : "none" }}>
                    {d && <div style={{ fontSize: 12, fontWeight: 800, color: esHoy ? "#8A5A12" : finde ? "#9A988F" : "#2C2C2A" }}>{d}{esHoy ? <span style={{ fontSize: 9.5, marginLeft: 4, fontWeight: 800, color: "#8A5A12" }}>HOY</span> : null}</div>}
                    {d && delDia(d).map((it) => <Chip key={it.clave + it.fecha} it={it} />)}
                  </div>
                );
              })}
            </div>
          )}

          {/* Leyenda por persona */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8, marginTop: 12 }}>
            {personas.map((p) => {
              const mias = items.filter((i) => i.clave === claveDe(p));
              const delMesP = mias.filter((i) => i.fecha.startsWith(mes));
              const hechas = delMesP.filter((i) => i.estado === "hecha").length;
              const total = programada ? delMesP.length : hechas;
              const atras = delMesP.filter((i) => i.estado === "atrasada").length;
              const pct = programada && total ? Math.round((hechas * 100) / total) : 0;
              return (
                <div key={claveDe(p)} style={{ border: "1px solid #EEECE6", borderRadius: 10, padding: "7px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 99, background: color[claveDe(p)], color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{iniciales(p.nombre)}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: atras ? "#993C1D" : "#0F6E56" }}>{programada ? `${hechas}/${total}` : `✓ ${hechas}`}</span>
                  </div>
                  {programada && (
                    <div style={{ height: 5, background: "#F1EFE8", borderRadius: 99, marginTop: 6, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color[claveDe(p)] }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 11.5, color: "#5F5E5A" }}>
            <span><b style={{ color: "#0F6E56" }}>✓ relleno</b> = hecha</span>
            {programada && <><span><b style={{ color: "#C0392B" }}>! borde rojo</b> = atrasada</span><span><b style={{ color: "#D69A2D" }}>borde ámbar</b> = hoy</span><span><b>borde de color</b> = por venir</span></>}
            {!programada && <span>Sin programación por días: se muestran las evaluaciones hechas, en el día en que se hicieron.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
