import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { recuperarSesion, cerrarSesion } from "./auth.js";
import { db, asegurarSesionCdR } from "./firebase.js";
import Login from "./Login.jsx";
import Cabecera from "./Cabecera.jsx";
import Administracion from "./Administracion.jsx";
import Formularios from "./Formularios.jsx";
import MisCdR, { Ejecutar } from "./MisCdR.jsx";
import CompromisosMejora, { TarjetaCompromiso, EvaluacionesRecibidas } from "./CompromisosMejora.jsx";
import { listarCierres, compromisosRecibidos, compromisosEntregados, todosLosCompromisos, evaluacionesRecibidas, estaCerrado } from "./compromisosLider.js";
import { listarEvaluacionesEnviadas } from "./evaluaciones.js";
import ResultadosQR, { VISTA_RESULTADOS_INICIAL } from "./ResultadosQR.jsx";
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

  // CdR que le han realizado a la persona y sus compromisos de mejora (para Inicio y la pestaña Compromisos).
  const [enviadas, setEnviadas] = useState(null);
  const [cierres, setCierres] = useState(new Map());
  const [verRecibida, setVerRecibida] = useState(null);
  const [vistaResultados, setVistaResultados] = useState(VISTA_RESULTADOS_INICIAL);
  const conSesion = !!usuario && !formularioDirecto;
  useEffect(() => {
    if (!conSesion) return undefined;
    const a = listarEvaluacionesEnviadas(setEnviadas, () => setEnviadas([]));
    const b = listarCierres(setCierres, () => {});
    return () => { a(); b(); };
  }, [conSesion]);
  const recibidas = useMemo(() => (usuario ? evaluacionesRecibidas(enviadas || [], usuario) : []), [enviadas, usuario]);
  const misCompromisos = useMemo(() => (usuario ? compromisosRecibidos(enviadas || [], usuario, cierres) : []), [enviadas, cierres, usuario]);
  const misEntregados = useMemo(() => (usuario ? compromisosEntregados(enviadas || [], usuario, cierres) : []), [enviadas, cierres, usuario]);
  const todosCompromisos = useMemo(() => (usuario?.rol === "master" ? todosLosCompromisos(enviadas || [], cierres) : null), [enviadas, cierres, usuario]);

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

  if (verRecibida) {
    return (
      <div className="ca-pagina">
        <div className="ca-contenido cdr-ejecutar">
          <Ejecutar evaluacionInicial={verRecibida} onCerrar={() => setVerRecibida(null)} textoVolver="← Volver" ocultarEvaluador />
        </div>
      </div>
    );
  }
  const abiertos = (todosCompromisos || misCompromisos).filter((c) => !estaCerrado(c)).length;

  return (
    <div className="ca-pagina">
      <Cabecera usuario={usuario} vista={vista} onCambiarVista={setVista} onSalir={salir} compromisosAbiertos={abiertos} />

      <div className={`ca-contenido ${vista === "admin" || vista === "formularios" || vista === "mis" || vista === "estadisticas" ? "ca-ancho" : ""}`}>
        {vista === "inicio" && (
          <Inicio usuario={usuario} esMaster={esMaster} onIr={setVista} compromisos={todosCompromisos || misCompromisos} recibidas={recibidas} cargando={enviadas === null} onVerRecibida={setVerRecibida} />
        )}
        {vista === "compromisos" && <CompromisosMejora recibidos={misCompromisos} entregados={misEntregados} todos={todosCompromisos} usuario={usuario} cargando={enviadas === null} />}
        {vista === "resultados" && (
          <div className="ca-card">
            <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 18 }}>Evaluaciones recibidas</p>
            <p style={{ margin: "0 0 12px", color: "var(--texto-suave)", fontSize: 14 }}>
              Las CdR que te han realizado como líder (igual que al revisarlas desde el QR): elige el periodo, el formulario y la reunión para ver tu hoja resumen.
            </p>
            {enviadas === null ? <p style={{ color: "var(--texto-suave)" }}>Cargando…</p>
              : <ResultadosQR persona={{ uid: usuario.uid, nombreUsuario: usuario.nombreUsuario }} evals={enviadas} vista={vistaResultados} onVista={setVistaResultados} onVer={setVerRecibida} />}
          </div>
        )}

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

function Inicio({ usuario, esMaster, onIr, compromisos = [], recibidas = [], cargando, onVerRecibida }) {
  const abiertos = compromisos.filter((c) => !estaCerrado(c));
  const LIMITE = 5;
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
      <div className="ca-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, flex: 1 }}>{esMaster ? "Compromisos de mejora pendientes de todos los líderes" : "Compromisos de mejora pendientes"} ({cargando ? "…" : abiertos.length})</p>
          <button className="cdr-nav-btn" onClick={() => onIr("compromisos")}>Ver todos</button>
        </div>
        {cargando ? <p style={{ color: "var(--texto-suave)", margin: 0 }}>Cargando…</p>
          : abiertos.length === 0 ? <p style={{ color: "var(--texto-suave)", fontSize: 13.5, margin: 0 }}>No tienes compromisos de mejora pendientes.</p>
          : <>
              {abiertos.slice(0, LIMITE).map((c) => <TarjetaCompromiso key={c.ev.id} c={c} usuario={usuario} mostrarLider={esMaster} />)}
              {abiertos.length > LIMITE && <button className="cdr-nav-btn" onClick={() => onIr("compromisos")}>Ver los {abiertos.length}</button>}
            </>}
      </div>
      <div className="ca-card">
        <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 16 }}>CdR que me han realizado ({cargando ? "…" : recibidas.length})</p>
        {cargando ? <p style={{ color: "var(--texto-suave)", margin: 0 }}>Cargando…</p> : <EvaluacionesRecibidas lista={recibidas} onVer={onVerRecibida} limite={10} />}
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
