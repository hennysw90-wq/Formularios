import logoOems from "./assets/logo-oems.png";
import logoLomasBayas from "./assets/logo-lomasbayas.png";

export default function Cabecera({ usuario, vista, onCambiarVista, onSalir }) {
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
      <p className="ca-eyebrow">Diálogo de Desempeño · v0.2.0 · Henny</p>
      <p className="ca-titulo">Confirmación de Rol (CdR)</p>

      <div className="ca-nav">
        <Link id="inicio">Inicio</Link>
        <Link id="mis">Mis CdR</Link>
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
