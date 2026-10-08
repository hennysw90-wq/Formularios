import { useState, useEffect } from "react";
import {
  TIPOS_PREGUNTA,
  FRECUENCIAS,
  necesitaOpciones,
  etiquetaCadencia,
  configDestinatario,
  crearFormulario,
  actualizarFormulario,
} from "./formularios.js";
import { listarReunionesAsistencia } from "./reuniones.js";

let contador = 1;
function nuevoId(pre) {
  return `${pre}${Date.now().toString(36)}${contador++}`;
}

export default function ConstructorFormulario({ formulario, usuarios, onGuardado, onCancelar }) {
  const editando = !!formulario;

  const [titulo, setTitulo] = useState(formulario?.titulo || "");
  const [descripcion, setDescripcion] = useState(formulario?.descripcion || "");
  const [preguntas, setPreguntas] = useState(
    formulario?.preguntas?.length
      ? formulario.preguntas
      : [{ id: nuevoId("p"), tipo: "texto", texto: "", obligatoria: true, opciones: [] }]
  );
  const [asignaciones, setAsignaciones] = useState(formulario?.asignaciones || []);
  const [destinatario, setDestinatario] = useState(
    formulario ? configDestinatario(formulario) : { activo: true, etiqueta: "Destinatario", obligatorio: true }
  );
  const [reuniones, setReuniones] = useState([]);
  const [errorReuniones, setErrorReuniones] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cancelar = listarReunionesAsistencia(setReuniones, () =>
      setErrorReuniones("No se pudo leer el listado de reuniones de Asistencia.")
    );
    return () => cancelar();
  }, []);

  // ─── Preguntas ────────────────────────────────────────────────────────────

  function agregarPregunta() {
    setPreguntas((p) => [
      ...p,
      { id: nuevoId("p"), tipo: "texto", texto: "", obligatoria: false, opciones: [] },
    ]);
  }
  function eliminarPregunta(id) {
    setPreguntas((p) => p.filter((x) => x.id !== id));
  }
  function cambiarPregunta(id, campo, valor) {
    setPreguntas((p) => p.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }
  function moverPregunta(id, dir) {
    setPreguntas((p) => {
      const i = p.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const copia = [...p];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }
  function agregarOpcion(pid) {
    setPreguntas((p) =>
      p.map((x) => (x.id === pid ? { ...x, opciones: [...(x.opciones || []), ""] } : x))
    );
  }
  function cambiarOpcion(pid, idx, valor) {
    setPreguntas((p) =>
      p.map((x) => {
        if (x.id !== pid) return x;
        const ops = [...(x.opciones || [])];
        ops[idx] = valor;
        return { ...x, opciones: ops };
      })
    );
  }
  function quitarOpcion(pid, idx) {
    setPreguntas((p) =>
      p.map((x) => {
        if (x.id !== pid) return x;
        const ops = [...(x.opciones || [])];
        ops.splice(idx, 1);
        return { ...x, opciones: ops };
      })
    );
  }

  // ─── Asignaciones ─────────────────────────────────────────────────────────

  function agregarAsignacion() {
    setAsignaciones((a) => [
      ...a,
      { id: nuevoId("a"), reunionId: "", reunionNombre: "", personas: [], cantidad: 1, frecuencia: "semanal" },
    ]);
  }
  function quitarAsignacion(id) {
    setAsignaciones((a) => a.filter((x) => x.id !== id));
  }
  function cambiarAsignacion(id, campo, valor) {
    setAsignaciones((a) => a.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
  }
  function elegirReunion(id, reunionId) {
    const r = reuniones.find((x) => x.id === reunionId);
    setAsignaciones((a) =>
      a.map((x) =>
        x.id === id ? { ...x, reunionId, reunionNombre: r ? r.nombre : "" } : x
      )
    );
  }
  function togglePersona(asigId, usuario) {
    setAsignaciones((a) =>
      a.map((x) => {
        if (x.id !== asigId) return x;
        const existe = (x.personas || []).some((p) => p.uid === usuario.uid);
        const personas = existe
          ? x.personas.filter((p) => p.uid !== usuario.uid)
          : [...(x.personas || []), { uid: usuario.uid, nombre: usuario.nombreUsuario }];
        return { ...x, personas };
      })
    );
  }

  // ─── Guardar ──────────────────────────────────────────────────────────────

  async function guardar(ev) {
    ev.preventDefault();
    if (!titulo.trim()) return setError("Ponle un título al formulario.");
    if (destinatario.activo && !destinatario.etiqueta.trim()) {
      return setError("Ponle un nombre al campo de destinatario (ej: Líder de la Sesión).");
    }
    if (preguntas.length === 0) return setError("Agrega al menos una pregunta.");
    for (const p of preguntas) {
      if (!p.texto.trim()) return setError("Todas las preguntas deben tener texto.");
      if (necesitaOpciones(p.tipo) && (p.opciones || []).filter((o) => o.trim()).length < 2) {
        return setError(`"${p.texto}" necesita al menos 2 alternativas.`);
      }
    }
    for (const a of asignaciones) {
      if (!a.reunionId) return setError("Cada asignación tiene que apuntar a una reunión.");
      if ((a.personas || []).length === 0) {
        return setError(`La asignación de "${a.reunionNombre}" no tiene personas.`);
      }
      if (!Number(a.cantidad) || Number(a.cantidad) < 1) {
        return setError(`Pon una cantidad válida en "${a.reunionNombre}".`);
      }
    }
    setError("");
    setGuardando(true);
    try {
      const datos = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        preguntas: preguntas.map((p) => ({
          ...p,
          texto: p.texto.trim(),
          opciones: necesitaOpciones(p.tipo) ? (p.opciones || []).filter((o) => o.trim()) : [],
        })),
        asignaciones: asignaciones.map((a) => ({ ...a, cantidad: Number(a.cantidad) || 1 })),
        destinatario: {
          activo: !!destinatario.activo,
          etiqueta: destinatario.etiqueta.trim() || "Destinatario",
          obligatorio: !!destinatario.obligatorio,
        },
      };
      if (editando) await actualizarFormulario(formulario.id, datos);
      else await crearFormulario(datos);
      onGuardado();
    } catch (e) {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const usuariosActivos = usuarios.filter(
    (u) => u.rol !== "deshabilitado" && u.estado === "activo"
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px 28px 60px" }}>
      <div style={cab}>
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {editando ? "Editar formulario" : "Nuevo formulario"}
        </h2>
        <button type="button" className="ca-btn-texto" onClick={onCancelar}>← Volver</button>
      </div>

      <form onSubmit={guardar}>
        {/* ── General ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={sub}>Información general</h3>
          <label className="ca-label">Título *</label>
          <input
            className="ca-input"
            style={{ marginBottom: 12 }}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Checklist de inspección de equipos"
          />
          <label className="ca-label">Descripción</label>
          <textarea
            className="ca-input"
            rows={2}
            style={{ resize: "vertical" }}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Instrucciones o contexto (opcional)"
          />
        </div>

        {/* ── Destinatario ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={sub}>Destinatario</h3>
          <p style={ayuda}>
            A quién va dirigido el formulario. Al responder, la persona lo elige de
            los usuarios registrados; a sí misma no se puede elegir.
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginBottom: destinatario.activo ? 12 : 0 }}>
            <input
              type="checkbox"
              checked={destinatario.activo}
              onChange={(e) => setDestinatario((d) => ({ ...d, activo: e.target.checked }))}
            />
            Pedir destinatario en este formulario
          </label>

          {destinatario.activo && (
            <>
              <label className="ca-label">Cómo se llama el campo *</label>
              <input
                className="ca-input"
                style={{ marginBottom: 10 }}
                value={destinatario.etiqueta}
                onChange={(e) => setDestinatario((d) => ({ ...d, etiqueta: e.target.value }))}
                placeholder="Ej: Líder de la Sesión, Supervisor de la Actividad…"
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--texto-suave)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={destinatario.obligatorio}
                  onChange={(e) => setDestinatario((d) => ({ ...d, obligatorio: e.target.checked }))}
                />
                Obligatorio
              </label>
            </>
          )}
        </div>

        {/* ── Asignaciones ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={sub}>Asignaciones</h3>
          <p style={ayuda}>
            Cada asignación indica una reunión, quiénes deben responder, cuántas veces
            y cada cuánto. Las reuniones vienen del listado de Asistencia QR.
          </p>
          {errorReuniones && <p style={err}>{errorReuniones}</p>}

          {asignaciones.length === 0 && (
            <p style={{ ...ayuda, fontStyle: "italic" }}>
              Sin asignaciones: el formulario queda abierto para cualquiera que lea el QR.
            </p>
          )}

          {asignaciones.map((a, idx) => (
            <div key={a.id} style={caja}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 13, color: "var(--verde-oscuro)" }}>
                  Asignación {idx + 1}
                </strong>
                <button type="button" onClick={() => quitarAsignacion(a.id)} style={btnQuitar}>
                  Quitar
                </button>
              </div>

              <label className="ca-label">Reunión *</label>
              <select
                className="ca-input"
                style={{ marginBottom: 10 }}
                value={a.reunionId}
                onChange={(e) => elegirReunion(a.id, e.target.value)}
              >
                <option value="">Selecciona una reunión…</option>
                {reuniones.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}{r.area ? ` · ${r.area}` : ""}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 110px" }}>
                  <label className="ca-label">Cantidad *</label>
                  <input
                    className="ca-input"
                    type="number"
                    min="1"
                    value={a.cantidad}
                    onChange={(e) => cambiarAsignacion(a.id, "cantidad", e.target.value)}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 170 }}>
                  <label className="ca-label">Frecuencia *</label>
                  <select
                    className="ca-input"
                    value={a.frecuencia}
                    onChange={(e) => cambiarAsignacion(a.id, "frecuencia", e.target.value)}
                  >
                    {FRECUENCIAS.map((f) => (
                      <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
                    ))}
                  </select>
                </div>
              </div>

              <SelectorPersonas
                usuarios={usuariosActivos}
                seleccionadas={a.personas || []}
                onToggle={(u) => togglePersona(a.id, u)}
              />

              <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: "8px 0 0" }}>
                {(a.personas || []).length} persona{(a.personas || []).length === 1 ? "" : "s"} ·{" "}
                {etiquetaCadencia(a.cantidad, a.frecuencia)}
              </p>
            </div>
          ))}

          <button type="button" className="ca-btn ca-btn-secundario" onClick={agregarAsignacion}>
            + Agregar asignación
          </button>
        </div>

        {/* ── Preguntas ── */}
        <div className="ca-card" style={{ marginBottom: 16 }}>
          <h3 style={sub}>Preguntas</h3>

          {preguntas.map((p, idx) => (
            <div key={p.id} style={caja}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: "var(--verde)", minWidth: 22, paddingTop: 13 }}>
                  {idx + 1}.
                </span>
                <input
                  className="ca-input"
                  value={p.texto}
                  onChange={(e) => cambiarPregunta(p.id, "texto", e.target.value)}
                  placeholder="Texto de la pregunta"
                  style={{ flex: 1 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  className="ca-input"
                  style={{ flex: 1, minWidth: 180 }}
                  value={p.tipo}
                  onChange={(e) => cambiarPregunta(p.id, "tipo", e.target.value)}
                >
                  {TIPOS_PREGUNTA.map((t) => (
                    <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--texto-suave)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!p.obligatoria}
                    onChange={(e) => cambiarPregunta(p.id, "obligatoria", e.target.checked)}
                  />
                  Obligatoria
                </label>
              </div>

              {necesitaOpciones(p.tipo) && (
                <div style={{ marginBottom: 10 }}>
                  {(p.opciones || []).map((op, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <input
                        className="ca-input"
                        value={op}
                        onChange={(e) => cambiarOpcion(p.id, i, e.target.value)}
                        placeholder={`Alternativa ${i + 1}`}
                        style={{ flex: 1 }}
                      />
                      <button type="button" onClick={() => quitarOpcion(p.id, i)} style={btnX}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="ca-btn-texto" style={{ fontSize: 13 }} onClick={() => agregarOpcion(p.id)}>
                    + Agregar alternativa
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => moverPregunta(p.id, -1)} disabled={idx === 0} style={btnIcono}>↑</button>
                <button type="button" onClick={() => moverPregunta(p.id, 1)} disabled={idx === preguntas.length - 1} style={btnIcono}>↓</button>
                <button type="button" onClick={() => eliminarPregunta(p.id)} disabled={preguntas.length === 1} style={{ ...btnIcono, color: "var(--rojo)" }}>Eliminar</button>
              </div>
            </div>
          ))}

          <button type="button" className="ca-btn ca-btn-secundario" onClick={agregarPregunta}>
            + Agregar pregunta
          </button>
        </div>

        {error && <p style={err}>{error}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="ca-btn ca-btn-secundario" onClick={onCancelar} style={{ flex: 1 }}>
            Cancelar
          </button>
          <button className="ca-btn" disabled={guardando} style={{ flex: 2 }}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear formulario"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Las personas seleccionadas se muestran siempre arriba, para no perderlas
// de vista al filtrar. El buscador ignora mayúsculas y tildes, igual que el
// de Administración.
function SelectorPersonas({ usuarios, seleccionadas, onToggle }) {
  const [busqueda, setBusqueda] = useState("");

  const sinTildes = (t) =>
    (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const elegidas = seleccionadas.map((p) => p.uid);
  const texto = sinTildes(busqueda.trim());
  const candidatas = usuarios.filter(
    (u) => !elegidas.includes(u.uid) && (!texto || sinTildes(u.nombreUsuario).includes(texto) || sinTildes(u.area).includes(texto))
  );

  return (
    <>
      <label className="ca-label">Personas *</label>

      {seleccionadas.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {seleccionadas.map((p) => (
            <button
              key={p.uid}
              type="button"
              onClick={() => onToggle({ uid: p.uid, nombreUsuario: p.nombre })}
              style={chip(true)}
              title="Quitar"
            >
              ✓ {p.nombre} ✕
            </button>
          ))}
        </div>
      )}

      <input
        className="ca-input"
        style={{ marginBottom: 8 }}
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar persona por nombre o área…"
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 190, overflowY: "auto" }}>
        {candidatas.map((u) => (
          <button key={u.uid} type="button" onClick={() => onToggle(u)} style={chip(false)}>
            {u.nombreUsuario}
          </button>
        ))}
        {candidatas.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--texto-suave)", margin: 0 }}>
            {texto ? "Nadie coincide con esa búsqueda." : "Ya están todas seleccionadas."}
          </p>
        )}
      </div>
    </>
  );
}

const cab = { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 18px" };
const sub = { margin: "0 0 12px", fontSize: 15, fontWeight: 700 };
const ayuda = { fontSize: 13, color: "var(--texto-suave)", margin: "0 0 12px" };
const caja = { background: "var(--fondo)", borderRadius: 12, padding: "14px 14px 12px", marginBottom: 12, border: "1px solid var(--borde)" };
const btnIcono = { background: "none", border: "1px solid var(--borde)", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 13, color: "var(--texto-suave)" };
const btnX = { background: "none", border: "none", color: "var(--rojo)", cursor: "pointer", fontSize: 17 };
const btnQuitar = { background: "none", border: "none", color: "var(--rojo)", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const err = { color: "var(--rojo)", fontSize: 14, margin: "0 0 12px", background: "#fdf2f2", padding: "8px 12px", borderRadius: 8 };

function chip(sel) {
  return {
    padding: "5px 12px",
    borderRadius: 100,
    border: `2px solid ${sel ? "var(--verde)" : "var(--borde)"}`,
    background: sel ? "var(--verde-claro)" : "#fff",
    color: sel ? "var(--verde-oscuro)" : "var(--texto-suave)",
    fontWeight: sel ? 700 : 400,
    cursor: "pointer",
    fontSize: 13,
  };
}
