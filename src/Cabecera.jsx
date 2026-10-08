import logoOems from "./assets/logo-oems.png";
import logoLomasBayas from "./assets/logo-lomasbayas.png";

export default function Cabecera({ usuario, vista, onCambiarVista, onSalir }) {
  return (
    <div className="ca-cabecera">
      <div className="ca-cabecera-top">
        <img src={logoOems} alt="OEMS" style={{ height: 34 }} />
        <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 34 }} />
      </div>
      <p className="ca-eyebrow">Formularios · v1.0.0 · Henny</p>
      <p className="ca-titulo">Formularios</p>

      <div className="ca-nav">
        <button
          className={`ca-nav-link ${vista === "lista" ? "activo" : ""}`}
          onClick={() => onCambiarVista("lista")}
        >
          Mis formularios
        </button>
        {(usuario?.rol === "admin" || usuario?.rol === "master") && (
          <button
            className={`ca-nav-link ${vista === "admin" ? "activo" : ""}`}
            onClick={() => onCambiarVista("admin")}
          >
            Administración
          </button>
        )}
      </div>

      <div className="ca-cabecera-usuario">
        <span>{usuario?.nombreUsuario}</span>
        <button className="ca-btn-texto" onClick={onSalir} style={{ fontSize: 13 }}>
          Salir
        </button>
      </div>
    </div>
  );
}
