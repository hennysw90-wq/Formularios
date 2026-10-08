import { useState, useEffect } from "react";
import {
  listarUsuarios,
  crearUsuario,
  cambiarRolUsuario,
  cambiarAreaUsuario,
  cambiarCorreoUsuario,
  cambiarNombreUsuario,
  cambiarAppsUsuario,
  restablecerPassword,
  eliminarUsuario,
  validarUsuarioPendiente,
  listarAreas,
  crearArea,
  editarArea,
  eliminarArea,
  APPS_DISPONIBLES,
} from "./auth.js";

export default function Administracion() {
  const [tab, setTab] = useState("usuarios"); // usuarios | areas
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          className={tab === "usuarios" ? "ca-btn" : "ca-btn ca-btn-secundario"}
          style={{ width: "auto" }}
          onClick={() => setTab("usuarios")}
        >
          Usuarios
        </button>
        <button
          className={tab === "areas" ? "ca-btn" : "ca-btn ca-btn-secundario"}
          style={{ width: "auto" }}
          onClick={() => setTab("areas")}
        >
          Áreas
        </button>
      </div>
      {tab === "usuarios" ? <PanelUsuarios /> : <PanelAreas />}
    </div>
  );
}

function PanelUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState("usuario");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [creando, setCreando] = useState(false);
  const [clavesVisibles, setClavesVisibles] = useState({});

  useEffect(() => {
    const c1 = listarUsuarios(setUsuarios, (e) => setErrorCarga(e.message || "No se pudo leer la lista de usuarios."));
    const c2 = listarAreas(setAreas);
    return () => {
      c1();
      c2();
    };
  }, []);

  const pendientes = usuarios.filter((u) => u.estado === "pendiente");
  const activos = usuarios.filter((u) => u.estado !== "pendiente");

  async function crear(ev) {
    ev.preventDefault();
    setError("");
    if (!nombreUsuario.trim() || password.length < 6) {
      setError("Nombre de usuario y contraseña de al menos 6 caracteres.");
      return;
    }
    setCreando(true);
    try {
      await crearUsuario(nombreUsuario, password, rol, rol === "admin" ? "" : area);
      setNombreUsuario("");
      setPassword("");
      setArea("");
    } catch (e) {
      setError(e.message || "No se pudo crear.");
    } finally {
      setCreando(false);
    }
  }

  async function resetear(u) {
    const nueva = window.prompt(`Nueva contraseña para ${u.nombreUsuario} (mínimo 6 caracteres):`);
    if (!nueva) return;
    try {
      await restablecerPassword(u.uid, nueva);
    } catch (e) {
      alert(e.message);
    }
  }

  async function renombrarUsuario(u) {
    const nuevoNombre = window.prompt("Nuevo nombre de usuario:", u.nombreUsuario);
    if (!nuevoNombre || nuevoNombre.trim() === u.nombreUsuario) return;
    try {
      await cambiarNombreUsuario(u.uid, nuevoNombre);
    } catch (e) {
      alert(e.message);
    }
  }

  async function borrar(u) {
    if (!window.confirm(`¿Eliminar el usuario "${u.nombreUsuario}"?`)) return;
    await eliminarUsuario(u.uid);
  }

  function alternarClave(uid) {
    setClavesVisibles((prev) => ({ ...prev, [uid]: !prev[uid] }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {errorCarga && (
        <div className="ca-card" style={{ borderColor: "var(--rojo)", background: "#fbe6e5" }}>
          <p style={{ color: "var(--rojo)", fontWeight: 700, margin: 0 }}>No se pudo cargar la lista de usuarios</p>
          <p style={{ color: "var(--rojo)", fontSize: 13, margin: "4px 0 0" }}>{errorCarga}</p>
        </div>
      )}

      {pendientes.length > 0 && (
        <div>
          <p style={{ fontWeight: 700, margin: "0 0 8px", color: "#9a6a00" }}>
            ⏳ Por validar ({pendientes.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendientes.map((u) => (
              <FilaPendiente
                key={u.uid}
                usuario={u}
                areas={areas}
                claveVisible={!!clavesVisibles[u.uid]}
                onAlternarClave={() => alternarClave(u.uid)}
                onRechazar={() => borrar(u)}
              />
            ))}
          </div>
        </div>
      )}

      <form className="ca-card" onSubmit={crear} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <p style={{ fontWeight: 700, margin: 0, width: "100%" }}>Crear usuario</p>
        <div style={{ flex: "1 1 160px" }}>
          <label className="ca-label">Nombre de usuario</label>
          <input className="ca-input" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="ca-label">Contraseña</label>
          <input
            className="ca-input"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
          />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <label className="ca-label">Rol</label>
          <select className="ca-input" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="usuario">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        {rol !== "admin" && (
          <div style={{ flex: "1 1 140px" }}>
            <label className="ca-label">Área</label>
            <select className="ca-input" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Sin área…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.nombre}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="ca-btn" style={{ width: "auto" }} disabled={creando}>
          {creando ? "Creando…" : "+ Crear usuario"}
        </button>
        {error && <p style={{ color: "var(--rojo)", fontSize: 13, width: "100%", margin: 0 }}>{error}</p>}
      </form>

      <div>
        <table className="ca-tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Clave</th>
              <th>Rol</th>
              <th>Área</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activos.map((u) => (
              <tr key={u.uid}>
                <td>
                  {u.nombreUsuario}
                  <button
                    className="ca-btn-texto"
                    style={{ padding: "0 0 0 6px", fontSize: 12 }}
                    onClick={() => renombrarUsuario(u)}
                  >
                    ✏️ Renombrar
                  </button>
                </td>
                <td>
                  <input
                    className="ca-input"
                    style={{ padding: "5px 8px", fontSize: 13, width: 170 }}
                    value={u.correo || ""}
                    onChange={(e) => cambiarCorreoUsuario(u.uid, e.target.value)}
                  />
                </td>
                <td>
                  <span style={{ fontFamily: "monospace", fontSize: 13 }}>
                    {clavesVisibles[u.uid] ? u.password : "••••••••"}
                  </span>
                  <button className="ca-btn-texto" style={{ padding: "0 0 0 6px" }} onClick={() => alternarClave(u.uid)}>
                    {clavesVisibles[u.uid] ? "Ocultar" : "Ver"}
                  </button>
                </td>
                <td>
                  <select
                    className="ca-input"
                    style={{ padding: "5px 8px", fontSize: 13 }}
                    value={u.rol}
                    onChange={(e) => cambiarRolUsuario(u.uid, e.target.value)}
                  >
                    <option value="usuario">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </td>
                <td>
                  {u.rol === "admin" ? (
                    <span style={{ fontSize: 13, color: "var(--texto-suave)" }}>— (todas)</span>
                  ) : (
                    <select
                      className="ca-input"
                      style={{ padding: "5px 8px", fontSize: 13 }}
                      value={u.area || ""}
                      onChange={(e) => cambiarAreaUsuario(u.uid, e.target.value)}
                    >
                      <option value="">Sin área</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.nombre}>
                          {a.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="ca-btn-texto" onClick={() => resetear(u)}>
                    Restablecer clave
                  </button>
                  <button className="ca-btn-texto" style={{ color: "var(--rojo)" }} onClick={() => borrar(u)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaPendiente({ usuario, areas, claveVisible, onAlternarClave, onRechazar }) {
  const [rol, setRol] = useState(usuario.rol || "usuario");
  const [area, setArea] = useState(usuario.area || "");
  const [correo, setCorreo] = useState(usuario.correo || "");
  const [password, setPassword] = useState("");
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState("");

  const tieneClavePropia = !!usuario.password;

  async function validar() {
    setError("");
    setValidando(true);
    try {
      await validarUsuarioPendiente(usuario.uid, {
        rol,
        area: rol === "admin" ? "" : area,
        correo,
        password: password || undefined,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setValidando(false);
    }
  }

  return (
    <div
      className="ca-card"
      style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 14 }}
    >
      <div style={{ minWidth: 140 }}>
        <div style={{ fontWeight: 700 }}>{usuario.nombreUsuario}</div>
        <div style={{ fontSize: 12, color: "var(--texto-suave)" }}>
          {tieneClavePropia ? (
            <>
              Clave: <span style={{ fontFamily: "monospace" }}>{claveVisible ? usuario.password : "••••••••"}</span>{" "}
              <button className="ca-btn-texto" style={{ padding: 0 }} onClick={onAlternarClave}>
                {claveVisible ? "Ocultar" : "Ver"}
              </button>
            </>
          ) : (
            <span style={{ color: "#9a6a00" }}>Sin clave (vino del QR) — asígnale una →</span>
          )}
        </div>
      </div>

      <input
        className="ca-input"
        style={{ width: 190 }}
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
        placeholder="Correo"
      />

      <input
        className="ca-input"
        style={{ width: 170 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={tieneClavePropia ? "Dejar vacío = mantener la actual" : "Clave nueva (mín. 6)"}
      />

      <select className="ca-input" style={{ width: 150 }} value={rol} onChange={(e) => setRol(e.target.value)}>
        <option value="usuario">Usuario</option>
        <option value="admin">Administrador</option>
      </select>

      {rol !== "admin" && (
        <select className="ca-input" style={{ width: 150 }} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Sin área</option>
          {areas.map((a) => (
            <option key={a.id} value={a.nombre}>
              {a.nombre}
            </option>
          ))}
        </select>
      )}

      <button className="ca-btn" style={{ width: "auto" }} onClick={validar} disabled={validando}>
        {validando ? "Validando…" : "Validar"}
      </button>
      <button className="ca-btn-texto" style={{ color: "var(--rojo)" }} onClick={onRechazar}>
        Rechazar
      </button>
      {error && <p style={{ color: "var(--rojo)", fontSize: 12, width: "100%" }}>{error}</p>}
    </div>
  );
}

function PanelAreas() {
  const [areas, setAreas] = useState([]);
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cancelar = listarAreas(setAreas);
    return () => cancelar();
  }, []);

  async function agregar(ev) {
    ev.preventDefault();
    setError("");
    try {
      await crearArea(nueva);
      setNueva("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function renombrar(a) {
    const nuevoNombre = window.prompt("Nuevo nombre del área:", a.nombre);
    if (!nuevoNombre || nuevoNombre.trim() === a.nombre) return;
    try {
      await editarArea(a.id, nuevoNombre);
    } catch (e) {
      alert(e.message);
    }
  }

  async function borrar(a) {
    if (!window.confirm(`¿Eliminar el área "${a.nombre}"?`)) return;
    await eliminarArea(a.id);
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <form onSubmit={agregar} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          className="ca-input"
          placeholder="Nombre del área nueva"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <button className="ca-btn" style={{ width: "auto" }}>
          + Agregar
        </button>
      </form>
      {error && <p style={{ color: "var(--rojo)", fontSize: 13 }}>{error}</p>}
      <div className="ca-card" style={{ padding: 8 }}>
        {areas.length === 0 && (
          <p style={{ color: "var(--texto-suave)", fontSize: 14, padding: 10 }}>Sin áreas todavía.</p>
        )}
        {areas.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              borderBottom: "1px solid var(--borde)",
            }}
          >
            <span style={{ fontSize: 14 }}>{a.nombre}</span>
            <div>
              <button className="ca-btn-texto" onClick={() => renombrar(a)}>
                Renombrar
              </button>
              <button className="ca-btn-texto" style={{ color: "var(--rojo)" }} onClick={() => borrar(a)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
