import logoOems from "./assets/logo-oems.png";
import logoLomasBayas from "./assets/logo-lomasbayas.png";

export default function Cabecera({ usuario, vista, onCambiarVista, onSalir, compromisosAbiertos = 0 }) {
  const esMaster = usuario.rol === "master";
  const Link = ({ id, children }) => (
    <button className={`ca-nav-link ${vista === id ? "activo" : ""}`} onClick={() => onCambiarVista(id)}>
      {children}
    </button>
  );
  return (
    <div className="ca-cabecera">
      <div className="ca-cabecera-top">
        <img src={logoOems} alt="OEMS" style={{ height: 34 }} />
        <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 34 }} />
      </div>
      <p className="ca-eyebrow">Formularios · v0.8.1 · Henny</p>
      <p className="ca-titulo">Formularios</p>

      <div className="ca-nav">
        <Link id="inicio">Inicio</Link>
        <Link id="mis">Mis Formularios</Link>
        <Link id="resultados">Evaluaciones recibidas</Link>
        <Link id="compromisos">
          Compromisos de mejora
          {compromisosAbiertos > 0 && <span style={{ marginLeft: 6, background: "#ba7517", color: "#fff", borderRadius: 100, padding: "1px 7px", fontSize: 11.5, fontWeight: 700 }}>{compromisosAbiertos}</span>}
        </Link>
        {esMaster && <Link id="formularios">Formularios</Link>}
        {esMaster && <Link id="estadisticas">Estadísticas</Link>}
        {esMaster && <Link id="admin">Administración</Link>}
        <div className="ca-nav-espaciador" />
        <span style={{ fontSize: 14, color: "var(--texto-suave)" }}>{usuario.nombreUsuario}</span>
        {esMaster && <span className="ca-badge-rol">Master</span>}
        <button className="ca-btn-salir" onClick={onSalir}>
          Salir
        </button>
      </div>
    </div>
  );
}
