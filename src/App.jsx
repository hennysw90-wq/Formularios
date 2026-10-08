import { useState, useEffect } from "react";
import { recuperarSesion, cerrarSesion, listarUsuarios } from "./auth.js";
import { listarFormularios } from "./formularios.js";
import Login from "./Login.jsx";
import Cabecera from "./Cabecera.jsx";
import ConstructorFormulario from "./ConstructorFormulario.jsx";
import DetalleFormulario from "./DetalleFormulario.jsx";
import QRFormulario from "./QRFormulario.jsx";
import Administracion from "./Administracion.jsx";
import RegistroFormulario from "./RegistroFormulario.jsx";
import MiPlan from "./MiPlan.jsx";
import Recibidas from "./Recibidas.jsx";

export default function App() {
  // El link del QR es público: no pasa por login, se muestra directo.
  const formularioQR = new URLSearchParams(window.location.search).get("formulario");
  if (formularioQR) {
    return <RegistroFormulario formularioId={formularioQR} />;
  }

  return <PanelPrincipal />;
}

function PanelPrincipal() {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando
  const [vista, setVista] = useState("lista"); // lista | constructor | detalle | admin
  const [formularios, setFormularios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [formularioActivo, setFormularioActivo] = useState(null);
  const [formularioQR, setFormularioQR] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    (async () => setUsuario(await recuperarSesion()))();
  }, []);

  useEffect(() => {
    if (!usuario) return;
    const c1 = listarFormularios(setFormularios);
    const c2 = listarUsuarios(setUsuarios);
    return () => { c1(); c2(); };
  }, [usuario]);

  function salir() {
    cerrarSesion();
    setUsuario(null);
  }

  // ── Cargando ──
  if (usuario === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p style={{ color: "#5b6b6e" }}>Cargando…</p>
      </div>
    );
  }

  // ── Login ──
  if (!usuario) {
    return <Login onIngresar={setUsuario} />;
  }

  const esMasterOAdmin = usuario.rol === "master" || usuario.rol === "admin";

  // ── Constructor (crear / editar) ──
  if (vista === "constructor") {
    return (
      <>
        <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} />
        <ConstructorFormulario
          formulario={formularioActivo}
          usuarios={usuarios}
          onGuardado={() => { setVista("lista"); setFormularioActivo(null); }}
          onCancelar={() => { setVista(formularioActivo ? "detalle" : "lista"); }}
        />
      </>
    );
  }

  // ── Detalle de un formulario ──
  if (vista === "detalle" && formularioActivo) {
    return (
      <>
        <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} />
        {formularioQR && (
          <QRFormulario formulario={formularioQR} onCerrar={() => setFormularioQR(null)} />
        )}
        <DetalleFormulario
          formulario={formularioActivo}
          usuario={usuario}
          onEditar={() => setVista("constructor")}
          onEliminar={() => { setVista("lista"); setFormularioActivo(null); }}
          onVolver={() => setVista("lista")}
        />
      </>
    );
  }

  // ── Cumplimiento de mi plan ──
  if (vista === "miplan") {
    return (
      <>
        <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} />
        <MiPlan
          usuario={usuario}
          onAbrirFormulario={(f) => { setFormularioActivo(f); setVista("detalle"); }}
        />
      </>
    );
  }

  // ── Feedbacks y confirmaciones recibidas ──
  if (vista === "recibidas") {
    return (
      <>
        <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} />
        <Recibidas usuario={usuario} />
      </>
    );
  }

  // ── Administración ──
  if (vista === "admin" && esMasterOAdmin) {
    return (
      <>
        <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} />
        <div style={{ marginTop: 20, padding: "0 28px 40px" }}>
          <Administracion usuarioActual={usuario} />
        </div>
      </>
    );
  }

  // ── Lista de formularios ──
  const formulariosFiltrados = formularios.filter((f) =>
    !busqueda || f.titulo.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Un usuario normal solo ve los formularios donde está asignado (o los
  // que no tienen asignaciones, que quedan abiertos para todos).
  const formulariosMostrados =
    usuario.rol === "usuario"
      ? formulariosFiltrados.filter((f) => {
          const asigs = f.asignaciones || [];
          return (
            asigs.length === 0 ||
            asigs.some((a) => (a.personas || []).some((p) => p.uid === usuario.uid))
          );
        })
      : formulariosFiltrados;

  return (
    <>
      <Cabecera usuario={usuario} vista="lista" onCambiarVista={setVista} onSalir={salir} />
      <div className="ca-contenido">

        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            className="ca-input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar formulario…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {esMasterOAdmin && (
            <button
              className="ca-btn"
              style={{ width: "auto", padding: "12px 20px" }}
              onClick={() => { setFormularioActivo(null); setVista("constructor"); }}
            >
              + Nuevo formulario
            </button>
          )}
        </div>

        {formulariosMostrados.length === 0 ? (
          <div className="ca-card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ color: "#5b6b6e", margin: 0 }}>
              {busqueda ? "Sin resultados para la búsqueda." : "No hay formularios disponibles."}
            </p>
          </div>
        ) : (
          formulariosMostrados.map((f) => (
            <TarjetaFormulario
              key={f.id}
              formulario={f}
              esMasterOAdmin={esMasterOAdmin}
              onAbrir={() => { setFormularioActivo(f); setVista("detalle"); }}
              onQR={() => { setFormularioActivo(f); setFormularioQR(f); setVista("detalle"); }}
            />
          ))
        )}
      </div>

      {formularioQR && (
        <QRFormulario formulario={formularioQR} onCerrar={() => setFormularioQR(null)} />
      )}
    </>
  );
}

function TarjetaFormulario({ formulario, esMasterOAdmin, onAbrir, onQR }) {
  const asignaciones = formulario.asignaciones || [];
  const reuniones = [...new Set(asignaciones.map((a) => a.reunionNombre).filter(Boolean))];
  const personas = new Set();
  asignaciones.forEach((a) => (a.personas || []).forEach((p) => personas.add(p.uid)));

  return (
    <div className="ca-card" style={{ marginBottom: 12, cursor: "pointer" }} onClick={onAbrir}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 16, color: "#1f2a2e" }}>
            {formulario.titulo}
          </p>
          {formulario.descripcion && (
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#5b6b6e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {formulario.descripcion}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="ca-chip" style={{ background: "#f0f0f0", color: "#5b6b6e" }}>
              {(formulario.preguntas || []).length} pregunta{(formulario.preguntas || []).length !== 1 ? "s" : ""}
            </span>
            {reuniones.slice(0, 2).map((n) => (
              <span key={n} className="ca-chip">{n}</span>
            ))}
            {reuniones.length > 2 && (
              <span className="ca-chip">+{reuniones.length - 2} reuniones</span>
            )}
            {personas.size > 0 && (
              <span className="ca-chip" style={{ background: "#f0f0f0", color: "#5b6b6e" }}>
                {personas.size} persona{personas.size !== 1 ? "s" : ""}
              </span>
            )}
            {asignaciones.length === 0 && (
              <span className="ca-chip" style={{ background: "#f0f0f0", color: "#5b6b6e" }}>Abierto</span>
            )}
          </div>
        </div>
        <button
          className="ca-btn"
          style={{ width: "auto", padding: "8px 14px", flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onQR(); }}
        >
          QR
        </button>
      </div>
    </div>
  );
}
