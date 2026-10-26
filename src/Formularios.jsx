import { useEffect, useMemo, useRef, useState } from "react";
import { listarUsuarios } from "./auth.js";
import { listarFormularios, guardarFormulario, eliminarFormulario, nuevoId, contarCriterios } from "./formularios.js";
import { listarRutinasAsistencia, describirFrecuencia } from "./firebaseAsistencia.js";
import { PLANTILLA_PAUTA_V3, formularioEnBlanco } from "./plantillas.js";
import ModalQR from "./ModalQR.jsx";
import {
  repartirIgual,
  repartirProporcional,
  sumar,
  normalizarFormulario,
  erroresDePesos,
  calcularResultado,
  ETIQUETA_CLASIFICACION,
} from "./calculo.js";

const clonar = (x) => JSON.parse(JSON.stringify(x));

const claveNombre = (t) =>
  String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Un formulario exportado desde otro ambiente (p. ej. Excelencia → Henny) trae en cada rutina el id de la
 * reunión en la Asistencia de ESE ambiente, que acá no existe. Se re-enlazan por nombre con las reuniones de
 * esta Asistencia, conservando los líderes. Las que no tienen par quedan tal cual y aparecen como
 * "ya no existen en Asistencia" para revisarlas a mano.
 */
export function reenlazarRutinas(obj, disponibles) {
  const rutinas = Array.isArray(obj.rutinas) ? obj.rutinas : [];
  const porId = new Map(disponibles.map((s) => [s.id, s]));
  const porNombre = new Map(disponibles.map((s) => [claveNombre(s.nombre), s]));
  const usadas = new Set();
  let enlazadas = 0;
  const sinPar = [];
  obj.rutinas = rutinas.map((r) => {
    if (porId.has(r.sesionId)) {
      usadas.add(r.sesionId); // mismo ambiente: ya apunta bien
      return r;
    }
    const s = porNombre.get(claveNombre(r.nombre));
    if (s && !usadas.has(s.id)) {
      usadas.add(s.id);
      enlazadas += 1;
      return { ...r, sesionId: s.id, nombre: s.nombre, area: s.area || r.area || "", horaInicio: s.horaInicio || r.horaInicio || "", horaFin: s.horaFin || r.horaFin || "" };
    }
    sinPar.push(r.nombre);
    return r;
  });
  return { enlazadas, sinPar };
}
const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

/* ------------------------------------------------------------------ */
/*  Pantalla principal: lista de formularios                           */
/* ------------------------------------------------------------------ */

export default function Formularios({ usuario }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [rutinasAsistencia, setRutinasAsistencia] = useState(null);
  const [errorRutinas, setErrorRutinas] = useState("");
  const [editando, setEditando] = useState(null); // { form, esNuevo }
  const [modalNuevo, setModalNuevo] = useState(false);
  const [qrDe, setQrDe] = useState(null);
  const inputArchivo = useRef(null);

  useEffect(() => {
    const c1 = listarFormularios(setLista, (e) =>
      setError(
        e.code === "permission-denied" || e.code === "auth/operation-not-allowed"
          ? "No hay permiso para leer los formularios. Revisa en Firebase (formularios-7f89a): login Anónimo habilitado y reglas publicadas."
          : `No se pudieron cargar los formularios (${e.code || e.message}).`
      )
    );
    const c2 = listarUsuarios(setUsuarios);
    const c3 = listarRutinasAsistencia(setRutinasAsistencia, (e) =>
      setErrorRutinas(`No se pudieron leer las reuniones de Control de Asistencia (${e.code || e.message}).`)
    );
    return () => {
      c1();
      c2();
      c3();
    };
  }, []);

  function crearDesde(base, nombreExtra) {
    const ahora = new Date().toISOString();
    const copia = clonar(base);
    delete copia.id;
    const f = normalizarFormulario(copia);
    setEditando({
      esNuevo: true,
      form: {
        ...f,
        nombre: nombreExtra ? `${f.nombre} ${nombreExtra}` : f.nombre,
        id: nuevoId(),
        estado: "borrador",
        version: 1,
        creado: ahora,
        actualizado: ahora,
        creadoPor: usuario.nombreUsuario,
        asignadosUids: [],
        asignados: [],
      },
    });
    setModalNuevo(false);
  }

  function importarArchivo(ev) {
    const archivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const obj = JSON.parse(lector.result);
        if (!obj || !Array.isArray(obj.bloques) || !Array.isArray(obj.seccionA) || !obj.seccionB) throw new Error("estructura");
        if (rutinasAsistencia === null) {
          window.alert("Todavía se están cargando las reuniones de Asistencia. Espera un momento y vuelve a importar.");
          return;
        }
        const { sinPar } = reenlazarRutinas(obj, rutinasAsistencia);
        crearDesde(obj, "(importado)");
        const total = (obj.rutinas || []).length;
        if (total > 0) {
          window.alert(
            `Formulario importado. Reuniones enlazadas con la Asistencia de este ambiente: ${total - sinPar.length} de ${total}.` +
              (sinPar.length ? `\n\nNo se encontraron (revísalas en "Diálogos o rutinas"): ${sinPar.join(", ")}.` : "") +
              "\n\nLos evaluadores no viajan en el archivo: asígnalos en la pestaña Evaluadores antes de publicar."
          );
        }
      } catch {
        window.alert("Ese archivo no es un formulario de CdR válido. Usa un archivo exportado desde esta misma pantalla.");
      }
    };
    lector.readAsText(archivo);
  }

  function exportar(f) {
    const { id, asignados, asignadosUids, estado, creado, actualizado, creadoPor, version, ...contenido } = f;
    const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(f.nombre || "formulario").replace(/[^\wáéíóúñÁÉÍÓÚÑ -]+/g, "").trim().replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function borrar(f) {
    if (!window.confirm(`¿Eliminar el formulario "${f.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await eliminarFormulario(f.id);
    } catch (e) {
      window.alert(`No se pudo eliminar (${e.code || e.message}).`);
    }
  }

  if (editando) {
    return (
      <Editor
        inicial={editando.form}
        esNuevo={editando.esNuevo}
        usuarios={usuarios}
        rutinasAsistencia={rutinasAsistencia}
        errorRutinas={errorRutinas}
        onCerrar={() => setEditando(null)}
      />
    );
  }

  return (
    <div>
      <div style={E.barra}>
        <p className="ca-conteo" style={{ margin: 0 }}>
          Formularios de CdR {lista ? `(${lista.length})` : ""}
        </p>
        <button style={{ ...btnPrim, marginLeft: "auto" }} onClick={() => setModalNuevo(true)}>
          + Nuevo formulario
        </button>
      </div>

      {error && <p style={{ color: "var(--rojo)", fontSize: 14 }}>{error}</p>}

      {lista && lista.length === 0 && !error && (
        <div className="cdr-molde">
          <b>Aún no hay formularios</b>
          Crea el primero con "+ Nuevo formulario". Puedes partir de la pauta V3.0 ya cargada (17 criterios) y ajustarla a tu gusto.
        </div>
      )}

      {lista && lista.length > 0 && (
        <table className="ca-tabla cdr-apilada">
          <thead>
            <tr>
              <th>Formulario</th>
              <th>Estado</th>
              <th>Criterios</th>
              <th>Evaluadores</th>
              <th>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td>
                  <b>{f.nombre}</b>
                  {f.descripcion && (
                    <div style={{ fontSize: 12, color: "var(--texto-suave)", maxWidth: 380 }}>
                      {f.descripcion.length > 110 ? f.descripcion.slice(0, 110) + "…" : f.descripcion}
                    </div>
                  )}
                </td>
                <td data-label="Estado">
                  <span className={`ca-pill ${f.estado === "publicado" ? "ca-pill-verde" : "ca-pill-ambar"}`}>
                    {f.estado === "publicado" ? "Publicado" : "Borrador"}
                  </span>
                </td>
                <td data-label="Criterios">{contarCriterios(f)}</td>
                <td data-label="Evaluadores">{(f.asignadosUids || []).length}</td>
                <td data-label="Actualizado">{f.actualizado ? new Date(f.actualizado).toLocaleDateString("es-CL") : "—"}</td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button style={btn} onClick={() => setEditando({ form: normalizarFormulario(f), esNuevo: false })}>Editar</button>
                    <button style={btn} onClick={() => crearDesde({ ...f, estado: undefined }, "(copia)")}>Duplicar</button>
                    <button style={btn} onClick={() => setQrDe(f)}>QR</button>
                    <button style={btn} onClick={() => exportar(f)}>Exportar</button>
                    <button style={btnPel} onClick={() => borrar(f)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {qrDe && <ModalQR form={qrDe} onCerrar={() => setQrDe(null)} />}

      {modalNuevo && (
        <Modal titulo="Nuevo formulario" onCerrar={() => setModalNuevo(false)}>
          <div style={{ display: "grid", gap: 10 }}>
            <OpcionNuevo
              titulo="Pauta de CdR — Diálogo de Desempeño V3.0"
              texto="La pauta que ya definiste: 4 bloques, 17 criterios (críticos C6 y C10), con pesos que replican la pauta original. Cárgala y ajústala."
              onClick={() => crearDesde(PLANTILLA_PAUTA_V3)}
              destacado
            />
            <OpcionNuevo titulo="En blanco" texto="Parte con los datos generales básicos y un criterio de ejemplo." onClick={() => crearDesde(formularioEnBlanco())} />
            <OpcionNuevo
              titulo="Importar desde un archivo (.json)"
              texto="Sube un formulario exportado antes con el botón Exportar."
              onClick={() => inputArchivo.current?.click()}
            />
            <input ref={inputArchivo} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={importarArchivo} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function OpcionNuevo({ titulo, texto, onClick, destacado }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: destacado ? "var(--verde-claro)" : "#fff",
        border: `1.5px solid ${destacado ? "var(--verde)" : "var(--borde)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--texto)" }}>{titulo}</div>
      <div style={{ fontSize: 13, color: "var(--texto-suave)", marginTop: 3 }}>{texto}</div>
    </button>
  );
}

function Modal({ titulo, onCerrar, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,18,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "50px 16px", overflowY: "auto" }}
      onClick={onCerrar}
    >
      <div className="ca-card" style={{ maxWidth: 560, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 17 }}>{titulo}</p>
          <button style={btn} onClick={onCerrar}>Cerrar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editor de un formulario                                            */
/* ------------------------------------------------------------------ */

const TABS = [
  ["general", "General"],
  ["a", "A · Datos generales"],
  ["b", "B · Notas en terreno"],
  ["c", "C · Rúbrica y pesos"],
  ["d", "D · Resultado"],
  ["e", "E · Feedback"],
  ["evaluadores", "Evaluadores"],
  ["previa", "Vista previa"],
];

function mover(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function Editor({ inicial, esNuevo, usuarios, rutinasAsistencia, errorRutinas, onCerrar }) {
  const [form, setForm] = useState(() => {
    const f = normalizarFormulario(inicial);
    f.asignadosUids = f.asignadosUids || [];
    f.asignados = f.asignados || [];
    return f;
  });
  const [sucio, setSucio] = useState(!!esNuevo);
  const [yaGuardado, setYaGuardado] = useState(!esNuevo);
  const [tab, setTab] = useState("general");
  const [guardando, setGuardando] = useState(false);
  const [verQr, setVerQr] = useState(false);
  const [aviso, setAviso] = useState({ tipo: "", texto: "" });

  function cambiar(fn) {
    setForm((prev) => {
      const c = clonar(prev);
      fn(c);
      return c;
    });
    setSucio(true);
    setAviso({ tipo: "", texto: "" });
  }

  function validar(paraPublicar) {
    const errores = [];
    if (!form.nombre.trim()) errores.push("El formulario necesita un nombre.");
    const codigos = new Set();
    for (const b of form.bloques) {
      for (const c of b.criterios) {
        if (!c.codigo.trim()) errores.push("Hay un criterio sin código.");
        else if (codigos.has(c.codigo.trim())) errores.push(`El código ${c.codigo} está repetido.`);
        codigos.add(c.codigo.trim());
        if (!c.nombre.trim()) errores.push(`El criterio ${c.codigo || "(sin código)"} no tiene nombre.`);
        if (paraPublicar && (!c.nivel2.trim() || !c.nivel1.trim() || !c.nivel0.trim())) {
          errores.push(`El criterio ${c.codigo} necesita los tres descriptores (2, 1 y 0) para publicarse.`);
        }
      }
    }
    if (paraPublicar) {
      if (codigos.size === 0) errores.push("Para publicar, agrega al menos un criterio.");
      errores.push(...erroresDePesos(form));
      if (form.seccionA.some((c) => c.tipo === "rutina")) {
        if (form.rutinas.length === 0) errores.push("Marca al menos una rutina seleccionable en la pestaña A.");
        const sinLider = form.rutinas.filter((r) => !(r.lideres || []).length).map((r) => r.nombre);
        if (sinLider.length) errores.push(`Falta definir al menos un líder de: ${sinLider.join(", ")}.`);
      }
    }
    return [...new Set(errores)];
  }

  async function guardar(estadoNuevo) {
    const paraPublicar = estadoNuevo === "publicado";
    const errores = validar(paraPublicar);
    if (errores.length) {
      setAviso({ tipo: "error", texto: errores.slice(0, 4).join(" ") });
      return;
    }
    setGuardando(true);
    try {
      const f = clonar(form);
      f.estado = estadoNuevo || f.estado || "borrador";
      f.version = yaGuardado ? (f.version || 1) + 1 : f.version || 1;
      f.actualizado = new Date().toISOString();
      f.seccionA.forEach((c) => (c.opciones = (c.opciones || []).filter(Boolean)));
      f.seccionB.puntos = f.seccionB.puntos.filter((p) => (p.texto || "").trim());
      await guardarFormulario(f);
      setForm(f);
      setSucio(false);
      setYaGuardado(true);
      setAviso({ tipo: "ok", texto: paraPublicar ? "Formulario publicado." : f.estado === "publicado" ? "Cambios guardados." : "Borrador guardado." });
    } catch (e) {
      console.error(e);
      setAviso({ tipo: "error", texto: `No se pudo guardar (${e.code || e.message}).` });
    } finally {
      setGuardando(false);
    }
  }

  function volver() {
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Salir de todos modos?")) return;
    onCerrar();
  }

  const hayErrorPesos = erroresDePesos(form).length > 0;

  return (
    <div>
      <div style={E.barra}>
        <button style={btn} onClick={volver}>← Volver a la lista</button>
        <span className={`ca-pill ${form.estado === "publicado" ? "ca-pill-verde" : "ca-pill-ambar"}`}>
          {form.estado === "publicado" ? "Publicado" : "Borrador"}
        </span>
        {sucio && <span style={{ fontSize: 13, color: "var(--ambar)", fontWeight: 700 }}>● Cambios sin guardar</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn} disabled={!yaGuardado} title={yaGuardado ? "QR para abrir este formulario desde el celular" : "Guarda el formulario primero"} onClick={() => setVerQr(true)}>QR</button>
          <button style={btn} disabled={guardando} onClick={() => guardar(form.estado === "publicado" ? "borrador" : undefined)}>
            {form.estado === "publicado" ? "Pasar a borrador" : "Guardar borrador"}
          </button>
          <button style={btnPrim} disabled={guardando} onClick={() => guardar("publicado")}>
            {guardando ? "Guardando…" : form.estado === "publicado" ? "Guardar cambios" : "Publicar"}
          </button>
        </div>
      </div>

      {verQr && <ModalQR form={form} onCerrar={() => setVerQr(false)} />}

      {aviso.texto && (
        <p style={{ fontSize: 14, fontWeight: 600, color: aviso.tipo === "error" ? "var(--rojo)" : "#0f6e56", margin: "0 0 12px" }}>{aviso.texto}</p>
      )}

      <div style={E.tabs}>
        {TABS.map(([id, nombre]) => (
          <button key={id} style={{ ...E.tab, ...(tab === id ? E.tabAct : {}) }} onClick={() => setTab(id)}>
            {nombre}
            {id === "c" && hayErrorPesos && <span style={{ color: "var(--rojo)" }}> ●</span>}
          </button>
        ))}
      </div>

      {tab === "general" && <TabGeneral form={form} cambiar={cambiar} />}
      {tab === "a" && <TabA form={form} cambiar={cambiar} usuarios={usuarios} rutinasAsistencia={rutinasAsistencia} errorRutinas={errorRutinas} />}
      {tab === "b" && <TabB form={form} cambiar={cambiar} />}
      {tab === "c" && <TabC form={form} cambiar={cambiar} />}
      {tab === "d" && <TabD form={form} />}
      {tab === "e" && <TabE form={form} cambiar={cambiar} />}
      {tab === "evaluadores" && <TabEvaluadores form={form} cambiar={cambiar} usuarios={usuarios} />}
      {tab === "previa" && <VistaPrevia form={form} />}
    </div>
  );
}

/* ---------------------------- Pestañas ----------------------------- */

function Campo({ etiqueta, children, ayuda }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="ca-label">{etiqueta}</label>
      {children}
      {ayuda && <div style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 4 }}>{ayuda}</div>}
    </div>
  );
}

function TabGeneral({ form, cambiar }) {
  const p = form.parametros;
  return (
    <div className="ca-card" style={{ maxWidth: 760 }}>
      <Campo etiqueta="Nombre del formulario">
        <input className="rp-input" value={form.nombre} onChange={(e) => cambiar((f) => (f.nombre = e.target.value))} />
      </Campo>
      <Campo etiqueta="Descripción / a quién aplica">
        <textarea className="rp-textarea" rows={3} value={form.descripcion || ""} onChange={(e) => cambiar((f) => (f.descripcion = e.target.value))} />
      </Campo>
      <p style={{ fontWeight: 800, margin: "18px 0 8px" }}>Rangos del resultado</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Campo etiqueta="Rutina efectiva desde (%)">
          <input className="rp-input" type="number" min="0" max="100" style={{ width: 120 }} value={p.umbralEfectiva} onChange={(e) => cambiar((f) => (f.parametros.umbralEfectiva = Number(e.target.value)))} />
        </Campo>
        <Campo etiqueta="En desarrollo desde (%)">
          <input className="rp-input" type="number" min="0" max="100" style={{ width: 120 }} value={p.umbralDesarrollo} onChange={(e) => cambiar((f) => (f.parametros.umbralDesarrollo = Number(e.target.value)))} />
        </Campo>
      </div>
      <p style={{ fontSize: 13, color: "var(--texto-suave)", margin: 0 }}>
        Rutina efectiva: ≥ {p.umbralEfectiva}% y sin críticos en 0 · En desarrollo: {p.umbralDesarrollo}–{p.umbralEfectiva - 1}%, o ≥ {p.umbralEfectiva}% con un crítico en 0 · Requiere intervención: &lt; {p.umbralDesarrollo}%.
      </p>
    </div>
  );
}

function BotonesFila({ i, n, onMover, onBorrar }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button style={btnIco} disabled={i === 0} onClick={() => onMover(-1)} title="Subir">↑</button>
      <button style={btnIco} disabled={i === n - 1} onClick={() => onMover(1)} title="Bajar">↓</button>
      <button style={{ ...btnIco, color: "var(--rojo)" }} onClick={onBorrar} title="Eliminar">✕</button>
    </div>
  );
}

/* ----- A · Datos generales ----- */

const TIPOS_A = [
  ["rutina", "Diálogo o rutina (de la lista de Asistencia)"],
  ["lider", "Líder (según la rutina elegida)"],
  ["evaluador", "Evaluador (lista: tú, asignados y asistentes de Asistencia)"],
  ["texto", "Texto"],
  ["fecha", "Fecha"],
  ["hora", "Hora"],
  ["numero", "Número"],
  ["seleccion", "Lista de opciones"],
];

function TabA({ form, cambiar, usuarios, rutinasAsistencia, errorRutinas }) {
  const n = form.seccionA.length;
  return (
    <div style={{ maxWidth: 980 }}>
      <p style={E.ayuda}>
        Datos que el evaluador completa al empezar. El diálogo o rutina se elige de una lista, y el líder se completa solo según la rutina elegida.
      </p>
      {form.seccionA.map((c, i) => (
        <div key={c.id} style={E.fila}>
          <div style={{ flex: "2 1 220px" }}>
            <input className="rp-input" value={c.etiqueta} placeholder="Etiqueta" onChange={(e) => cambiar((f) => (f.seccionA[i].etiqueta = e.target.value))} />
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <select className="rp-select" value={c.tipo} onChange={(e) => cambiar((f) => (f.seccionA[i].tipo = e.target.value))}>
              {TIPOS_A.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          {c.tipo === "seleccion" && (
            <div style={{ flex: "2 1 220px" }}>
              <input className="rp-input" defaultValue={(c.opciones || []).join(", ")} placeholder="Opciones separadas por coma"
                onBlur={(e) => cambiar((f) => (f.seccionA[i].opciones = e.target.value.split(",").map((s) => s.trim()).filter(Boolean)))} />
            </div>
          )}
          <label style={E.check}>
            <input type="checkbox" checked={!!c.obligatorio} onChange={(e) => cambiar((f) => (f.seccionA[i].obligatorio = e.target.checked))} /> Obligatorio
          </label>
          <BotonesFila i={i} n={n} onMover={(d) => cambiar((f) => mover(f.seccionA, i, d))} onBorrar={() => cambiar((f) => f.seccionA.splice(i, 1))} />
        </div>
      ))}
      <button style={btn} onClick={() => cambiar((f) => f.seccionA.push({ id: nuevoId("a"), etiqueta: "", tipo: "texto", opciones: [], obligatorio: false }))}>
        + Agregar dato
      </button>

      <RutinasSeleccionables form={form} cambiar={cambiar} usuarios={usuarios} rutinasAsistencia={rutinasAsistencia} errorRutinas={errorRutinas} />
    </div>
  );
}

function RutinasSeleccionables({ form, cambiar, usuarios, rutinasAsistencia, errorRutinas }) {
  const [buscar, setBuscar] = useState("");
  const tieneCampo = form.seccionA.some((c) => c.tipo === "rutina");
  const lista = rutinasAsistencia || [];
  const q = buscar.trim().toLowerCase();
  const visibles = lista.filter((s) => !q || `${s.nombre} ${s.area || ""}`.toLowerCase().includes(q));
  const idsAsistencia = new Set(lista.map((s) => s.id));
  const huerfanas = form.rutinas.filter((r) => !idsAsistencia.has(r.sesionId));
  const sinLider = form.rutinas.filter((r) => !(r.lideres || []).length).length;
  const nombresPersonas = useMemo(
    () => [...new Set(usuarios.filter((u) => u.rol !== "deshabilitado" && u.estado !== "pendiente").map((u) => u.nombreUsuario))].sort((a, b) => a.localeCompare(b, "es")),
    [usuarios]
  );
  const seleccion = (id) => form.rutinas.find((r) => r.sesionId === id);

  function alternar(s) {
    cambiar((f) => {
      const i = f.rutinas.findIndex((r) => r.sesionId === s.id);
      if (i >= 0) f.rutinas.splice(i, 1);
      else f.rutinas.push({ sesionId: s.id, nombre: s.nombre, area: s.area || "", horaInicio: s.horaInicio || "", horaFin: s.horaFin || "", lideres: [] });
    });
  }
  function fijarLideres(id, lista) {
    cambiar((f) => {
      const r = f.rutinas.find((x) => x.sesionId === id);
      if (r) r.lideres = lista;
    });
  }
  function marcarVisibles() {
    cambiar((f) => {
      for (const s of visibles) {
        if (!f.rutinas.some((r) => r.sesionId === s.id)) f.rutinas.push({ sesionId: s.id, nombre: s.nombre, area: s.area || "", horaInicio: s.horaInicio || "", horaFin: s.horaFin || "", lideres: [] });
      }
    });
  }

  return (
    <div className="ca-card" style={{ marginTop: 22 }}>
      <p style={{ fontWeight: 800, margin: "0 0 4px", fontSize: 15 }}>Diálogos o rutinas seleccionables en este formulario</p>
      <p style={E.ayuda}>
        La lista sale de las reuniones de Control de Asistencia. Marca las que se podrán elegir en este formulario y agrega el líder de cada una.
        Si una reunión tiene varios líderes, agrégalos todos: al evaluar se elige quién lideró esa sesión (se guarda aquí, en la CdR; no modifica Asistencia).
      </p>
      {!tieneCampo && (
        <p style={{ fontSize: 13, color: "var(--ambar)", fontWeight: 600 }}>
          Este formulario no tiene un dato de tipo "Diálogo o rutina". Agrégalo arriba para que esta lista se use.
        </p>
      )}
      {errorRutinas && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{errorRutinas}</p>}
      {rutinasAsistencia === null && !errorRutinas && <p style={E.ayuda}>Cargando reuniones de Asistencia…</p>}

      <datalist id="lista-lideres">{nombresPersonas.map((n) => <option key={n} value={n} />)}</datalist>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <input className="rp-input" style={{ maxWidth: 300 }} placeholder="Buscar reunión o área…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <button style={btn} onClick={marcarVisibles}>Marcar las visibles</button>
        <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>
          <b>{form.rutinas.length}</b> seleccionada(s){sinLider > 0 && <span style={{ color: "var(--rojo)" }}> · {sinLider} sin líder</span>}
        </span>
      </div>

      {huerfanas.length > 0 && (
        <div style={{ fontSize: 13, color: "var(--rojo)", marginBottom: 10 }}>
          <b>Ya no existen (o están inactivas) en Asistencia:</b> {huerfanas.map((r) => r.nombre).join(", ")}.{" "}
          <button style={btn} onClick={() => cambiar((f) => (f.rutinas = f.rutinas.filter((r) => idsAsistencia.has(r.sesionId))))}>Quitarlas</button>
        </div>
      )}

      <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid var(--borde)", borderRadius: 10 }}>
        <table className="ca-tabla" style={{ border: "none", borderRadius: 0 }}>
          <thead>
            <tr><th style={{ width: 40 }}></th><th>Reunión</th><th>Área</th><th>Cuándo</th><th style={{ minWidth: 260 }}>Líder(es) del diálogo</th></tr>
          </thead>
          <tbody>
            {visibles.map((s) => {
              const sel = seleccion(s.id);
              return (
                <tr key={s.id} style={sel ? { background: "var(--verde-claro)" } : undefined}>
                  <td><input type="checkbox" checked={!!sel} onChange={() => alternar(s)} /></td>
                  <td><b>{s.nombre}</b></td>
                  <td>{s.area || "—"}</td>
                  <td style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{describirFrecuencia(s)}</td>
                  <td>
                    <EditorLideres lideres={sel ? sel.lideres || [] : []} disabled={!sel} onCambiar={(l) => fijarLideres(s.id, l)} />
                  </td>
                </tr>
              );
            })}
            {rutinasAsistencia && visibles.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--texto-suave)" }}>{lista.length === 0 ? "No hay reuniones activas en Asistencia." : "Ninguna reunión coincide con la búsqueda."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditorLideres({ lideres, disabled, onCambiar }) {
  const [texto, setTexto] = useState("");
  function agregar() {
    const n = texto.trim();
    if (!n) return;
    if (!lideres.some((l) => l.toLowerCase() === n.toLowerCase())) onCambiar([...lideres, n]);
    setTexto("");
  }
  return (
    <div>
      {lideres.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 5 }}>
          {lideres.map((l) => (
            <span key={l} className="ca-chip" style={{ fontWeight: 600 }}>
              {l}
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--rojo)", padding: 0, fontSize: 12 }} title="Quitar" onClick={() => onCambiar(lideres.filter((x) => x !== l))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 4 }}>
        <input
          className="rp-input"
          list="lista-lideres"
          disabled={disabled}
          value={texto}
          placeholder={disabled ? "Marca la reunión primero" : lideres.length ? "Agregar otro líder" : "Nombre del líder"}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          onBlur={agregar}
        />
        <button style={btnIco} disabled={disabled || !texto.trim()} onClick={agregar} title="Agregar líder">+</button>
      </div>
    </div>
  );
}

/* ----- B · Notas en terreno ----- */

function TabB({ form, cambiar }) {
  const puntos = form.seccionB.puntos;
  const codigos = form.bloques.flatMap((b) => b.criterios.map((c) => c.codigo)).filter(Boolean);
  return (
    <div style={{ maxWidth: 940 }}>
      <div className="ca-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: "0 0 4px", fontWeight: 800 }}>Para qué sirve</p>
        <p style={{ ...E.ayuda, margin: 0 }}>
          Durante la sesión el evaluador escribe notas rápidas de lo que observa. No se califica nada acá: es un ayuda memoria que después le sirve
          para calificar la rúbrica y, sobre todo, para dar un feedback más profundo (sus notas se le mostrarán junto a cada casilla del feedback).
          Abajo defines los "puntos a observar": recordatorios que el evaluador puede tocar para empezar una nota.
        </p>
      </div>

      <p style={{ fontWeight: 800, margin: "0 0 8px" }}>Puntos a observar (opcionales)</p>
      <datalist id="lista-codigos">{codigos.map((c) => <option key={c} value={c} />)}</datalist>
      {puntos.map((p, i) => (
        <div key={p.id} style={E.fila}>
          <div style={{ flex: "4 1 360px" }}>
            <input className="rp-input" value={p.texto} placeholder="Qué conviene observar o anotar" onChange={(e) => cambiar((f) => (f.seccionB.puntos[i].texto = e.target.value))} />
          </div>
          <div style={{ flex: "0 1 140px" }}>
            <input className="rp-input" list="lista-codigos" value={p.criterio || ""} placeholder="Criterio (ej. C5)" title="Criterio(s) relacionado(s), opcional" onChange={(e) => cambiar((f) => (f.seccionB.puntos[i].criterio = e.target.value))} />
          </div>
          <BotonesFila i={i} n={puntos.length} onMover={(d) => cambiar((f) => mover(f.seccionB.puntos, i, d))} onBorrar={() => cambiar((f) => f.seccionB.puntos.splice(i, 1))} />
        </div>
      ))}
      <button style={btn} onClick={() => cambiar((f) => f.seccionB.puntos.push({ id: nuevoId("p"), texto: "", criterio: "" }))}>+ Agregar punto</button>

      <div className="ca-card" style={{ marginTop: 18 }}>
        <label style={E.check}>
          <input type="checkbox" checked={!!form.seccionB.horaAutomatica} onChange={(e) => cambiar((f) => (f.seccionB.horaAutomatica = e.target.checked))} />
          Marcar automáticamente la hora de cada nota (sirve para ubicar el momento exacto de la sesión)
        </label>
      </div>
    </div>
  );
}

/* ----- C · Rúbrica y pesos ----- */

function InputPeso({ valor, onCambiar, titulo, ancho = 78 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input
        className="rp-input"
        type="number"
        min="0"
        max="100"
        step="0.1"
        title={titulo}
        style={{ width: ancho, textAlign: "right", fontWeight: 700 }}
        value={valor}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onCambiar(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>%</span>
    </span>
  );
}

function Suma({ valor, textoOk, textoMal }) {
  const ok = valor === 100;
  return (
    <span className={`ca-pill ${ok ? "ca-pill-verde" : "ca-pill-rojo"}`}>
      {ok ? `✓ ${textoOk}` : `✕ ${textoMal}: ${fmt(valor)}%`}
    </span>
  );
}

function TabC({ form, cambiar }) {
  const sumaBloques = sumar(form.bloques.map((b) => b.peso));
  function siguienteCodigo() {
    let max = 0;
    form.bloques.forEach((b) => b.criterios.forEach((c) => {
      const m = /^C(\d+)$/i.exec(c.codigo.trim());
      if (m) max = Math.max(max, Number(m[1]));
    }));
    return `C${max + 1}`;
  }
  return (
    <div style={{ maxWidth: 1000 }}>
      <p style={E.ayuda}>
        Cada bloque pesa un % del total (los bloques deben sumar 100%) y cada criterio pesa un % de su bloque (los criterios de cada bloque deben sumar 100%).
        El resultado se calcula con estos pesos. Si un criterio queda N/A, su peso se reparte entre los demás criterios de su bloque. Para publicar, todo debe sumar 100%.
      </p>

      <div className="ca-card" style={{ marginBottom: 16, borderColor: sumaBloques === 100 ? "var(--borde)" : "var(--rojo)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <b>Peso de los bloques en el total</b>
          <Suma valor={sumaBloques} textoOk="Suman 100%" textoMal="Suman" />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn} onClick={() => cambiar((f) => { const p = repartirIgual(f.bloques.length); f.bloques.forEach((b, i) => (b.peso = p[i])); })}>Partes iguales</button>
            <button style={btn} onClick={() => cambiar((f) => { const p = repartirProporcional(f.bloques.map((b) => b.criterios.length || 1)); f.bloques.forEach((b, i) => (b.peso = p[i])); })}>Proporcional a la cantidad de criterios</button>
          </div>
        </div>
      </div>

      {form.bloques.map((b, bi) => {
        const sumaCrit = sumar(b.criterios.map((c) => c.peso));
        return (
          <div key={b.id} className="ca-card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, color: "var(--verde-oscuro)" }}>Bloque {bi + 1}</span>
              <input className="rp-input" style={{ flex: "1 1 240px", fontWeight: 700 }} value={b.nombre} onChange={(e) => cambiar((f) => (f.bloques[bi].nombre = e.target.value))} />
              <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>Peso en el total</span>
              <InputPeso valor={b.peso} titulo="Peso del bloque en el total" onCambiar={(v) => cambiar((f) => (f.bloques[bi].peso = v))} />
              <BotonesFila i={bi} n={form.bloques.length} onMover={(d) => cambiar((f) => mover(f.bloques, bi, d))}
                onBorrar={() => {
                  if (b.criterios.length && !window.confirm(`¿Eliminar el bloque "${b.nombre}" y sus ${b.criterios.length} criterio(s)?`)) return;
                  cambiar((f) => f.bloques.splice(bi, 1));
                }} />
            </div>

            {b.criterios.map((c, ci) => (
              <div key={c.id} style={E.criterio}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <input className="rp-input" style={{ width: 70, fontWeight: 800 }} value={c.codigo} onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci].codigo = e.target.value))} />
                  <input className="rp-input" style={{ flex: "1 1 240px" }} value={c.nombre} placeholder="Nombre del criterio" onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci].nombre = e.target.value))} />
                  <input className="rp-input" style={{ width: 100 }} value={c.refV24 || ""} placeholder="Ref. (P4)" title="Referencia a la pauta anterior (opcional)" onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci].refV24 = e.target.value))} />
                  <InputPeso valor={c.peso} titulo="Peso del criterio dentro de su bloque" onCambiar={(v) => cambiar((f) => (f.bloques[bi].criterios[ci].peso = v))} />
                  <span style={{ fontSize: 12, color: "var(--texto-suave)", minWidth: 90 }} title="Peso efectivo en el total">= {fmt((b.peso * c.peso) / 100)}% del total</span>
                  <BotonesFila i={ci} n={b.criterios.length} onMover={(d) => cambiar((f) => mover(f.bloques[bi].criterios, ci, d))} onBorrar={() => cambiar((f) => f.bloques[bi].criterios.splice(ci, 1))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 8 }}>
                  {[["nivel2", "2 · Cumple"], ["nivel1", "1 · Parcial"], ["nivel0", "0 · No cumple"]].map(([k, t]) => (
                    <div key={k}>
                      <div style={E.mini}>{t}</div>
                      <textarea className="rp-textarea" rows={3} value={c[k]} onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci][k] = e.target.value))} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={E.mini}>Cómo verificar</div>
                  <textarea className="rp-textarea" rows={2} value={c.verificar || ""} onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci].verificar = e.target.value))} />
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
                  <label style={E.check}>
                    <input type="checkbox" checked={!!c.critico} onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci].critico = e.target.checked))} /> ★ Criterio crítico
                  </label>
                  <label style={E.check}>
                    <input type="checkbox" checked={!!c.admiteNA} onChange={(e) => cambiar((f) => (f.bloques[bi].criterios[ci].admiteNA = e.target.checked))} /> Admite N/A
                  </label>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={btn} onClick={() => cambiar((f) => f.bloques[bi].criterios.push({ id: nuevoId("c"), codigo: siguienteCodigo(), nombre: "", refV24: "", nivel2: "", nivel1: "", nivel0: "", verificar: "", critico: false, admiteNA: false, peso: 0 }))}>
                + Agregar criterio
              </button>
              {b.criterios.length > 0 && (
                <>
                  <Suma valor={sumaCrit} textoOk="Criterios suman 100%" textoMal="Los criterios suman" />
                  <button style={btn} onClick={() => cambiar((f) => { const p = repartirIgual(f.bloques[bi].criterios.length); f.bloques[bi].criterios.forEach((c2, i) => (c2.peso = p[i])); })}>
                    Partes iguales
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <button style={btn} onClick={() => cambiar((f) => f.bloques.push({ id: nuevoId("b"), nombre: "Bloque nuevo", peso: 0, criterios: [] }))}>
        + Agregar bloque
      </button>
    </div>
  );
}

/* ----- D · Resultado ----- */

function TabD({ form }) {
  const [niveles, setNiveles] = useState({});
  const respuestas = {};
  form.bloques.forEach((b) => b.criterios.forEach((c) => {
    const v = niveles[c.codigo];
    respuestas[c.codigo] = v === undefined || (v === "NA" && !c.admiteNA) ? 2 : v;
  }));
  const res = calcularResultado(form, respuestas);
  const erroresPeso = erroresDePesos(form);
  const colorClase = { efectiva: "ca-pill-verde", desarrollo: "ca-pill-ambar", intervencion: "ca-pill-rojo" }[res.clasificacion];
  const criticos = form.bloques.flatMap((b) => b.criterios.filter((c) => c.critico).map((c) => c.codigo));
  const p = form.parametros;

  return (
    <div style={{ maxWidth: 1000 }}>
      <div className="ca-card" style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 800 }}>Cómo se calcula el resultado (automático)</p>
        <p style={{ ...E.ayuda, margin: "0 0 10px" }}>
          Índice = suma de los puntajes de cada bloque × el peso del bloque. El puntaje de un bloque es el promedio de sus criterios ponderado por el peso de cada uno
          (2 = 100%, 1 = 50%, 0 = 0%). Los pesos se editan en la pestaña C y los rangos en General.
        </p>
        <table className="ca-tabla">
          <thead><tr><th>Bloque</th><th>Peso en el total</th><th>Criterios</th></tr></thead>
          <tbody>
            {form.bloques.map((b) => (
              <tr key={b.id}><td>{b.nombre}</td><td><b>{fmt(b.peso)}%</b></td><td style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>{b.criterios.map((c) => `${c.codigo} ${fmt(c.peso)}%`).join(" · ") || "—"}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "var(--texto-suave)", margin: "10px 0 0" }}>
          Efectiva: ≥ {p.umbralEfectiva}% y sin críticos en 0 · En desarrollo: {p.umbralDesarrollo}–{p.umbralEfectiva - 1}% (o ≥ {p.umbralEfectiva}% con un crítico en 0) · Requiere intervención: &lt; {p.umbralDesarrollo}%.
          {criticos.length > 0 && <> Criterios críticos: <b>{criticos.join(", ")}</b>.</>}
        </p>
        {erroresPeso.length > 0 && <p style={{ color: "var(--rojo)", fontSize: 13, fontWeight: 600, margin: "8px 0 0" }}>{erroresPeso.join(" ")}</p>}
      </div>

      <div className="ca-card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Probar el cálculo</p>
          <span style={{ fontSize: 28, fontWeight: 800 }}>{fmt(res.indice)}%</span>
          <span className={`ca-pill ${colorClase}`}>{ETIQUETA_CLASIFICACION[res.clasificacion]}</span>
          {res.criticosEnCero.length > 0 && <span className="ca-pill ca-pill-rojo">Crítico en 0: {res.criticosEnCero.join(", ")}</span>}
          <button style={{ ...btn, marginLeft: "auto" }} onClick={() => setNiveles({})}>Todo en 2</button>
        </div>
        <p style={{ ...E.ayuda, margin: "0 0 10px" }}>Cambia el nivel de cualquier criterio y mira cómo se mueve el resultado. Es solo una simulación: no se guarda nada.</p>
        {form.bloques.map((b, i) => (
          <div key={b.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              {b.nombre} <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}>· peso {fmt(b.peso)}% · puntaje {res.bloques[i].puntaje === null ? "—" : fmt(res.bloques[i].puntaje) + "%"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
              {b.criterios.map((c) => (
                <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, border: "1px solid var(--borde)", borderRadius: 8, padding: "5px 8px" }}>
                  <b style={{ minWidth: 30 }}>{c.codigo}{c.critico ? "★" : ""}</b>
                  <span style={{ flex: 1, color: "var(--texto-suave)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.nombre}>{c.nombre}</span>
                  <select className="rp-select" style={{ width: 70 }} value={respuestas[c.codigo]} onChange={(e) => setNiveles((n) => ({ ...n, [c.codigo]: e.target.value === "NA" ? "NA" : Number(e.target.value) }))}>
                    <option value={2}>2</option>
                    <option value={1}>1</option>
                    <option value={0}>0</option>
                    {c.admiteNA && <option value="NA">N/A</option>}
                  </select>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----- E · Feedback ----- */

function TabE({ form, cambiar }) {
  const fb = form.feedback;
  return (
    <div className="ca-card" style={{ maxWidth: 760 }}>
      <p style={E.ayuda}>Qué se le pide al evaluador para apoyar el feedback al líder. El feedback es obligatorio: todo lo que actives aquí se exige para poder enviar la CdR. Las fortalezas y oportunidades van en el paso 4; el seguimiento y el compromiso con el líder, en el paso 5.</p>
      <div style={{ background: "var(--verde-claro)", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, marginBottom: 14 }}>
        📝 Al ejecutar la CdR, antes de las fortalezas y oportunidades se muestra una tarjeta con las <b>notas que el evaluador anotó en terreno (B)</b>, para que las lea antes de escribir el feedback.
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <label style={E.check}><input type="checkbox" checked={!!fb.fortalezas} onChange={(e) => cambiar((f) => (f.feedback.fortalezas = e.target.checked))} /> Fortalezas identificadas</label>
        <label style={E.check}><input type="checkbox" checked={!!fb.oportunidades} onChange={(e) => cambiar((f) => (f.feedback.oportunidades = e.target.checked))} /> Oportunidades de mejora</label>
        <label style={E.check}><input type="checkbox" checked={!!fb.compromisoMejora} onChange={(e) => cambiar((f) => (f.feedback.compromisoMejora = e.target.checked))} /> Compromiso de mejora acordado con el líder (acción, responsable, fecha)</label>
        <label style={E.check}><input type="checkbox" checked={!!fb.seguimientoAnterior} onChange={(e) => cambiar((f) => (f.feedback.seguimientoAnterior = e.target.checked))} /> Seguimiento al compromiso de la CdR anterior</label>
        <label style={E.check}><input type="checkbox" checked={!!fb.situacion} onChange={(e) => cambiar((f) => (f.feedback.situacion = e.target.checked))} /> Incluir «Situación» (cuándo y dónde ocurrió) en cada fortaleza y oportunidad. Si está apagado se piden solo comportamiento e impacto.</label>
      </div>
      <Campo etiqueta="Máximo de fortalezas y de oportunidades a registrar">
        <input className="rp-input" type="number" min="1" max="5" style={{ width: 100 }} value={fb.maxPorTipo} onChange={(e) => cambiar((f) => (f.feedback.maxPorTipo = Number(e.target.value)))} />
      </Campo>
    </div>
  );
}

/* ----- Evaluadores ----- */

function TabEvaluadores({ form, cambiar, usuarios }) {
  const [buscar, setBuscar] = useState("");
  const elegibles = useMemo(
    () => usuarios.filter((u) => u.estado !== "pendiente" && u.rol !== "deshabilitado" && (u.rol === "master" || (Array.isArray(u.apps) && u.apps.includes("cdr")))),
    [usuarios]
  );
  const uidsElegibles = new Set(elegibles.map((u) => u.uid));
  const sinAcceso = form.asignados.filter((a) => !uidsElegibles.has(a.uid));
  const q = buscar.trim().toLowerCase();
  const visibles = elegibles.filter((u) => !q || `${u.nombreUsuario} ${u.area || ""} ${u.cargo || ""}`.toLowerCase().includes(q));

  function alternar(u) {
    cambiar((f) => {
      if (f.asignadosUids.includes(u.uid)) {
        f.asignadosUids = f.asignadosUids.filter((x) => x !== u.uid);
        f.asignados = f.asignados.filter((x) => x.uid !== u.uid);
      } else {
        f.asignadosUids.push(u.uid);
        f.asignados.push({ uid: u.uid, nombre: u.nombreUsuario, correo: u.correo || "" });
      }
    });
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <p style={E.ayuda}>
        Quiénes pueden ejecutar este formulario. Solo aparecen personas que ya tienen acceso a la CdR (se activa en <b>Administración</b>). Un formulario en borrador no lo ve ningún evaluador. Esta lista también alimenta el dato "Evaluador": se sugiere primero quien inició sesión, luego los asignados y después los asistentes de Control de Asistencia.
      </p>
      <div className="ca-card" style={{ marginBottom: 16 }}>
        <label style={E.check}>
          <input type="checkbox" checked={form.accesoSinSesion !== false} onChange={(e) => cambiar((f) => (f.accesoSinSesion = e.target.checked))} />
          <b>Permitir abrir con el QR sin iniciar sesión</b>
        </label>
        <p style={{ ...E.ayuda, margin: "6px 0 0" }}>
          Activado: quien escanee el QR elige su nombre de la lista de asistentes de Control de Asistencia y no necesita usuario ni contraseña; cualquiera con el QR puede registrar una CdR.
          Desactivado: debe iniciar sesión y estar asignado abajo.
        </p>
      </div>
      <p style={{ fontWeight: 700, margin: "0 0 8px" }}>{form.asignadosUids.length} evaluador(es) asignado(s)</p>
      <input className="rp-input" style={{ maxWidth: 320, marginBottom: 10 }} placeholder="Buscar por nombre, área o cargo…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {elegibles.length === 0 && (
        <div className="cdr-molde"><b>Aún nadie tiene acceso a la CdR</b>Ve a Administración y activa el chip "CdR Diálogo de Desempeño" en las personas que serán evaluadoras.</div>
      )}
      <div className="ca-card" style={{ padding: 0, maxHeight: 380, overflowY: "auto" }}>
        {visibles.map((u) => (
          <label key={u.uid} style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--fondo)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.asignadosUids.includes(u.uid)} onChange={() => alternar(u)} />
            <span style={{ fontWeight: 600, flex: "1 1 150px" }}>{u.nombreUsuario}</span>
            <span style={{ fontSize: 12, color: "var(--texto-suave)", flex: "1 1 150px" }}>{[u.cargo, u.area].filter(Boolean).join(" · ")}</span>
          </label>
        ))}
        {elegibles.length > 0 && visibles.length === 0 && <div style={{ padding: 14, fontSize: 13, color: "var(--texto-suave)" }}>Nadie coincide con la búsqueda.</div>}
      </div>
      {sinAcceso.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: "var(--rojo)" }}>
          <b>Asignados que ya no tienen acceso a la CdR:</b> {sinAcceso.map((a) => a.nombre).join(", ")}.{" "}
          <button style={btn} onClick={() => cambiar((f) => {
            const quitar = new Set(sinAcceso.map((a) => a.uid));
            f.asignados = f.asignados.filter((a) => !quitar.has(a.uid));
            f.asignadosUids = f.asignadosUids.filter((u) => !quitar.has(u));
          })}>Quitarlos</button>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Vista previa -------------------------- */

function CampoPrevio({ c, form }) {
  const base = { className: "rp-input", disabled: true };
  if (c.tipo === "rutina") {
    return (
      <select className="rp-select" disabled>
        <option>{form.rutinas.length ? "Elige la rutina…" : "(aún no hay rutinas seleccionables)"}</option>
        {form.rutinas.map((r) => <option key={r.sesionId}>{r.nombre}</option>)}
      </select>
    );
  }
  if (c.tipo === "lider") return <input {...base} readOnly value="(según la rutina; si tiene varios líderes, eliges quién lideró)" />;
  if (c.tipo === "seleccion") return <select className="rp-select" disabled><option>{(c.opciones || []).join(" / ") || "Opciones…"}</option></select>;
  if (c.tipo === "fecha") return <input type="date" {...base} />;
  if (c.tipo === "hora") return <input type="time" {...base} />;
  if (c.tipo === "numero") return <input type="number" {...base} />;
  if (c.tipo === "evaluador") {
    return (
      <select className="rp-select" disabled>
        <option>Escribe o elige: tú primero, luego los asignados y los asistentes de Asistencia</option>
        {form.asignados.map((a) => <option key={a.uid}>{a.nombre}</option>)}
      </select>
    );
  }
  return <input type="text" {...base} />;
}

function VistaPrevia({ form }) {
  const p = form.parametros;
  return (
    <div style={{ maxWidth: 980 }}>
      <p style={E.ayuda}>Así verá el formulario el evaluador (los campos están bloqueados en esta vista).</p>
      <div className="ca-card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>{form.nombre}</p>
        {form.descripcion && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--texto-suave)" }}>{form.descripcion}</p>}
      </div>

      <TituloSeccion t="A · Datos generales" />
      <div className="ca-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {form.seccionA.map((c) => (
          <div key={c.id}>
            <label className="ca-label">{c.etiqueta || "(sin etiqueta)"}{c.obligatorio ? " *" : ""}</label>
            <CampoPrevio c={c} form={form} />
          </div>
        ))}
      </div>

      <TituloSeccion t="B · Notas en terreno" />
      <div className="ca-card">
        {form.seccionB.puntos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {form.seccionB.puntos.map((pt) => (
              <span key={pt.id} className="ca-chip" style={{ fontWeight: 600 }} title={pt.criterio ? `Criterio ${pt.criterio}` : ""}>+ {pt.texto || "(vacío)"}</span>
            ))}
          </div>
        )}
        <textarea className="rp-textarea" rows={3} disabled placeholder="Escribe una nota rápida de lo que observas…" />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn} disabled>+ Agregar nota</button>
          {form.seccionB.horaAutomatica && <span style={{ fontSize: 12.5, color: "var(--texto-suave)" }}>La hora se marca sola en cada nota.</span>}
        </div>
        <div style={E.prevNota}>
          <b>Ejemplo:</b> <span style={{ color: "var(--texto-suave)" }}>09:12 — Empezó 6 min tarde, faltaban 2 de 9 convocados. · 09:31 — Dos KPIs en rojo sin responsable.</span>
        </div>
      </div>

      <TituloSeccion t="C · Rúbrica de evaluación" />
      {form.bloques.map((b) => (
        <div key={b.id} style={{ marginBottom: 14 }}>
          <p style={{ fontWeight: 800, margin: "0 0 8px", textTransform: "uppercase", fontSize: 12.5, letterSpacing: ".04em", color: "var(--verde-oscuro)" }}>
            {b.nombre} <span style={{ fontWeight: 600, textTransform: "none", color: "var(--texto-suave)" }}>· {fmt(b.peso)}% del total</span>
          </p>
          {b.criterios.map((c) => (
            <div key={c.id} className="ca-card" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>
                {c.codigo} · {c.nombre || "(sin nombre)"} {c.refV24 && <span style={{ fontWeight: 400, color: "var(--texto-suave)" }}>({c.refV24})</span>}{" "}
                {c.critico && <span className="ca-pill ca-pill-rojo">★ Crítico</span>}{" "}
                <span style={{ fontWeight: 400, fontSize: 12, color: "var(--texto-suave)" }}>peso {fmt(c.peso)}% del bloque</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, margin: "10px 0" }}>
                {[["2", "Cumple", c.nivel2], ["1", "Parcial", c.nivel1], ["0", "No cumple", c.nivel0]].map(([n, t, d]) => (
                  <div key={n} style={{ border: "1.5px solid var(--borde)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}>
                    <b>{n} · {t}</b>
                    <div style={{ color: "var(--texto-suave)", marginTop: 3 }}>{d || <em>(sin descriptor)</em>}</div>
                  </div>
                ))}
                {c.admiteNA && <div style={{ border: "1.5px dashed var(--borde)", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}><b>N/A</b><div style={{ color: "var(--texto-suave)", marginTop: 3 }}>No aplica</div></div>}
              </div>
              {c.verificar && <div style={{ fontSize: 12.5, color: "var(--texto-suave)", marginBottom: 8 }}><b>Cómo verificar:</b> {c.verificar}</div>}
              <input className="rp-input" disabled placeholder="Justificación o comentario (opcional)" />
            </div>
          ))}
        </div>
      ))}

      <TituloSeccion t="D · Resultado (se calcula solo)" />
      <div className="ca-card">
        <table className="ca-tabla">
          <thead><tr><th>Bloque</th><th>Peso en el total</th></tr></thead>
          <tbody>
            {form.bloques.map((b) => <tr key={b.id}><td>{b.nombre}</td><td>{fmt(b.peso)}%</td></tr>)}
            <tr><td><b>TOTAL</b></td><td><b>{fmt(sumar(form.bloques.map((b) => b.peso)))}%</b></td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: "var(--texto-suave)", marginBottom: 0 }}>
          Efectiva: ≥ {p.umbralEfectiva}% y sin críticos en 0 · En desarrollo: {p.umbralDesarrollo}–{p.umbralEfectiva - 1}% (o ≥ {p.umbralEfectiva}% con un crítico en 0) · Requiere intervención: &lt; {p.umbralDesarrollo}%.
        </p>
      </div>

      <TituloSeccion t="E · Feedback al líder" />
      <div className="ca-card" style={{ fontSize: 13.5, display: "grid", gap: 8 }}>
        <div style={{ background: "var(--verde-claro)", borderRadius: 8, padding: "8px 12px" }}>
          📝 <b>Tus notas de terreno</b> (ejemplo): "09:12 — Empezó 6 min tarde…" · "09:31 — Dos KPIs en rojo sin responsable." <span style={{ color: "var(--texto-suave)" }}>— se muestran antes del feedback para leerlas.</span>
        </div>
        {form.feedback.fortalezas && <div>✔ Fortalezas identificadas (hasta {form.feedback.maxPorTipo}) — criterio · {form.feedback.situacion ? "situación · " : ""}comportamiento · impacto</div>}
        {form.feedback.oportunidades && <div>✔ Oportunidades de mejora (hasta {form.feedback.maxPorTipo}) — criterio · {form.feedback.situacion ? "situación · " : ""}comportamiento · impacto</div>}
        {form.feedback.compromisoMejora && <div>✔ (paso aparte) Compromiso de mejora del líder — acción · responsable · fecha</div>}
        {form.feedback.seguimientoAnterior && <div>✔ (paso aparte) Seguimiento al compromiso de la CdR anterior — cumplido / parcial / no cumplido / primera CdR</div>}
      </div>
    </div>
  );
}

function TituloSeccion({ t }) {
  return <p style={{ fontWeight: 800, fontSize: 15, margin: "18px 0 8px" }}>{t}</p>;
}

/* ------------------------------ Estilos ---------------------------- */

const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnPrim = { ...btn, background: "var(--verde)", borderColor: "var(--verde)", color: "#fff" };
const btnPel = { ...btn, color: "var(--rojo)", borderColor: "#e8b7a8" };
const btnIco = { ...btn, padding: "4px 8px", minWidth: 30 };

const E = {
  barra: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 },
  tabs: { display: "flex", gap: 2, flexWrap: "wrap", borderBottom: "1px solid var(--borde)", marginBottom: 16 },
  tab: { background: "none", border: "none", borderBottomWidth: 2, borderBottomStyle: "solid", borderBottomColor: "transparent", padding: "9px 12px", fontSize: 14, fontWeight: 600, color: "var(--texto-suave)", cursor: "pointer" },
  tabAct: { color: "var(--verde-oscuro)", borderBottomColor: "var(--verde)" },
  ayuda: { fontSize: 13.5, color: "var(--texto-suave)", margin: "0 0 12px" },
  fila: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, padding: "8px 10px", marginBottom: 8 },
  check: { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, cursor: "pointer" },
  criterio: { border: "1px solid var(--borde)", borderRadius: 10, padding: 12, marginBottom: 10, background: "#fcfcfb" },
  mini: { fontSize: 11.5, fontWeight: 700, color: "var(--texto-suave)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 3 },
  prevNota: { fontSize: 13, color: "var(--texto)", background: "var(--fondo)", borderRadius: 8, padding: "8px 12px", marginTop: 10 },
};
