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
    const c1 = listarUsuarios((lista) => setUsuarios(lista.filter((u) => u.rol !== "deshabilitado")));
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
      if (e.message === "Ese usuario ya no existe.") {
        // No existe todavía: le ofrecemos crear su perfil en vez de solo
        // decirle que está mal escrito.
        setModo("registro");
        setError("");
      } else {
        setError(e.message || "No se pudo iniciar sesión.");
      }
    } finally {
      setCargando(false);
    }
  }

  async function enviarRegistro(ev) {
    ev.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCargando(true);
    try {
      const resultado = await crearUsuarioPendiente(nombreUsuario, password, correo, area);
      if (resultado?.fusionado && resultado.estado === "activo") {
        // Ya tenía una cuenta activa creada desde otra app: no se creó
        // ninguna cuenta nueva ni se pisó su contraseña, solo se le
        // habilitó el acceso a Asistencia QR. Se le avisa y se lo manda
        // a iniciar sesión con su clave de siempre (no la que acaba de
        // escribir acá, que no se guardó).
        setModo("login");
        setNombreUsuario(resultado.nombreUsuario);
        setPassword("");
        setError("");
        window.alert(
          `"${resultado.nombreUsuario}" ya tenía una cuenta (creada desde otra app) — se le habilitó el acceso a Formularios. Inicia sesión con tu usuario y tu contraseña de siempre (no la que acabas de escribir acá).`
        );
      } else {
        setModo("esperando_validacion");
      }
    } catch (e) {
      setError(e.message || "No se pudo crear tu perfil.");
    } finally {
      setCargando(false);
    }
  }

  async function agregarAreaNueva() {
    const limpio = areaNueva.trim();
    if (!limpio) return;
    setCreandoArea(true);
    setError("");
    try {
      await crearArea(limpio);
      setArea(limpio);
      setAreaNueva("");
    } catch (e) {
      setError(e.message || "No se pudo crear el área.");
    } finally {
      setCreandoArea(false);
    }
  }

  if (modo === "esperando_validacion") {
    return (
      <Envoltorio>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>✅</div>
          <p style={{ fontWeight: 700, marginTop: 8 }}>Perfil creado</p>
          <p style={{ color: "var(--texto-suave)", fontSize: 14 }}>
            Un administrador tiene que validar tu cuenta antes de que puedas entrar. Avísale que ya te
            registraste como <b>{nombreUsuario}</b>.
          </p>
          <button
            type="button"
            className="ca-btn ca-btn-secundario"
            style={{ marginTop: 14 }}
            onClick={() => {
              setModo("login");
              setPassword("");
            }}
          >
            Volver a intentar entrar
          </button>
        </div>
      </Envoltorio>
    );
  }

  if (modo === "registro") {
    return (
      <Envoltorio>
        <form onSubmit={enviarRegistro}>
          <p style={{ textAlign: "center", fontWeight: 800, fontSize: 17, margin: "0 0 4px" }}>
            No encontramos a "{nombreUsuario}"
          </p>
          <p style={{ textAlign: "center", color: "var(--texto-suave)", fontSize: 13, margin: "0 0 16px" }}>
            Crea tu perfil — un administrador lo tiene que validar antes de que puedas entrar.
          </p>

          <label className="ca-label">Nombre completo</label>
          <input
            className="ca-input"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
          />

          <label className="ca-label" style={{ marginTop: 10 }}>
            Elige una contraseña
          </label>
          <input
            className="ca-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
          />

          <label className="ca-label" style={{ marginTop: 10 }}>
            Correo
          </label>
          <input
            className="ca-input"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="nombre.apellido@empresa.cl"
          />

          <label className="ca-label" style={{ marginTop: 10 }}>
            Área
          </label>
          <select className="ca-input" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Sin área…</option>
            {areas.map((a) => (
              <option key={a.id} value={a.nombre}>
                {a.nombre}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input
              className="ca-input"
              placeholder="¿No está tu área? Escríbela aquí…"
              value={areaNueva}
              onChange={(e) => setAreaNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarAreaNueva();
                }
              }}
            />
            <button
              type="button"
              className="ca-btn ca-btn-secundario"
              style={{ width: "auto" }}
              onClick={agregarAreaNueva}
              disabled={creandoArea}
            >
              + Agregar
            </button>
          </div>

          {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 10 }}>{error}</p>}

          <button className="ca-btn" style={{ marginTop: 16 }} disabled={cargando}>
            {cargando ? "Creando…" : "Crear mi perfil"}
          </button>
          <button
            type="button"
            className="ca-btn-texto"
            style={{ marginTop: 6, width: "100%" }}
            onClick={() => {
              setModo("login");
              setError("");
            }}
          >
            ← Volver a intentar entrar
          </button>
        </form>
      </Envoltorio>
    );
  }

  return (
    <Envoltorio>
      <form onSubmit={enviarLogin}>
        <label className="ca-label">Usuario</label>
        <input
          className="ca-input"
          list="lista-usuarios"
          value={nombreUsuario}
          onChange={(e) => setNombreUsuario(e.target.value)}
          placeholder="Tu nombre de usuario"
          autoFocus
        />
        <datalist id="lista-usuarios">
          {usuarios.map((u) => (
            <option key={u.uid} value={u.nombreUsuario} />
          ))}
        </datalist>

        <label className="ca-label" style={{ marginTop: 12 }}>
          Contraseña
        </label>
        <input
          className="ca-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 10 }}>{error}</p>}

        <button className="ca-btn" style={{ marginTop: 16 }} disabled={cargando}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--texto-suave)", marginTop: 12 }}>
          ¿No tienes cuenta? Escribe tu nombre arriba e intenta entrar — te vamos a ofrecer crear tu perfil.
        </p>
      </form>
    </Envoltorio>
  );
}

function Envoltorio({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="ca-card" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <img src={logoLomasBayas} alt="Logo" style={{ height: 42 }} />
        </div>
        <p style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 18px" }}>
          Formularios
        </p>
        {children}
        <p style={{ textAlign: "center", fontSize: 10, color: "#b8c4c2", marginTop: 16 }}>v1.6.0</p>
      </div>
    </div>
  );
}
