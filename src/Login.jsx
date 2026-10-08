import { useState, useEffect } from "react";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import {
  asegurarUsuarioMaestro,
  listarUsuarios,
  listarAreas,
  iniciarSesion,
  crearUsuarioPendiente,
  crearArea,
} from "./auth.js";

export default function Login({ onIngresar }) {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [modo, setModo] = useState("login"); // login | registro | esperando_validacion
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [correo, setCorreo] = useState("");
  const [area, setArea] = useState("");
  const [areaNueva, setAreaNueva] = useState("");
  const [creandoArea, setCreandoArea] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    asegurarUsuarioMaestro().catch(() => {});
    const c1 = listarUsuarios(setUsuarios);
    const c2 = listarAreas(setAreas);
    return () => {
      c1();
      c2();
    };
  }, []);

  async function enviarLogin(ev) {
    ev.preventDefault();
    setError("");
    setCargando(true);
    try {
      const usuario = await iniciarSesion(nombreUsuario, password);
      onIngresar(usuario);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function enviarRegistro(ev) {
    ev.preventDefault();
    setError("");
    if (!area) {
      setError("El área es obligatoria.");
      return;
    }
    setCargando(true);
    try {
      await crearUsuarioPendiente(nombreUsuario, password, correo, area);
      setModo("esperando_validacion");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function guardarAreaNueva(ev) {
    ev.preventDefault();
    if (!areaNueva.trim()) return;
    try {
      await crearArea(areaNueva);
      setArea(areaNueva.trim());
      setAreaNueva("");
      setCreandoArea(false);
    } catch (e) {
      setError(e.message);
    }
  }

  // Filtrar usuarios deshabilitados del autocomplete
  const usuariosFiltrados = usuarios.filter((u) => u.rol !== "deshabilitado");

  if (modo === "esperando_validacion") {
    return (
      <div style={estilos.fondo}>
        <div style={estilos.card}>
          <img src={logoLomasBayas} alt="Lomas Bayas" style={estilos.logo} />
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <h2 style={{ margin: "0 0 10px", color: "#1f2a2e" }}>Cuenta en revisión</h2>
            <p style={{ color: "#5b6b6e", margin: "0 0 20px" }}>
              Tu solicitud fue enviada. Un administrador la revisará pronto.
            </p>
            <button className="ca-btn ca-btn-secundario" onClick={() => setModo("login")}>
              Volver al ingreso
            </button>
          </div>
        </div>
        <p style={estilos.footer}>Formularios · v1.0.0 · Henny</p>
      </div>
    );
  }

  return (
    <div style={estilos.fondo}>
      <div style={estilos.card}>
        <img src={logoLomasBayas} alt="Lomas Bayas" style={estilos.logo} />
        <h2 style={estilos.titulo}>Formularios</h2>

        {modo === "login" ? (
          <form onSubmit={enviarLogin}>
            <label className="ca-label">Usuario</label>
            <input
              className="ca-input"
              style={{ marginBottom: 14 }}
              list="lista-usuarios"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
            />
            <datalist id="lista-usuarios">
              {usuariosFiltrados.map((u) => (
                <option key={u.uid} value={u.nombreUsuario} />
              ))}
            </datalist>

            <label className="ca-label">Contraseña</label>
            <input
              className="ca-input"
              style={{ marginBottom: 18 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
            />

            {error && <p style={estilos.error}>{error}</p>}

            <button className="ca-btn" disabled={cargando}>
              {cargando ? "Ingresando…" : "Ingresar"}
            </button>

            <p style={{ textAlign: "center", marginTop: 14 }}>
              <button
                type="button"
                className="ca-btn-texto"
                onClick={() => { setModo("registro"); setError(""); }}
              >
                Crear cuenta nueva
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={enviarRegistro}>
            <label className="ca-label">Nombre completo</label>
            <input
              className="ca-input"
              style={{ marginBottom: 14 }}
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              placeholder="Nombre y apellido"
              autoFocus
            />

            <label className="ca-label">Contraseña (mín. 6 caracteres)</label>
            <input
              className="ca-input"
              style={{ marginBottom: 14 }}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Elige una contraseña"
            />

            <label className="ca-label">Correo (opcional)</label>
            <input
              className="ca-input"
              style={{ marginBottom: 14 }}
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu.correo@empresa.cl"
            />

            <label className="ca-label">Área *</label>
            {!creandoArea ? (
              <div style={{ marginBottom: 14 }}>
                <select
                  className="ca-input"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Selecciona un área…</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.nombre}>{a.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ca-btn-texto"
                  style={{ padding: "4px 0", fontSize: 13 }}
                  onClick={() => setCreandoArea(true)}
                >
                  + Agregar área nueva
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  className="ca-input"
                  value={areaNueva}
                  onChange={(e) => setAreaNueva(e.target.value)}
                  placeholder="Nombre del área"
                />
                <button
                  type="button"
                  className="ca-btn"
                  style={{ width: "auto", padding: "12px 16px" }}
                  onClick={guardarAreaNueva}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="ca-btn ca-btn-secundario"
                  style={{ width: "auto", padding: "12px 16px" }}
                  onClick={() => setCreandoArea(false)}
                >
                  ✕
                </button>
              </div>
            )}

            {error && <p style={estilos.error}>{error}</p>}

            <button className="ca-btn" disabled={cargando}>
              {cargando ? "Enviando…" : "Solicitar acceso"}
            </button>

            <p style={{ textAlign: "center", marginTop: 14 }}>
              <button
                type="button"
                className="ca-btn-texto"
                onClick={() => { setModo("login"); setError(""); }}
              >
                Ya tengo cuenta
              </button>
            </p>
          </form>
        )}
      </div>
      <p style={estilos.footer}>Formularios · v1.0.0 · Henny</p>
    </div>
  );
}

const estilos = {
  fondo: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#f4f8f8",
    padding: "20px",
    gap: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 18,
    padding: "32px 28px",
    maxWidth: 400,
    width: "100%",
    boxShadow: "0 4px 20px rgba(14,125,117,0.10)",
    border: "1px solid #dbe6e5",
  },
  logo: {
    display: "block",
    margin: "0 auto 18px",
    height: 48,
  },
  titulo: {
    textAlign: "center",
    margin: "0 0 24px",
    fontSize: 22,
    fontWeight: 700,
    color: "#1f2a2e",
  },
  error: {
    color: "#d9534f",
    fontSize: 14,
    margin: "0 0 12px",
    background: "#fdf2f2",
    padding: "8px 12px",
    borderRadius: 8,
  },
  footer: {
    color: "#5b6b6e",
    fontSize: 12,
    margin: 0,
  },
};
