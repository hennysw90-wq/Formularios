import { useEffect, useRef, useState } from "react";
import { listarFormulariosPublicados, listarMisEvaluaciones, guardarEvaluacion, buscarCompromisoAnterior, obtenerFormulario, obtenerEvaluacion } from "./evaluaciones.js";
import { listarPersonasAsistencia } from "./firebaseAsistencia.js";
import MiAgenda from "./MiAgenda.jsx";
import { listarAsignaciones, proyectarFormulario, asignacionesDeFormulario } from "./asignaciones.js";
import AvancePlan from "./AvancePlan.jsx";
import logoOems from "./assets/logo-oems.png";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import { nuevoId } from "./formularios.js";
import { calcularResultado, normalizarFormulario, ETIQUETA_CLASIFICACION } from "./calculo.js";

const clonar = (x) => JSON.parse(JSON.stringify(x));
const fmt = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const horaAhora = () => new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });
const fechaLegible = (iso) => (iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const CLASE_RESULTADO = { efectiva: "ca-pill-verde", desarrollo: "ca-pill-ambar", intervencion: "ca-pill-rojo" };

function coincideCriterio(texto, codigo) {
  return (texto || "").split(/[\s·,;/]+/).map((x) => x.trim().toUpperCase()).includes(String(codigo).toUpperCase());
}

/** Copia congelada del formulario: si luego se edita, las CdR ya hechas no cambian. */
function instantanea(f) {
  const n = normalizarFormulario(f);
  return { id: f.id, nombre: n.nombre, descripcion: n.descripcion, version: f.version || 1, parametros: n.parametros, seccionA: n.seccionA, rutinas: n.rutinas, seccionB: n.seccionB, bloques: n.bloques, feedback: n.feedback, evaluadores: (f.asignados || []).map((a) => ({ uid: a.uid, nombre: a.nombre })) };
}

const horarioDeReunion = (r) => (r && r.horaInicio ? (r.horaFin ? `${r.horaInicio} – ${r.horaFin}` : r.horaInicio) : "");

/** Fija la reunión en la evaluación: su nombre, el líder (si hay uno solo) y las horas "según estándar" de su horario. */
function aplicarRutina(c, rutina) {
  c.rutinaSesionId = rutina ? rutina.sesionId : "";
  c.rutinaNombre = rutina ? rutina.nombre : "";
  const l = rutina ? rutina.lideres || [] : [];
  c.lider = l.length === 1 ? l[0] : "";
  if (rutina) {
    c.formulario.seccionA.forEach((campo) => {
      if (campo.tipo !== "hora") return;
      const et = campo.etiqueta.toLowerCase();
      if (/inicio/.test(et) && rutina.horaInicio) c.datos[campo.id] = rutina.horaInicio;
      else if (/(t[eé]rmino|fin)/.test(et) && rutina.horaFin) c.datos[campo.id] = rutina.horaFin;
    });
  }
}

/**
 * Evaluación nueva. Con `rutinaId` (el QR es de UNA reunión) la reunión viene definida y queda bloqueada:
 * quien evalúa no puede cambiarla.
 */
export function nuevaEvaluacion(form, usuario, rutinaId) {
  const sinSesion = !usuario || !usuario.uid; // llegó con el QR sin iniciar sesión
  const ahora = new Date().toISOString();
  const snap = instantanea(form);
  const datos = {};
  snap.seccionA.forEach((c) => {
    if (c.tipo === "fecha" && !/anterior/i.test(c.etiqueta)) datos[c.id] = hoyISO();
  });
  const ev = {
    id: nuevoId("ev"),
    formularioId: form.id,
    formulario: snap,
    sinSesion,
    registradoPorUid: sinSesion ? "" : usuario.uid,
    registradoPorNombre: sinSesion ? "" : usuario.nombreUsuario,
    evaluadorUid: sinSesion ? "" : usuario.uid,
    evaluadorNombre: sinSesion ? "" : usuario.nombreUsuario,
    evaluadorPersonaId: "",
    estado: "borrador",
    paso: 0,
    datos,
    rutinaSesionId: "",
    rutinaNombre: "",
    lider: "",
    notas: [],
    respuestas: {},
    feedback: {
      fortalezas: [],
      oportunidades: [],
      compromiso: { accion: "", responsable: "", fecha: "" },
      seguimiento: "",
      seguimientoComentario: "",
    },
    liderTomoConocimiento: false,
    creado: ahora,
    actualizado: ahora,
  };
  const reunion = rutinaId ? snap.rutinas.find((r) => r.sesionId === rutinaId) : null;
  if (reunion) {
    aplicarRutina(ev, reunion);
    ev.rutinaBloqueada = true;
  }
  return ev;
}

function nivelesDe(ev) {
  const n = {};
  Object.entries(ev.respuestas || {}).forEach(([cod, r]) => {
    if (r && r.nivel !== undefined && r.nivel !== "") n[cod] = r.nivel;
  });
  return n;
}

function erroresDeEnvio(ev, anterior) {
  const f = ev.formulario;
  const errores = [];
  for (const c of f.seccionA) {
    if (!c.obligatorio) continue;
    let v;
    if (c.tipo === "rutina") v = ev.rutinaSesionId;
    else if (c.tipo === "lider") v = ev.lider;
    else if (c.tipo === "evaluador") v = ev.evaluadorNombre;
    else v = ev.datos[c.id];
    if (!v || !String(v).trim()) errores.push(`Falta completar "${c.etiqueta}" (paso 1).`);
  }
  if (!f.seccionA.some((c) => c.tipo === "evaluador" && c.obligatorio) && !(ev.evaluadorNombre || "").trim()) {
    errores.push("Falta indicar quién evalúa (paso 1).");
  }
  // Cada criterio debe tener un nivel; la justificación o comentario es siempre opcional.
  const sinCalificar = [];
  for (const b of f.bloques) {
    for (const c of b.criterios) {
      const r = ev.respuestas[c.codigo];
      if (!r || r.nivel === undefined || r.nivel === "") sinCalificar.push(c.codigo);
    }
  }
  if (sinCalificar.length) errores.push(`Faltan por calificar: ${sinCalificar.join(", ")} (paso 3).`);

  // El feedback es obligatorio: lo que el formulario incluya debe venir completo.
  const fb = f.feedback;
  const F = ev.feedback;
  // La "Situación" es opcional por formulario: solo se exige si el formulario la incluye.
  const incompleto = (it) => !it.criterio || (fb.situacion && !(it.situacion || "").trim()) || !(it.comportamiento || "").trim() || !(it.impacto || "").trim();
  [["fortalezas", "fortaleza"], ["oportunidades", "oportunidad de mejora"]].forEach(([tipo, nombre]) => {
    if (!fb[tipo]) return;
    if (!F[tipo].length) errores.push(`Falta al menos una ${nombre} (paso 4).`);
    F[tipo].forEach((it, i) => {
      if (incompleto(it)) errores.push(`La ${nombre} ${i + 1} está incompleta: necesita ${fb.situacion ? "criterio, situación, comportamiento e impacto" : "criterio, comportamiento e impacto"} (paso 4).`);
    });
  });
  if (fb.compromisoMejora) {
    if (!(F.compromiso.accion || "").trim()) errores.push("Falta la acción del compromiso de mejora (paso 5).");
    if (!F.compromiso.fecha) errores.push("Falta la fecha del compromiso de mejora (paso 5).");
  }
  if (fb.seguimientoAnterior && anterior && !F.seguimiento) {
    errores.push("Falta indicar si se cumplió el compromiso de la CdR anterior (paso 5).");
  }
  return errores;
}

const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Sugerencias para "Evaluador", en este orden: quien inició sesión (si lo hizo), los evaluadores asignados
 * al formulario y los asistentes del directorio de Control de Asistencia. Sin repetir nombres.
 */
function opcionesEvaluador(ev, personas) {
  const vistos = new Set();
  const salida = [];
  const agregar = (o) => {
    const k = norm(o.nombre);
    if (!k || vistos.has(k)) return;
    vistos.add(k);
    salida.push(o);
  };
  const miUid = ev.registradoPorUid || (!ev.sinSesion ? ev.evaluadorUid : "");
  const miNombre = ev.registradoPorNombre || (!ev.sinSesion ? ev.evaluadorNombre : "");
  if (miUid) agregar({ nombre: miNombre, uid: miUid, personaId: "", grupo: "Tú (sesión iniciada)", tu: true });
  (ev.formulario.evaluadores || []).forEach((a) => agregar({ nombre: a.nombre, uid: a.uid, personaId: "", grupo: "Evaluadores asignados al formulario" }));
  (personas || []).forEach((p) => agregar({ nombre: p.nombre, uid: "", personaId: p.id, grupo: "Asistentes (Control de Asistencia)" }));
  return salida;
}

/** Campo de texto con lista desplegable que se filtra al escribir. Acepta también un nombre que no esté en la lista. */
function ComboEvaluador({ valor, opciones, onTexto, onElegir, personas, errorPersonas }) {
  const [abierto, setAbierto] = useState(false);
  const q = norm(valor);
  const filtradas = opciones.filter((o) => !q || norm(o.nombre).includes(q)).slice(0, 40);
  const coincide = opciones.some((o) => norm(o.nombre) === q);
  let ultimoGrupo = "";
  return (
    <div style={{ position: "relative" }}>
      <input
        className="rp-input"
        value={valor}
        autoComplete="off"
        placeholder="Escribe para buscar tu nombre…"
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 180)}
        onChange={(e) => {
          onTexto(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && filtradas.length > 0 && (
        <div style={{ position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%", marginTop: 2, background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 22px rgba(0,0,0,.12)" }}>
          {filtradas.map((o) => {
            const cabecera = o.grupo !== ultimoGrupo ? o.grupo : "";
            ultimoGrupo = o.grupo;
            return (
              <div key={`${o.grupo}-${o.nombre}`}>
                {cabecera && <div style={{ padding: "5px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", background: "var(--fondo)", color: "var(--texto-suave)" }}>{cabecera}</div>}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onElegir(o); setAbierto(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--fondo)", padding: "10px 12px", fontSize: 14, cursor: "pointer" }}>
                  {o.nombre}{o.tu ? " (tú)" : ""}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 12, marginTop: 4, color: valor && !coincide ? "var(--ambar)" : "var(--texto-suave)" }}>
        {errorPersonas ? "No se pudo cargar la lista de asistentes de Asistencia: escribe tu nombre."
          : valor ? (coincide ? "✓ Está en la lista" : "No está en la lista; se guardará tal como lo escribiste.")
          : personas === null ? "Cargando la lista de asistentes…" : "Elige tu nombre de la lista de asistentes."}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lista: "Mis CdR"                                                   */
/* ------------------------------------------------------------------ */

export default function MisCdR({ usuario, formularioDirecto, rutinaDirecta = "", onDirectoAtendido }) {
  const [formularios, setFormularios] = useState(null);
  const [evals, setEvals] = useState(null);
  const [error, setError] = useState("");
  const [ejecutando, setEjecutando] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);
  const esMaster = usuario.rol === "master";

  useEffect(() => {
    const aviso = (e) =>
      setError(
        e.code === "permission-denied" || e.code === "auth/operation-not-allowed"
          ? "Sin permiso para leer datos de la CdR. Revisa en Firebase (formularios-7f89a): login Anónimo y reglas publicadas."
          : `No se pudieron cargar tus datos (${e.code || e.message}).`
      );
    const c1 = listarFormulariosPublicados(setFormularios, aviso);
    const c2 = listarMisEvaluaciones(usuario.uid, setEvals, aviso);
    const c3 = listarAsignaciones(setAsignaciones, () => {});
    return () => {
      c1();
      c2();
      c3();
    };
  }, [usuario.uid]);

  async function descartar(e) {
    if (!window.confirm("¿Descartar este borrador? Dejará de aparecer en tu lista.")) return;
    try {
      await guardarEvaluacion({ ...e, estado: "descartada", actualizado: new Date().toISOString() });
    } catch (err) {
      window.alert(`No se pudo descartar (${err.code || err.message}).`);
    }
  }

  if (ejecutando) {
    return <Ejecutar evaluacionInicial={ejecutando} onCerrar={() => setEjecutando(null)} />;
  }

  // Las reuniones y los evaluadores de cada formulario salen de las asignaciones. Un evaluador solo ve los
  // formularios donde tiene asignaciones, y en cada uno solo sus reuniones; el Master puede probar cualquiera.
  const disponibles = (formularios || [])
    .map((f) => proyectarFormulario(f, asignaciones, esMaster ? null : usuario))
    .filter((f) => esMaster || f.rutinas.length > 0);
  // Un borrador lo ve quien lo registró; una CdR enviada la ven quien la registró y el evaluador elegido.
  const registroMio = (e) => (e.registradoPorUid || e.evaluadorUid) === usuario.uid;
  const enCurso = (evals || []).filter((e) => e.estado === "borrador" && registroMio(e)).sort((a, b) => (b.actualizado || "").localeCompare(a.actualizado || ""));
  const hechas = (evals || []).filter((e) => e.estado === "enviada" && (registroMio(e) || e.evaluadorUid === usuario.uid)).sort((a, b) => (b.fechaEnvio || "").localeCompare(a.fechaEnvio || ""));

  const directoForm = formularioDirecto ? disponibles.find((f) => f.id === formularioDirecto) : null;
  // El QR es de UNA reunión: si trae una y existe en el formulario, la evaluación nace con esa reunión fija.
  const rutinaQR = directoForm && rutinaDirecta ? (directoForm.rutinas || []).find((r) => r.sesionId === rutinaDirecta) || null : null;
  const rutinaQRInvalida = !!(directoForm && rutinaDirecta && !rutinaQR);
  const atendido = () => onDirectoAtendido && onDirectoAtendido();

  return (
    <div className="cdr-ejecutar" style={{ maxWidth: 900 }}>
      {error && <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>}

      <MiAgenda usuario={usuario} compacto onIniciar={(f, reunionId) => setEjecutando(nuevaEvaluacion(f, usuario, reunionId))} />

      {formularioDirecto && (
        <AccesoDirecto
          formularios={formularios}
          form={directoForm}
          rutina={rutinaQR}
          rutinaInvalida={rutinaQRInvalida}
          enCurso={enCurso.filter((e) => e.formularioId === formularioDirecto && (!rutinaQR || e.rutinaSesionId === rutinaQR.sesionId))}
          onIniciar={() => { atendido(); setEjecutando(nuevaEvaluacion(directoForm, usuario, rutinaQR ? rutinaQR.sesionId : undefined)); }}
          onContinuar={(e) => { atendido(); setEjecutando(e); }}
          onCerrar={atendido}
        />
      )}

      <Titulo t="Iniciar una CdR" />
      {formularios === null && !error && <p style={ayuda}>Cargando…</p>}
      {formularios && disponibles.length === 0 && (
        <div className="cdr-molde">
          <b>No tienes formularios disponibles</b>
          {esMaster
            ? "Publica un formulario en la pestaña Formularios para poder ejecutarlo (como Master puedes probar cualquiera publicado)."
            : "Todavía no tienes asignaciones. Pídele a un administrador que te asigne en Plan de evaluadores."}
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {disponibles.map((f) => (
          <div key={f.id} className="ca-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px" }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{f.nombre}</div>
              {f.descripcion && <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginTop: 2 }}>{f.descripcion.length > 150 ? f.descripcion.slice(0, 150) + "…" : f.descripcion}</div>}
            </div>
            <button style={btnPrim} onClick={() => setEjecutando(nuevaEvaluacion(f, usuario))}>Iniciar CdR</button>
          </div>
        ))}
      </div>

      {enCurso.length > 0 && (
        <>
          <Titulo t={`En curso (${enCurso.length})`} />
          <div style={{ display: "grid", gap: 8 }}>
            {enCurso.map((e) => (
              <div key={e.id} className="ca-card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <b>{e.rutinaNombre || "(rutina sin elegir)"}</b>
                  <div style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{e.formulario?.nombre} · actualizada {fechaLegible(e.actualizado)}</div>
                </div>
                <button style={btnPrim} onClick={() => setEjecutando(e)}>Continuar</button>
                <button style={btnPel} onClick={() => descartar(e)}>Descartar</button>
              </div>
            ))}
          </div>
        </>
      )}

      {hechas.length > 0 && (
        <>
          <Titulo t={`Realizadas (${hechas.length})`} />
          <table className="ca-tabla cdr-apilada">
            <thead><tr><th>Rutina</th><th>Líder</th><th>Evaluador</th><th>Fecha</th><th>Índice</th><th>Resultado</th><th></th></tr></thead>
            <tbody>
              {hechas.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.rutinaNombre}</b></td>
                  <td data-label="Líder">{e.lider}</td>
                  <td data-label="Evaluador">{e.evaluadorNombre}</td>
                  <td data-label="Fecha">{fechaLegible(e.fechaEnvio)}</td>
                  <td data-label="Índice"><b>{fmt(e.resultado?.indice ?? 0)}%</b></td>
                  <td data-label="Resultado"><span className={`ca-pill ${CLASE_RESULTADO[e.resultado?.clasificacion] || ""}`}>{ETIQUETA_CLASIFICACION[e.resultado?.clasificacion] || "—"}</span></td>
                  <td style={{ textAlign: "right" }}><button style={btn} onClick={() => setEjecutando(e)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Titulo({ t }) {
  return <p style={{ fontWeight: 800, fontSize: 16, margin: "22px 0 10px" }}>{t}</p>;
}

/** Pantalla de llegada cuando alguien escanea el QR de un formulario. */
/** La reunión del QR escaneado (o el aviso de que ya no existe en el formulario). */
function BloqueReunionQR({ rutina, invalida }) {
  if (rutina) {
    const detalle = [horarioDeReunion(rutina), rutina.area].filter(Boolean).join(" · ");
    return (
      <div className="cdr-reunion" style={{ marginBottom: 12 }}>
        <span className="cdr-reunion-etq">Reunión de este QR</span>
        <span className="cdr-reunion-nom">{rutina.nombre}</span>
        {detalle && <span className="cdr-reunion-sub">{detalle}</span>}
      </div>
    );
  }
  if (invalida) return <p className="cdr-aviso" style={{ margin: "0 0 12px" }}>La reunión de este QR ya no está en el formulario. Podrás elegirla en el primer paso; avisa a un administrador para que revise las asignaciones.</p>;
  return null;
}

function AccesoDirecto({ formularios, form, rutina, rutinaInvalida, enCurso, onIniciar, onContinuar, onCerrar }) {
  if (formularios === null) {
    return <div className="ca-card" style={{ marginBottom: 14 }}>Buscando el formulario del QR…</div>;
  }
  if (!form) {
    return (
      <div className="ca-card" style={{ marginBottom: 18, borderLeft: "4px solid var(--rojo)" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 16 }}>Este formulario no está disponible para ti</p>
        <p style={{ ...ayuda, margin: "0 0 12px" }}>
          Puede que todavía no esté publicado o que no estés asignado como evaluador. Pídele a un administrador que te asigne en Plan de evaluadores.
        </p>
        <button className="cdr-nav-btn" onClick={onCerrar}>Ver mis CdR</button>
      </div>
    );
  }
  return (
    <div className="ca-card" style={{ marginBottom: 18, borderLeft: "4px solid var(--verde)" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--verde-oscuro)" }}>Escaneaste este formulario</p>
      <p style={{ margin: "4px 0 2px", fontWeight: 800, fontSize: 19 }}>{form.nombre}</p>
      {form.descripcion && <p style={{ ...ayuda, margin: "0 0 12px" }}>{form.descripcion.length > 160 ? form.descripcion.slice(0, 160) + "…" : form.descripcion}</p>}
      <BloqueReunionQR rutina={rutina} invalida={rutinaInvalida} />
      <div className="cdr-acciones-directo">
        {enCurso.length > 0 && (
          <button className="cdr-nav-btn prim" onClick={() => onContinuar(enCurso[0])}>
            Continuar la CdR en curso{enCurso[0].rutinaNombre && <small className="cdr-sub"> ({enCurso[0].rutinaNombre})</small>}
          </button>
        )}
        <button className={`cdr-nav-btn ${enCurso.length ? "" : "prim"}`} onClick={onIniciar}>{enCurso.length ? "Iniciar una nueva" : "Iniciar CdR"}</button>
        <button className="cdr-nav-btn" onClick={onCerrar}>Ver mis CdR</button>
      </div>
    </div>
  );
}

function useConexion() {
  const [enLinea, setEnLinea] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener("online", si);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", si);
      window.removeEventListener("offline", no);
    };
  }, []);
  return enLinea;
}

/**
 * Lo que ve quien escanea el QR de un formulario SIN haber iniciado sesión: no se pide usuario ni contraseña;
 * en el primer paso elige su nombre de la lista de asistentes de Control de Asistencia.
 */
export function AccesoQR({ formularioId, rutinaId = "", onIniciarSesion }) {
  const [estado, setEstado] = useState({ cargando: true });
  const [ejecutando, setEjecutando] = useState(null);
  const [recarga, setRecarga] = useState(0);
  const clave = `cdr_qr_borrador_${formularioId}${rutinaId ? "_" + rutinaId : ""}`; // un borrador por QR (por reunión)
  const leerLocal = () => { try { return window.localStorage.getItem(clave) || ""; } catch { return ""; } };
  const guardarLocal = (v) => { try { window.localStorage.setItem(clave, v); } catch { /* sin almacenamiento local */ } };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const crudo = await obtenerFormulario(formularioId);
        const form = crudo ? proyectarFormulario(crudo, await asignacionesDeFormulario(formularioId)) : null;
        let borrador = null;
        const id = leerLocal();
        if (id && form) {
          const e = await obtenerEvaluacion(id); // retoma lo que dejó a medias en este mismo celular
          if (e && e.estado === "borrador" && e.sinSesion) borrador = e;
        }
        if (vivo) setEstado({ cargando: false, form, borrador });
      } catch (e) {
        console.error(e);
        if (vivo) setEstado({ cargando: false, error: e.code || e.message });
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formularioId, rutinaId, recarga]);

  function volver() {
    setEjecutando(null);
    setEstado({ cargando: true });
    setRecarga((r) => r + 1);
  }

  const marco = (hijos) => (
    <div className="ca-pagina">
      <div className="ca-cabecera">
        <div className="ca-cabecera-top">
          <img src={logoOems} alt="OEMS" style={{ height: 34 }} />
          <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 34 }} />
        </div>
        <p className="ca-titulo">Confirmación de Rol (CdR)</p>
      </div>
      <div className="ca-contenido cdr-ejecutar">{hijos}</div>
    </div>
  );
  const enlaceSesion = (
    <p style={{ ...ayuda, margin: "14px 0 0" }}>
      ¿Tienes usuario del portal? <button style={{ background: "none", border: "none", color: "var(--verde-oscuro)", fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }} onClick={onIniciarSesion}>Iniciar sesión</button>
    </p>
  );

  if (ejecutando) {
    return marco(<Ejecutar evaluacionInicial={ejecutando} onCerrar={volver} textoVolver="← Volver al inicio" />);
  }
  if (estado.cargando) return marco(<div className="ca-card">Cargando el formulario…</div>);
  if (estado.error) {
    return marco(
      <div className="ca-card" style={{ borderLeft: "4px solid var(--rojo)" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 16 }}>No se pudo abrir el formulario</p>
        <p style={{ ...ayuda, margin: "0 0 12px" }}>Revisa tu conexión e inténtalo de nuevo ({estado.error}).</p>
        <button className="cdr-nav-btn prim" onClick={() => { setEstado({ cargando: true }); setRecarga((r) => r + 1); }}>Reintentar</button>
      </div>
    );
  }
  const { form, borrador } = estado;
  const rutinaQR = form && rutinaId ? (form.rutinas || []).find((r) => r.sesionId === rutinaId) || null : null;
  const rutinaQRInvalida = !!(form && rutinaId && !rutinaQR);
  if (!form || form.estado !== "publicado") {
    return marco(
      <div className="ca-card" style={{ borderLeft: "4px solid var(--rojo)" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 16 }}>Este formulario no está disponible</p>
        <p style={{ ...ayuda, margin: 0 }}>Puede que todavía no esté publicado. Consulta con un administrador.</p>
        {enlaceSesion}
      </div>
    );
  }
  if (form.accesoSinSesion === false) {
    return marco(
      <div className="ca-card" style={{ borderLeft: "4px solid var(--ambar)" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 16 }}>{form.nombre}</p>
        <p style={{ ...ayuda, margin: "0 0 12px" }}>Este formulario requiere iniciar sesión con tu usuario y contraseña.</p>
        <button className="cdr-nav-btn prim" onClick={onIniciarSesion}>Iniciar sesión</button>
      </div>
    );
  }
  return marco(
    <div className="ca-card" style={{ borderLeft: "4px solid var(--verde)" }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--verde-oscuro)" }}>Escaneaste este formulario</p>
      <p style={{ margin: "4px 0 2px", fontWeight: 800, fontSize: 19 }}>{form.nombre}</p>
      {form.descripcion && <p style={{ ...ayuda, margin: "0 0 8px" }}>{form.descripcion.length > 160 ? form.descripcion.slice(0, 160) + "…" : form.descripcion}</p>}
      <BloqueReunionQR rutina={rutinaQR} invalida={rutinaQRInvalida} />
      <p style={{ ...ayuda, margin: "0 0 14px" }}>No necesitas iniciar sesión: en el primer paso eliges tu nombre de la lista de asistentes.</p>
      <div className="cdr-acciones-directo">
        {borrador && (
          <button className="cdr-nav-btn prim" onClick={() => setEjecutando(borrador)}>
            Continuar la CdR en curso{borrador.rutinaNombre && <small className="cdr-sub"> ({borrador.rutinaNombre})</small>}
          </button>
        )}
        <button className={`cdr-nav-btn ${borrador ? "" : "prim"}`} onClick={() => { const ev = nuevaEvaluacion(form, null, rutinaQR ? rutinaQR.sesionId : undefined); guardarLocal(ev.id); setEjecutando(ev); }}>
          {borrador ? "Iniciar una nueva" : "Iniciar CdR"}
        </button>
      </div>
      {enlaceSesion}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ejecución de una CdR (flujo guiado en 6 pasos)                     */
/* ------------------------------------------------------------------ */

const PASOS = ["Datos", "Notas en terreno", "Rúbrica", "Resultado y feedback", "Compromiso", "Cierre"];
const PASOS_CORTOS = ["Datos", "Notas", "Rúbrica", "Resultado", "Compromiso", "Cierre"]; // para el celular

export function Ejecutar({ evaluacionInicial, onCerrar, retrasoMs = 1500, textoVolver = "← Volver a Mis CdR" }) {
  const [ev, setEv] = useState(() => clonar(evaluacionInicial));
  const [sucio, setSucio] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState("");
  const [ver, setVer] = useState(0);
  const [anterior, setAnterior] = useState(evaluacionInicial.compromisoAnterior || null);
  const [erroresEnvio, setErroresEnvio] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [personas, setPersonas] = useState(null); // asistentes de Control de Asistencia
  const [errorPersonas, setErrorPersonas] = useState(false);
  const verRef = useRef(0);
  const timerRef = useRef(null);
  const bloqueoRef = useRef(false); // true al enviar: ningún guardado automático tardío puede pisar la CdR enviada
  const enLinea = useConexion();
  const soloLectura = ev.estado === "enviada";
  const paso = ev.paso || 0;
  // El avance del plan se muestra solo al terminar (no al revisar una CdR antigua).
  const recienEnviada = soloLectura && !!ev.fechaEnvio && Date.now() - Date.parse(ev.fechaEnvio) < 15 * 60 * 1000;

  function cambiar(fn) {
    setEv((prev) => {
      const c = clonar(prev);
      fn(c);
      return c;
    });
    verRef.current += 1;
    setVer(verRef.current);
    setSucio(true);
    setErroresEnvio([]);
  }

  async function guardarAhora() {
    if (bloqueoRef.current) return;
    const v = verRef.current;
    try {
      setEstadoGuardado("guardando");
      await guardarEvaluacion({ ...ev, actualizado: new Date().toISOString() });
      if (v === verRef.current) {
        setSucio(false);
        setEstadoGuardado("guardado");
      }
    } catch (e) {
      console.error(e);
      setEstadoGuardado("error");
    }
  }

  // Guardado automático: cada cambio se guarda solo, para no perder notas durante la sesión.
  useEffect(() => {
    if (!sucio || soloLectura) return;
    setEstadoGuardado("pendiente");
    const t = setTimeout(guardarAhora, retrasoMs);
    timerRef.current = t;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ver]);

  useEffect(() => {
    if (!sucio) return;
    const aviso = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  // Lista de asistentes de Asistencia, para sugerir el evaluador.
  useEffect(() => {
    if (evaluacionInicial.estado === "enviada") return undefined;
    return listarPersonasAsistencia(setPersonas, () => setErrorPersonas(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seguimiento: el compromiso que ESTE evaluador acordó con ESTE líder en su última CdR de esta rutina.
  // Se vuelve a buscar si cambia la rutina, el evaluador o el líder (nunca se muestran compromisos de otros evaluadores).
  const primeraBusqueda = useRef(true);
  const claveAnterior = useRef(null);
  useEffect(() => {
    if (soloLectura) return undefined;
    if (!ev.rutinaSesionId || !(ev.evaluadorNombre || "").trim()) {
      setAnterior(null);
      return undefined;
    }
    let vivo = true;
    const espera = primeraBusqueda.current ? 0 : 350; // al abrir, de inmediato; al ir tecleando un nombre, con pausa
    primeraBusqueda.current = false;
    const t = setTimeout(() => {
      buscarCompromisoAnterior({
        id: ev.id,
        rutinaSesionId: ev.rutinaSesionId,
        lider: ev.lider,
        evaluador: { uid: ev.evaluadorUid, personaId: ev.evaluadorPersonaId, nombre: ev.evaluadorNombre },
      })
        .then((r) => {
          if (!vivo) return;
          setAnterior(r);
          // Si cambió el compromiso a revisar (otro evaluador o líder), lo marcado antes ya no corresponde.
          const clave = r ? `${r.fecha}|${r.accion}` : "";
          if (claveAnterior.current !== null && claveAnterior.current !== clave) {
            cambiar((c) => {
              c.feedback.seguimiento = "";
              c.feedback.seguimientoComentario = "";
            });
          }
          claveAnterior.current = clave;
        })
        .catch(() => {});
    }, espera);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.rutinaSesionId, ev.evaluadorNombre, ev.evaluadorUid, ev.evaluadorPersonaId, ev.lider]);

  function irAPaso(n) {
    cambiar((c) => (c.paso = n));
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0 });
  }

  async function volver() {
    if (sucio && !soloLectura) await guardarAhora();
    onCerrar();
  }

  async function enviar() {
    const errores = erroresDeEnvio(ev, anterior);
    if (errores.length) {
      setErroresEnvio(errores);
      return;
    }
    if (!window.confirm("Al enviar, la CdR queda bloqueada y no se podrá modificar. ¿Enviar ahora?")) return;
    bloqueoRef.current = true;
    clearTimeout(timerRef.current);
    setEnviando(true);
    try {
      const res = calcularResultado(ev.formulario, nivelesDe(ev));
      const ahora = new Date().toISOString();
      const final = {
        ...ev,
        estado: "enviada",
        fechaEnvio: ahora,
        actualizado: ahora,
        compromisoAnterior: anterior || null,
        evaluadorEnLista: !!(ev.evaluadorUid || ev.evaluadorPersonaId),
        resultado: { indice: res.indice, clasificacion: res.clasificacion, criticosEnCero: res.criticosEnCero, bloques: res.bloques },
      };
      final.feedback = { ...final.feedback, compromiso: { ...final.feedback.compromiso, responsable: (final.feedback.compromiso.responsable || "").trim() || ev.lider } };
      if (!anterior) final.feedback = { ...final.feedback, seguimiento: "primera" };
      await guardarEvaluacion(final);
      verRef.current += 1;
      setEv(final);
      setSucio(false);
    } catch (e) {
      console.error(e);
      bloqueoRef.current = false;
      setErroresEnvio([`No se pudo enviar (${e.code || e.message}). Tus datos siguen guardados como borrador.`]);
    } finally {
      setEnviando(false);
    }
  }

  if (soloLectura) {
    return (
      <div className="cdr-ejecutar" style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 14 }}><button style={btn} onClick={onCerrar}>{textoVolver}</button></div>
        {recienEnviada && <AvancePlan modo="enviada" formularioId={ev.formularioId} rutinaSesionId={ev.rutinaSesionId} evaluador={{ uid: ev.evaluadorUid, personaId: ev.evaluadorPersonaId, nombre: ev.evaluadorNombre }} />}
        <ResumenEvaluacion ev={ev} />
      </div>
    );
  }

  const etiquetaGuardado = { pendiente: "Cambios sin guardar…", guardando: "Guardando…", guardado: "✓ Guardado", error: "⚠ No se pudo guardar (se reintentará al siguiente cambio)" }[estadoGuardado] || "";

  return (
    <div className="cdr-ejecutar" style={{ maxWidth: 900 }}>
      {!enLinea && (
        <div className="cdr-aviso">📵 Sin conexión. Puedes seguir escribiendo: se guardará solo cuando vuelva la señal. No cierres esta pestaña.</div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <button style={btn} onClick={volver}>← Salir (se guarda solo)</button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="cdr-clamp2" style={{ fontWeight: 800 }} title={ev.formulario.nombre}>{ev.formulario.nombre}</div>
          <div className="cdr-clamp2" style={{ fontSize: 12.5, color: "var(--texto-suave)" }} title={`${ev.rutinaNombre || ""}${ev.lider ? " · Líder: " + ev.lider : ""}`}>{ev.rutinaNombre || "Rutina sin elegir"}{ev.lider ? ` · Líder: ${ev.lider}` : ""}</div>
        </div>
        <span style={{ fontSize: 12.5, color: estadoGuardado === "error" ? "var(--rojo)" : "var(--texto-suave)", fontWeight: 600 }}>{etiquetaGuardado}</span>
      </div>

      <AvancePlan formularioId={ev.formularioId} rutinaSesionId={ev.rutinaSesionId} evaluador={{ uid: ev.evaluadorUid, personaId: ev.evaluadorPersonaId, nombre: ev.evaluadorNombre }} />

      <div className="cdr-pasos">
        {PASOS.map((nombre, i) => (
          <button key={nombre} className={`cdr-paso ${i === paso ? "activo" : ""}`} data-corto={PASOS_CORTOS[i]} onClick={() => irAPaso(i)} title={nombre}>
            <span className="n">{i + 1}</span><span className="nombre"> · {nombre}</span>
          </button>
        ))}
      </div>

      {paso === 0 && <PasoDatos ev={ev} cambiar={cambiar} personas={personas} errorPersonas={errorPersonas} />}
      {paso === 1 && <PasoNotas ev={ev} cambiar={cambiar} />}
      {paso === 2 && <PasoRubrica ev={ev} cambiar={cambiar} />}
      {paso === 3 && <PasoResultado ev={ev} cambiar={cambiar} />}
      {paso === 4 && <PasoCompromiso ev={ev} cambiar={cambiar} anterior={anterior} />}
      {paso === 5 && <PasoCierre ev={ev} cambiar={cambiar} anterior={anterior} errores={erroresEnvio} onEnviar={enviar} enviando={enviando} />}

      <div className="cdr-barra-inferior">
        <button className="cdr-nav-btn" disabled={paso === 0} onClick={() => irAPaso(paso - 1)}>← Anterior</button>
        {paso < PASOS.length - 1 && <button className="cdr-nav-btn prim" onClick={() => irAPaso(paso + 1)}>Siguiente →</button>}
      </div>
    </div>
  );
}

/* ------------------------- Paso 1 · Datos -------------------------- */

/** Opciones de un toque (como tarjetas grandes): nombre en negrita y, debajo, el área. */
function OpcionesLider({ lideres, valor, area, onElegir }) {
  return (
    <div className="cdr-opciones" role="radiogroup" aria-label="Líder">
      {lideres.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={valor === l} className={`cdr-opcion ${valor === l ? "sel" : ""} ${onElegir ? "" : "fijo"}`} onClick={() => onElegir && onElegir(l)}>
          <span className="nom">{l}</span>
          {area && <span className="sub">{area}</span>}
        </button>
      ))}
    </div>
  );
}

function PasoDatos({ ev, cambiar, personas, errorPersonas }) {
  const f = ev.formulario;
  const opciones = opcionesEvaluador(ev, personas);
  const fijarEvaluador = (o) => cambiar((c) => { c.evaluadorNombre = o.nombre; c.evaluadorUid = o.uid || ""; c.evaluadorPersonaId = o.personaId || ""; });
  const escribirEvaluador = (t) => {
    const m = opciones.find((o) => norm(o.nombre) === norm(t));
    if (m) fijarEvaluador(m);
    else cambiar((c) => { c.evaluadorNombre = t; c.evaluadorUid = ""; c.evaluadorPersonaId = ""; });
  };
  const campoEvaluador = <ComboEvaluador valor={ev.evaluadorNombre} opciones={opciones} onTexto={escribirEvaluador} onElegir={fijarEvaluador} personas={personas} errorPersonas={errorPersonas} />;
  const rutina = f.rutinas.find((r) => r.sesionId === ev.rutinaSesionId);
  const lideres = rutina?.lideres || [];
  const detalleReunion = [horarioDeReunion(rutina), rutina?.area].filter(Boolean).join(" · ");

  function elegirRutina(id) {
    const r = f.rutinas.find((x) => x.sesionId === id);
    cambiar((c) => aplicarRutina(c, r || null));
  }

  return (
    <div className="ca-card">
      {ev.rutinaSesionId && (
        <div className="cdr-reunion">
          <span className="cdr-reunion-etq">{ev.rutinaBloqueada ? "Reunión de este QR" : "Reunión elegida"}</span>
          <span className="cdr-reunion-nom">{ev.rutinaNombre}</span>
          {detalleReunion && <span className="cdr-reunion-sub">{detalleReunion}</span>}
        </div>
      )}
      <p style={{ ...ayuda, marginTop: 0 }}>{ev.rutinaBloqueada ? "La reunión ya viene definida por el QR. Completa estos datos." : "Antes de empezar la observación, completa estos datos."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {!f.seccionA.some((c) => c.tipo === "evaluador") && (
          <div>
            <label className="ca-label">Evaluador *</label>
            {campoEvaluador}
          </div>
        )}
        {f.seccionA.map((c) => {
          if (c.tipo === "rutina" && ev.rutinaBloqueada) return null; // ya viene definida por el QR: no se elige
          const lideresComoTarjetas = c.tipo === "lider" && ev.rutinaSesionId && lideres.length >= 1 && lideres.length <= 6;
          return (
            <div key={c.id} style={lideresComoTarjetas ? { gridColumn: "1 / -1" } : undefined}>
              <label className="ca-label">{c.etiqueta}{c.obligatorio ? " *" : ""}</label>
              {c.tipo === "rutina" && (
                <select className="rp-select" value={ev.rutinaSesionId} onChange={(e) => elegirRutina(e.target.value)}>
                  <option value="">Elige el diálogo o rutina…</option>
                  {f.rutinas.map((r) => <option key={r.sesionId} value={r.sesionId}>{r.nombre}</option>)}
                </select>
              )}
              {c.tipo === "lider" && (
                !ev.rutinaSesionId ? <input className="rp-input" disabled value="Primero elige la rutina" readOnly />
                : lideres.length === 1 ? <OpcionesLider lideres={lideres} valor={lideres[0]} area={rutina.area} />
                : lideresComoTarjetas ? <OpcionesLider lideres={lideres} valor={ev.lider} area={rutina.area} onElegir={(l) => cambiar((x) => { x.lider = l; })} />
                : lideres.length > 6 ? (
                  <select className="rp-select" value={ev.lider} onChange={(e) => cambiar((x) => (x.lider = e.target.value))}>
                    <option value="">¿Quién lideró esta sesión?</option>
                    {lideres.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : <input className="rp-input" value={ev.lider} placeholder="Nombre del líder" onChange={(e) => cambiar((x) => (x.lider = e.target.value))} />
              )}
              {c.tipo === "evaluador" && campoEvaluador}
              {c.tipo === "texto" && <input className="rp-input" value={ev.datos[c.id] || ""} onChange={(e) => cambiar((x) => (x.datos[c.id] = e.target.value))} />}
              {c.tipo === "numero" && <input className="rp-input" type="number" value={ev.datos[c.id] || ""} onChange={(e) => cambiar((x) => (x.datos[c.id] = e.target.value))} />}
              {c.tipo === "fecha" && <input className="rp-input" type="date" value={ev.datos[c.id] || ""} onChange={(e) => cambiar((x) => (x.datos[c.id] = e.target.value))} />}
              {c.tipo === "hora" && <input className="rp-input" type="time" value={ev.datos[c.id] || ""} onChange={(e) => cambiar((x) => (x.datos[c.id] = e.target.value))} />}
              {c.tipo === "seleccion" && (
                <select className="rp-select" value={ev.datos[c.id] || ""} onChange={(e) => cambiar((x) => (x.datos[c.id] = e.target.value))}>
                  <option value="">Elige…</option>
                  {(c.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------- Paso 2 · Notas en terreno --------------------- */

/** Cuadro de texto que crece solo con lo que se escribe, para ver siempre todo el contenido. */
function AreaAuto({ valor, onCambiar, minFilas = 3, estilo, ...resto }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor]);
  return <textarea ref={ref} className="rp-textarea" rows={minFilas} value={valor} onChange={(e) => onCambiar(e.target.value)} style={{ resize: "none", overflow: "hidden", ...estilo }} {...resto} />;
}

function PasoNotas({ ev, cambiar }) {
  const [texto, setTexto] = useState("");
  const [criterio, setCriterio] = useState("");
  const [verPuntos, setVerPuntos] = useState(false);
  const puntos = ev.formulario.seccionB.puntos;
  const auto = ev.formulario.seccionB.horaAutomatica;

  function agregar() {
    const t = texto.trim();
    if (!t) return;
    cambiar((c) => c.notas.push({ id: nuevoId("n"), hora: auto ? horaAhora() : "", texto: t, criterio }));
    setTexto("");
    setCriterio("");
  }

  return (
    <div>
      <div className="ca-card" style={{ marginBottom: 14 }}>
        <p style={{ ...ayuda, marginTop: 0 }}>Anota rápido lo que observas durante la sesión. Después te servirán para calificar y para dar feedback.</p>
        <AreaAuto
          minFilas={7}
          valor={texto}
          onCambiar={setTexto}
          placeholder="Escribe una nota…"
          estilo={{ fontSize: 16, minHeight: 180, lineHeight: 1.5 }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) agregar(); }}
        />
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="cdr-nav-btn prim" disabled={!texto.trim()} onClick={agregar}>+ Agregar nota</button>
          {auto && <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>La hora se marca sola.</span>}
        </div>
        {puntos.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button style={btn} aria-expanded={verPuntos} onClick={() => setVerPuntos((v) => !v)}>💡 Puntos a observar ({puntos.length}) {verPuntos ? "▴" : "▾"}</button>
            {verPuntos && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {puntos.map((p) => (
                  <button key={p.id} className="ca-chip" style={{ cursor: "pointer", border: "none", fontWeight: 600, textAlign: "left" }} onClick={() => { setTexto((t) => (t ? t + "\n" : "") + p.texto + ": "); setCriterio(p.criterio || ""); }}>
                    + {p.texto}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p style={{ fontWeight: 800, margin: "0 0 8px" }}>Tus notas ({ev.notas.length})</p>
      {ev.notas.length === 0 && <p style={ayuda}>Aún no has anotado nada.</p>}
      {[...ev.notas].reverse().map((n) => (
        <div key={n.id} className="ca-card" style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {n.hora && <span className="ca-chip" style={{ fontWeight: 800 }}>{n.hora}</span>}
            <button style={{ ...btn, color: "var(--rojo)", marginLeft: "auto" }} title="Borrar nota" onClick={() => cambiar((c) => (c.notas = c.notas.filter((x) => x.id !== n.id)))}>✕ Borrar</button>
          </div>
          <AreaAuto minFilas={3} valor={n.texto} onCambiar={(v) => cambiar((c) => (c.notas.find((x) => x.id === n.id).texto = v))} estilo={{ fontSize: 15.5, lineHeight: 1.5 }} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------- Paso 3 · Rúbrica --------------------------- */

const ESTILO_NIVEL = {
  2: { color: "#0f6e56", fondo: "#e1f5ee", etiqueta: "Cumple" },
  1: { color: "#ba7517", fondo: "#faeeda", etiqueta: "Parcial" },
  0: { color: "#993c1d", fondo: "#fbe6e1", etiqueta: "No cumple" },
};

const sinCalificar = (r) => !(r && r.nivel !== undefined && r.nivel !== "");

function PasoRubrica({ ev, cambiar }) {
  const [abiertos, setAbiertos] = useState({}); // criterios con la explicación desplegada
  const todos = ev.formulario.bloques.flatMap((b) => b.criterios);
  const pendientes = todos.filter((c) => sinCalificar(ev.respuestas[c.codigo]));
  const respondidos = todos.length - pendientes.length;

  function fijarNivel(cod, nivel) {
    cambiar((c) => {
      const r = c.respuestas[cod] || { nivel: "", nota: "" };
      r.nivel = r.nivel === nivel ? "" : nivel;
      c.respuestas[cod] = r;
    });
  }
  const fijarNota = (cod, valor) =>
    cambiar((x) => {
      const rr = x.respuestas[cod] || { nivel: "", nota: "" };
      rr.nota = valor;
      x.respuestas[cod] = rr;
    });
  function irAlSiguiente() {
    const el = pendientes[0] && document.getElementById(`crit-${pendientes[0].codigo}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div>
      <div className="cdr-progreso-rubrica">
        <div className="fila">
          <span><b>{respondidos} de {todos.length}</b> calificados</span>
          {pendientes.length > 0 && <button type="button" className="cdr-link" style={{ marginLeft: "auto" }} onClick={irAlSiguiente}>Ir al siguiente sin calificar ↓</button>}
          {pendientes.length === 0 && <span style={{ marginLeft: "auto", color: "#0f6e56", fontWeight: 700 }}>✓ Todos calificados</span>}
        </div>
        <div className="barra"><div style={{ width: `${todos.length ? (respondidos / todos.length) * 100 : 0}%` }} /></div>
      </div>
      <p className="cdr-ayuda-rubrica">Toca el nivel de cada criterio. Si quieres, agrega un comentario (es opcional).</p>

      {ev.formulario.bloques.map((b) =>
        b.criterios.map((c) => {
          const r = ev.respuestas[c.codigo] || { nivel: "", nota: "" };
          const abierto = !!abiertos[c.codigo];
          const niveles = [[2, c.nivel2], [1, c.nivel1], [0, c.nivel0]];
          const notasRelacionadas = ev.notas.filter((n) => coincideCriterio(n.criterio, c.codigo));
          const claseNivel = r.nivel === "NA" ? "nNA" : r.nivel === "" || r.nivel === undefined ? "" : `n${r.nivel}`;
          return (
            <div key={c.id} id={`crit-${c.codigo}`} className={`cdr-criterio ${claseNivel}`}>
              <span className="cdr-chip-bloque">{b.nombre}</span>
              <p className="cdr-pregunta">
                <span className="cod">{c.codigo}</span> {c.nombre} {c.critico && <span className="ca-pill ca-pill-rojo">★ Crítico</span>}
              </p>

              <div className="cdr-niveles" style={{ gridTemplateColumns: `repeat(${c.admiteNA ? 4 : 3}, 1fr)` }} role="group" aria-label={`Nivel de ${c.codigo}`}>
                {niveles.map(([n]) => (
                  <button key={n} type="button" data-n={n} aria-pressed={r.nivel === n} className={`cdr-nivel ${r.nivel === n ? "sel" : ""}`} onClick={() => fijarNivel(c.codigo, n)}>
                    <span className="num">{n}</span>
                    <span className="etq">{ESTILO_NIVEL[n].etiqueta}</span>
                  </button>
                ))}
                {c.admiteNA && (
                  <button type="button" data-n="NA" aria-pressed={r.nivel === "NA"} className={`cdr-nivel ${r.nivel === "NA" ? "sel" : ""}`} onClick={() => fijarNivel(c.codigo, "NA")}>
                    <span className="num" style={{ fontSize: 17 }}>N/A</span>
                    <span className="etq">No aplica</span>
                  </button>
                )}
              </div>

              <button type="button" className="cdr-link" aria-expanded={abierto} onClick={() => setAbiertos((a) => ({ ...a, [c.codigo]: !a[c.codigo] }))}>
                {abierto ? "Ocultar explicación ▴" : "¿Qué mide? ▾"}
              </button>
              {abierto && (
                <div style={{ marginTop: 4, background: "var(--fondo)", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, display: "grid", gap: 6, lineHeight: 1.45 }}>
                  {niveles.map(([n, d]) => (
                    <div key={n}><b style={{ color: ESTILO_NIVEL[n].color }}>{n} · {ESTILO_NIVEL[n].etiqueta}:</b> {d || "—"}</div>
                  ))}
                  {c.admiteNA && <div><b>N/A:</b> No aplica en esta sesión.</div>}
                  {c.verificar && <div style={{ color: "var(--texto-suave)" }}><b>Cómo verificar:</b> {c.verificar}</div>}
                </div>
              )}

              {r.nivel !== "" && (
                <div style={{ marginTop: 10 }}>
                  {notasRelacionadas.length > 0 && (
                    <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {notasRelacionadas.map((n) => (
                        <button key={n.id} className="ca-chip" style={{ cursor: "pointer", border: "none", textAlign: "left", fontWeight: 500 }} title="Usar esta nota como justificación" onClick={() => fijarNota(c.codigo, (r.nota ? r.nota + "\n" : "") + n.texto)}>
                          📝 {n.hora ? n.hora + " — " : ""}{n.texto.length > 70 ? n.texto.slice(0, 70) + "…" : n.texto} <b style={{ whiteSpace: "nowrap" }}>+ usar</b>
                        </button>
                      ))}
                    </div>
                  )}
                  <AreaAuto
                    minFilas={2}
                    valor={r.nota || ""}
                    onCambiar={(v) => fijarNota(c.codigo, v)}
                    placeholder="Justificación o comentario (opcional)"
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------ Paso 4 · Resultado y feedback ------------------ */

function sugerirCriterio(ev, tipo, usados) {
  const criterios = ev.formulario.bloques.flatMap((b) => b.criterios);
  const orden = tipo === "fortalezas" ? [2] : [0, 1];
  for (const nivel of orden) {
    const c = criterios.find((x) => ev.respuestas[x.codigo]?.nivel === nivel && !usados.includes(x.codigo));
    if (c) return c.codigo;
  }
  return "";
}

function claseNota(p, parametros) {
  if (p === null || p === undefined) return "";
  return p >= parametros.umbralEfectiva ? "ca-pill-verde" : p >= parametros.umbralDesarrollo ? "ca-pill-ambar" : "ca-pill-rojo";
}

/** Nota (%) de cada bloque, su peso y cuánto aporta al total. */
function TablaBloques({ bloques, parametros, indice }) {
  return (
    <table className="ca-tabla cdr-apilada cdr-bloques">
      <thead>
        <tr><th>Bloque</th><th>Peso</th><th>Nota del bloque</th><th title="Puntos que el bloque suma al índice total">Aporte al total</th></tr>
      </thead>
      <tbody>
        {bloques.map((b) => (
          <tr key={b.nombre}>
            <td><b>{b.nombre}</b></td>
            <td data-label="Peso">{fmt(b.peso)}%</td>
            <td data-label="Nota del bloque">{b.puntaje === null ? "—" : <span className={`ca-pill ${claseNota(b.puntaje, parametros)}`} style={{ fontSize: 13 }}>{fmt(b.puntaje)}%</span>}</td>
            <td data-label="Aporte al total">{b.aporte === undefined ? "—" : `${fmt(b.aporte)} pts`}</td>
          </tr>
        ))}
        <tr>
          <td><b>TOTAL</b></td>
          <td data-label="Peso"><b>100%</b></td>
          <td data-label="Nota del bloque"><b>{fmt(indice)}%</b></td>
          <td data-label="Aporte al total"><b>{fmt(indice)} pts</b></td>
        </tr>
      </tbody>
    </table>
  );
}

function PasoResultado({ ev, cambiar }) {
  const [verDetalle, setVerDetalle] = useState(false);
  const res = calcularResultado(ev.formulario, nivelesDe(ev));

  // El feedback es obligatorio: al entrar deja lista una fortaleza y una oportunidad para completar.
  useEffect(() => {
    const falta = ["fortalezas", "oportunidades"].some((t) => ev.formulario.feedback[t] && ev.feedback[t].length === 0);
    if (!falta) return;
    cambiar((c) => {
      ["fortalezas", "oportunidades"].forEach((tipo) => {
        if (c.formulario.feedback[tipo] && c.feedback[tipo].length === 0) {
          c.feedback[tipo].push({ id: nuevoId("fb"), criterio: sugerirCriterio(c, tipo, []), situacion: "", comportamiento: "", impacto: "" });
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fb = ev.formulario.feedback;
  const criterios = ev.formulario.bloques.flatMap((b) => b.criterios);
  const max = fb.maxPorTipo || 2;
  const casilla = (titulo, placeholder, clave, valor, onCambiar) => <Casilla key={clave} titulo={titulo} placeholder={placeholder} valor={valor} onCambiar={onCambiar} />;

  return (
    <div>
      <div className="ca-card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 34, fontWeight: 800 }}>{fmt(res.indice)}%</span>
          <span className={`ca-pill ${CLASE_RESULTADO[res.clasificacion]}`} style={{ fontSize: 14 }}>{ETIQUETA_CLASIFICACION[res.clasificacion]}</span>
          {res.criticosEnCero.length > 0 && <span className="ca-pill ca-pill-rojo">Crítico en 0: {res.criticosEnCero.join(", ")}</span>}
          {res.incompleto && <span className="ca-pill ca-pill-ambar">Parcial: faltan criterios</span>}
          <button style={{ ...btn, marginLeft: "auto" }} aria-expanded={verDetalle} onClick={() => setVerDetalle((v) => !v)}>
            {verDetalle ? "Ocultar detalle ▴" : "Ver detalle por bloque ▾"}
          </button>
        </div>
        {verDetalle && (
          <div style={{ marginTop: 12 }}>
            <TablaBloques bloques={res.bloques} parametros={ev.formulario.parametros} indice={res.indice} />
          </div>
        )}
      </div>

      <NotasDeTerreno ev={ev} />

      <p style={{ ...ayuda, margin: "0 0 12px" }}>
        <b>El feedback es obligatorio para enviar la CdR:</b> cada fortaleza y oportunidad necesita {fb.situacion ? "criterio, situación, comportamiento e impacto" : "criterio, comportamiento e impacto"}. El compromiso con el líder va en el paso siguiente.
      </p>

      {["fortalezas", "oportunidades"].map((tipo) => fb[tipo] && (
        <div key={tipo} style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 800, margin: "0 0 8px" }}>{tipo === "fortalezas" ? "Fortalezas identificadas" : "Oportunidades de mejora"} ({ev.feedback[tipo].length} de {max}) <span style={{ color: "var(--rojo)", fontWeight: 700, fontSize: 12.5 }}>· obligatorio</span></p>
          {ev.feedback[tipo].map((it, i) => (
            <div key={it.id} className="ca-card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <select className="rp-select" style={{ maxWidth: 380 }} value={it.criterio} onChange={(e) => cambiar((c) => (c.feedback[tipo][i].criterio = e.target.value))}>
                  <option value="">Criterio relacionado…</option>
                  {criterios.map((c) => <option key={c.id} value={c.codigo}>{c.codigo} · {c.nombre}{ev.respuestas[c.codigo]?.nivel !== undefined && ev.respuestas[c.codigo]?.nivel !== "" ? ` (${ev.respuestas[c.codigo].nivel})` : ""}</option>)}
                </select>
                <button style={{ ...btn, color: "var(--rojo)", marginLeft: "auto" }} onClick={() => cambiar((c) => c.feedback[tipo].splice(i, 1))}>Quitar</button>
              </div>
              {fb.situacion && casilla("Situación", "¿Cuándo y dónde ocurrió?", `${tipo}-${it.id}-s`, it.situacion, (v) => cambiar((c) => (c.feedback[tipo][i].situacion = v)))}
              {casilla("Comportamiento", "¿Qué hizo o dejó de hacer el líder? (hechos observables)", `${tipo}-${it.id}-c`, it.comportamiento, (v) => cambiar((c) => (c.feedback[tipo][i].comportamiento = v)))}
              {casilla("Impacto", "¿Qué efecto tuvo en el equipo o en la rutina?", `${tipo}-${it.id}-i`, it.impacto, (v) => cambiar((c) => (c.feedback[tipo][i].impacto = v)))}
            </div>
          ))}
          {ev.feedback[tipo].length < max && (
            <button style={btn} onClick={() => cambiar((c) => c.feedback[tipo].push({ id: nuevoId("fb"), criterio: sugerirCriterio(c, tipo, c.feedback[tipo].map((x) => x.criterio)), situacion: "", comportamiento: "", impacto: "" }))}>
              + Agregar {tipo === "fortalezas" ? "fortaleza" : "oportunidad"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------ Paso 5 · Compromiso ----------------------- */

function PasoCompromiso({ ev, cambiar, anterior }) {
  const fb = ev.formulario.feedback;
  const casilla = (titulo, placeholder, clave, valor, onCambiar) => <Casilla key={clave} titulo={titulo} placeholder={placeholder} valor={valor} onCambiar={onCambiar} />;
  return (
    <div>
      {fb.seguimientoAnterior && (
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 800, margin: "0 0 8px" }}>Seguimiento al compromiso de la CdR anterior {anterior && <span style={{ color: "var(--rojo)", fontWeight: 700, fontSize: 12.5 }}>· obligatorio</span>}</p>
          {anterior ? (
            <>
              <div style={{ background: "var(--fondo)", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, marginBottom: 10 }}>
                <b>Compromiso acordado el {fechaLegible(anterior.fecha)}</b>{anterior.evaluador ? ` (evaluó ${anterior.evaluador})` : ""}:<br />
                {anterior.accion}{anterior.responsable ? ` — Responsable: ${anterior.responsable}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {[["cumplido", "Cumplido"], ["parcial", "Parcial"], ["no", "No cumplido"]].map(([v, t]) => (
                  <button key={v} style={{ ...btn, background: ev.feedback.seguimiento === v ? "var(--verde-claro)" : "#fff", borderColor: ev.feedback.seguimiento === v ? "var(--verde)" : "var(--borde)" }} onClick={() => cambiar((c) => (c.feedback.seguimiento = v))}>{t}</button>
                ))}
              </div>
              {casilla("Comentario (opcional)", "¿Qué se vio respecto de ese compromiso?", "seguimiento", ev.feedback.seguimientoComentario, (v) => cambiar((c) => (c.feedback.seguimientoComentario = v)))}
            </>
          ) : (
            <p style={{ ...ayuda, margin: 0 }}>{ev.rutinaSesionId ? "Es la primera CdR registrada para esta rutina: no hay compromiso anterior que revisar." : "Elige la rutina en el paso 1 para ver si hay un compromiso anterior."}</p>
          )}
        </div>
      )}

      {fb.compromisoMejora && (
        <div className="ca-card">
          <p style={{ fontWeight: 800, margin: "0 0 4px" }}>Compromiso de mejora acordado con el líder <span style={{ color: "var(--rojo)", fontWeight: 700, fontSize: 12.5 }}>· obligatorio</span></p>
          <p style={{ ...ayuda, margin: "0 0 10px" }}>Acción concreta, quién la hace y para cuándo. Se revisará en la próxima CdR de esta rutina.</p>
          {casilla("Acción", "¿Qué se compromete a hacer el líder?", "compromiso", ev.feedback.compromiso.accion, (v) => cambiar((c) => (c.feedback.compromiso.accion = v)))}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}>
              <label className="ca-label">Responsable</label>
              <input className="rp-input" value={ev.feedback.compromiso.responsable} placeholder={ev.lider || "Nombre"} onChange={(e) => cambiar((c) => (c.feedback.compromiso.responsable = e.target.value))} />
            </div>
            <div style={{ flex: "0 1 180px" }}>
              <label className="ca-label">Fecha</label>
              <input className="rp-input" type="date" value={ev.feedback.compromiso.fecha} onChange={(e) => cambiar((c) => (c.feedback.compromiso.fecha = e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {!fb.seguimientoAnterior && !fb.compromisoMejora && <p style={ayuda}>Este formulario no incluye compromiso de mejora: puedes pasar al cierre.</p>}
    </div>
  );
}

function Casilla({ titulo, placeholder, valor, onCambiar }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="ca-label">{titulo}</label>
      <AreaAuto minFilas={3} placeholder={placeholder} valor={valor} onCambiar={onCambiar} estilo={{ fontSize: 15, lineHeight: 1.5 }} />
    </div>
  );
}

/** Tarjeta de lectura: las notas de terreno, para repasarlas antes de escribir el feedback. */
function NotasDeTerreno({ ev }) {
  return (
    <div className="ca-card" style={{ marginBottom: 18, borderLeft: "4px solid var(--verde)" }}>
      <p style={{ fontWeight: 800, fontSize: 16, margin: "0 0 2px" }}>📝 Notas de terreno</p>
      <p style={{ ...ayuda, margin: "0 0 12px" }}>Léelas antes de escribir las fortalezas y las oportunidades.</p>
      {ev.notas.length === 0 ? (
        <p style={{ ...ayuda, margin: 0 }}>No anotaste notas de terreno en el paso 2.</p>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          {ev.notas.map((n) => (
            <div key={n.id} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              {n.hora && <span className="ca-chip" style={{ flexShrink: 0 }}>{n.hora}</span>}
              <span style={{ fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap", minWidth: 0, overflowWrap: "anywhere" }}>{n.texto}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Paso 6 · Cierre ------------------------- */

function PasoCierre({ ev, cambiar, anterior, errores, onEnviar, enviando }) {
  const pendientes = erroresDeEnvio(ev, anterior);
  const fb = ev.formulario.feedback;
  return (
    <div className="ca-card">
      <p style={{ fontWeight: 800, margin: "0 0 10px" }}>Revisión antes de enviar</p>
      {pendientes.length === 0 ? (
        <p style={{ color: "#0f6e56", fontWeight: 700, margin: "0 0 10px" }}>✓ Todo lo obligatorio está completo.</p>
      ) : (
        <div style={{ marginBottom: 10 }}>
          <p style={{ color: "var(--rojo)", fontWeight: 700, margin: "0 0 4px" }}>Falta completar:</p>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--rojo)", fontSize: 13.5 }}>{pendientes.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, margin: "14px 0", cursor: "pointer" }}>
        <input type="checkbox" checked={!!ev.liderTomoConocimiento} onChange={(e) => cambiar((c) => (c.liderTomoConocimiento = e.target.checked))} />
        El líder tomó conocimiento del feedback entregado
      </label>
      {errores.length > 0 && <ul style={{ color: "var(--rojo)", fontSize: 13.5, paddingLeft: 20 }}>{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button style={btnPrim} disabled={enviando} onClick={onEnviar}>{enviando ? "Enviando…" : "Enviar y bloquear la CdR"}</button>
      <p style={{ ...ayuda, margin: "8px 0 0" }}>Una vez enviada no se puede modificar.</p>
    </div>
  );
}

/* ------------------- Resumen de una CdR enviada -------------------- */

function ResumenEvaluacion({ ev }) {
  const f = ev.formulario;
  const r = ev.resultado || { indice: 0, clasificacion: "intervencion", criticosEnCero: [], bloques: [] };
  return (
    <div>
      <div className="ca-card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{ev.rutinaNombre}</div>
            <div style={{ fontSize: 13, color: "var(--texto-suave)" }}>
              {f.nombre} · Líder: {ev.lider} · Evaluó: {ev.evaluadorNombre}{ev.registradoPorNombre && ev.registradoPorNombre !== ev.evaluadorNombre ? ` (registrada por ${ev.registradoPorNombre})` : ""} · {fechaLegible(ev.fechaEnvio)}
            </div>
          </div>
          <span style={{ fontSize: 34, fontWeight: 800 }}>{fmt(r.indice)}%</span>
          <span className={`ca-pill ${CLASE_RESULTADO[r.clasificacion]}`} style={{ fontSize: 14 }}>{ETIQUETA_CLASIFICACION[r.clasificacion]}</span>
          {r.criticosEnCero?.length > 0 && <span className="ca-pill ca-pill-rojo">Crítico en 0: {r.criticosEnCero.join(", ")}</span>}
        </div>
        <p style={{ ...ayuda, margin: "10px 0 0" }}>Esta CdR fue enviada y está bloqueada.{ev.liderTomoConocimiento ? " El líder tomó conocimiento del feedback." : ""}</p>
      </div>

      <Titulo t="Nota por bloque" />
      <TablaBloques bloques={r.bloques || []} parametros={f.parametros} indice={r.indice} />

      <Titulo t="Calificación" />
      <table className="ca-tabla cdr-apilada">
        <thead><tr><th>Criterio</th><th>Nivel</th><th>Justificación / comentario</th></tr></thead>
        <tbody>
          {f.bloques.map((b) => [
            <tr key={b.id}><td colSpan={3} style={{ background: "var(--fondo)", fontWeight: 800, fontSize: 12.5, textTransform: "uppercase" }}>{b.nombre}</td></tr>,
            ...b.criterios.map((c) => {
              const x = ev.respuestas[c.codigo] || {};
              const e = ESTILO_NIVEL[x.nivel];
              return (
                <tr key={c.id}>
                  <td><b>{c.codigo}</b> {c.nombre}{c.critico ? " ★" : ""}</td>
                  <td data-label="Nivel" style={{ whiteSpace: "nowrap", fontWeight: 800, color: e ? e.color : "var(--texto-suave)" }}>{x.nivel === "NA" ? "N/A" : x.nivel === undefined || x.nivel === "" ? "—" : `${x.nivel} · ${e.etiqueta}`}</td>
                  <td className="cdr-libre" data-label="Justificación / comentario" style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{x.nota || "—"}</td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>

      {ev.notas.length > 0 && (
        <>
          <Titulo t={`Notas de terreno (${ev.notas.length})`} />
          <div className="ca-card">
            {ev.notas.map((n) => (
              <div key={n.id} style={{ fontSize: 13.5, marginBottom: 6 }}><b style={{ color: "var(--verde-oscuro)" }}>{n.hora}</b> {n.texto}</div>
            ))}
          </div>
        </>
      )}

      <Titulo t="Feedback" />
      <div style={{ display: "grid", gap: 10 }}>
        {["fortalezas", "oportunidades"].map((tipo) => ev.feedback[tipo].map((it) => (
          <div key={it.id} className="ca-card">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{tipo === "fortalezas" ? "Fortaleza" : "Oportunidad de mejora"} · {it.criterio || "sin criterio"}</div>
            <div style={{ fontSize: 13.5, display: "grid", gap: 4 }}>
              {it.situacion && <div><b>Situación:</b> {it.situacion}</div>}
              <div><b>Comportamiento:</b> {it.comportamiento || "—"}</div>
              <div><b>Impacto:</b> {it.impacto || "—"}</div>
            </div>
          </div>
        )))}
        {ev.feedback.compromiso.accion && (
          <div className="ca-card">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Compromiso de mejora</div>
            <div style={{ fontSize: 13.5 }}>{ev.feedback.compromiso.accion}<br /><span style={{ color: "var(--texto-suave)" }}>Responsable: {ev.feedback.compromiso.responsable || ev.lider} · Fecha: {ev.feedback.compromiso.fecha || "—"}</span></div>
          </div>
        )}
        {ev.compromisoAnterior && (
          <div className="ca-card">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Seguimiento a la CdR anterior: {{ cumplido: "Cumplido", parcial: "Parcial", no: "No cumplido" }[ev.feedback.seguimiento] || "sin registrar"}</div>
            <div style={{ fontSize: 13.5 }}>{ev.compromisoAnterior.accion}{ev.feedback.seguimientoComentario ? ` — ${ev.feedback.seguimientoComentario}` : ""}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Estilos ---------------------------- */

const ayuda = { fontSize: 13.5, color: "var(--texto-suave)", margin: "0 0 12px" };
const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13.5, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnPrim = { ...btn, background: "var(--verde)", borderColor: "var(--verde)", color: "#fff" };
const btnPel = { ...btn, color: "var(--rojo)", borderColor: "#e8b7a8" };
