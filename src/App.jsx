import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { recuperarSesion, cerrarSesion } from "./auth.js";
import { db, asegurarSesionCdR } from "./firebase.js";
import Login from "./Login.jsx";
import Cabecera from "./Cabecera.jsx";
import Administracion from "./Administracion.jsx";
import Formularios from "./Formularios.jsx";
import MisCdR from "./MisCdR.jsx";
import PaginaQR from "./PaginaQR.jsx";
import Estadisticas from "./Estadisticas.jsx";
import { formularioDesdeUrl, rutinaDesdeUrl } from "./enlaces.js";

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando, null = sin sesión
  const [vista, setVista] = useState("inicio");
  // Si la persona llegó escaneando un QR, el enlace trae el formulario (?formulario=...).
  // Se conserva mientras inicia sesión y se quita de la barra de direcciones al usarlo.
  const [formularioDirecto, setFormularioDirecto] = useState(() => formularioDesdeUrl(window.location.search));
  const [rutinaDirecta, setRutinaDirecta] = useState(() => rutinaDesdeUrl(window.location.search)); // la reunión del QR (una sola)

  useEffect(() => {
    (async () => {
      try {
        setUsuario(await recuperarSesion());
      } catch (e) {
        console.error("No se pudo recuperar la sesión:", e);
        setUsuario(null);
      }
    })();
  }, []);

  function directoAtendido() {
    setFormularioDirecto("");
    setRutinaDirecta("");
    const u = new URL(window.location.href);
    u.searchParams.delete("formulario");
    u.searchParams.delete("rutina");
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  }

  if (usuario === undefined) return null;
  // El QR abre siempre su propia página, igual que en la app Formularios: te identificas por tu nombre
  // (o entras directo si ya hay sesión), ves tus pendientes y tu plan, y los resultados piden tu clave.
  if (formularioDirecto) {
    return <PaginaQR formularioId={formularioDirecto} rutinaId={rutinaDirecta} usuario={usuario} onIrALaApp={usuario ? directoAtendido : null} />;
  }
  if (!usuario) return <Login onIngresar={setUsuario} />;

  const esMaster = usuario.rol === "master";

  function salir() {
    cerrarSesion();
    setUsuario(null);
    setVista("inicio");
  }

  return (
    <div className="ca-pagina">
      <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} />

      <div className={`ca-contenido ${vista === "admin" || vista === "formularios" || vista === "mis" || vista === "estadisticas" ? "ca-ancho" : ""}`}>
        {vista === "inicio" && <Inicio usuario={usuario} esMaster={esMaster} onIr={setVista} />}

        {vista === "mis" && <MisCdR usuario={usuario} formularioDirecto={formularioDirecto} rutinaDirecta={rutinaDirecta} onDirectoAtendido={directoAtendido} />}
        {vista === "formularios" && esMaster && <Formularios usuario={usuario} />}
        {vista === "estadisticas" && esMaster && <Estadisticas usuario={usuario} />}
        {vista === "admin" && esMaster && <Administracion usuarioActual={usuario} />}
      </div>
    </div>
  );
}

function Molde({ titulo, texto }) {
  return (
    <div className="cdr-molde">
      <b>{titulo}</b>
      {texto}
    </div>
  );
}

function Inicio({ usuario, esMaster, onIr }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="ca-card">
        <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>Hola, {usuario.nombreUsuario}</p>
        <p style={{ margin: "6px 0 0", color: "var(--texto-suave)", fontSize: 14 }}>
          {esMaster
            ? "Eres Master: administras quién accede a la CdR, creas los formularios y los asignas en Estadísticas → Plan de evaluadores."
            : "En Mis Formularios ves los formularios que tienes asignados, cuántos te faltan en el periodo, y das feedback a los líderes."}
        </p>
      </div>
      {esMaster && <Diagnostico />}
    </div>
  );
}

// Solo para el Master: confirma que la base propia de la CdR responde, para
// detectar a tiempo si falta habilitar el login anónimo o publicar las reglas.
function Diagnostico() {
  const [estado, setEstado] = useState({ cargando: true });

  useEffect(() => {
    (async () => {
      try {
        await asegurarSesionCdR();
        const snap = await getDocs(collection(db, "cdrFormularios"));
        setEstado({ ok: true, formularios: snap.size });
      } catch (e) {
        console.error("Diagnóstico CdR:", e);
        setEstado({ ok: false, mensaje: e.code || e.message || String(e) });
      }
    })();
  }, []);

  return (
    <div className="ca-card">
      <p style={{ margin: "0 0 8px", fontWeight: 800 }}>Estado de las conexiones</p>
      <div className="cdr-diag">
        <span className="cdr-ok">✓</span> Directorio de usuarios: conectado (iniciaste sesión con él)
      </div>
      {estado.cargando && <div className="cdr-diag">… Probando la base propia de la CdR</div>}
      {estado.ok && (
        <div className="cdr-diag">
          <span className="cdr-ok">✓</span> Base propia de la CdR: conectada ({estado.formularios} formularios)
        </div>
      )}
      {estado.ok === false && (
        <>
          <div className="cdr-diag">
            <span className="cdr-mal">✕</span> Base propia de la CdR: no responde ({estado.mensaje})
          </div>
          <p style={{ fontSize: 13, color: "var(--texto-suave)", margin: "4px 0 0" }}>
            Revisa en la consola de Firebase del proyecto <b>formularios-7f89a</b>: (1) Authentication → método
            "Anónimo" habilitado, y (2) Firestore → Reglas publicadas con las del archivo <b>firestore.rules</b>.
          </p>
        </>
      )}
    </div>
  );
}
