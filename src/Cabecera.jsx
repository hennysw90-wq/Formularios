import logoOems from "./assets/logo-oems.png";
import logoLomasBayas from "./assets/logo-lomasbayas.png";

export default function Cabecera({ usuario, vista, onCambiarVista, onSalir }) {
  return (
    <div className="ca-cabecera">
      <div className="ca-cabecera-top">
        <img src={logoOems} alt="OEMS" style={{ height: 34 }} />
        <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 34 }} />
      </div>
      <p className="ca-eyebrow">Formularios · V1.3.0 · Henny</p>
      <p className="ca-titulo">Formularios</p>

      <div className="ca-nav">
        <button
          className={`ca-nav-link ${vista === "lista" ? "activo" : ""}`}
          onClick={() => onCambiarVista("lista")}
        >
          Mis formularios
        </button>
        {(usuario.rol === "admin" || usuario.rol === "master") && (
          <button
            className={`ca-nav-link ${vista === "admin" ? "activo" : ""}`}
            onClick={() => onCambiarVista("admin")}
          >
            Administración
          </button>
        )}
        <div className="ca-nav-espaciador" />
        <span style={{ fontSize: 14, color: "var(--texto-suave)" }}>{usuario.nombreUsuario}</span>
        {usuario.rol === "master" && <span className="ca-badge-rol">Master</span>}
        {usuario.rol === "admin" && <span className="ca-badge-rol">Administrador</span>}
        <button className="ca-btn-salir" onClick={onSalir}>
          Salir
        </button>
      </div>
    </div>
  );
}
