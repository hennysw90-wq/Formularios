import { useState, useEffect, useMemo, useRef } from "react";
import logoLomasBayas from "./assets/logo-lomasbayas.png";
import { asegurarUsuarioMaestro, iniciarSesion, listarUsuarios } from "./auth.js";

const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export default function Login({ onIngresar }) {
  const [usuarios, setUsuarios] = useState(null);
  const [errorLista, setErrorLista] = useState(false);
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState(""); // nombre exacto elegido de la lista
  const [abierto, setAbierto] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const claveRef = useRef(null);

  useEffect(() => {
    // Deja listo al usuario maestro del directorio (con acceso a todas las apps).
    asegurarUsuarioMaestro().catch(() => {});
    return listarUsuarios(setUsuarios, () => {
      setErrorLista(true);
      setUsuarios([]);
    });
  }, []);

  // Solo se sugieren personas que realmente pueden entrar a la CdR.
  const nombres = useMemo(
    () =>
      (usuarios || [])
        .filter((u) => u.estado !== "pendiente" && u.rol !== "deshabilitado" && (u.rol === "master" || (Array.isArray(u.apps) && u.apps.includes("cdr"))))
        .map((u) => u.nombreUsuario)
        .filter(Boolean),
    [usuarios]
  );
  // Si la lista no se pudo cargar, se deja escribir el usuario a mano para no bloquear el ingreso.
  const modoLibre = errorLista || (usuarios !== null && nombres.length === 0);
  const q = norm(texto);
  const sugerencias = q.length >= 2 ? nombres.filter((n) => norm(n).includes(q)).slice(0, 8) : [];

  function elegir(nombre) {
    setTexto(nombre);
    setElegido(nombre);
    setAbierto(false);
    setError("");
    setTimeout(() => claveRef.current?.focus(), 0);
  }

  function escribir(t) {
    setTexto(t);
    setAbierto(true);
    setError("");
    if (modoLibre) return setElegido(t.trim());
    const exacto = nombres.find((n) => norm(n) === norm(t));
    setElegido(exacto || "");
  }

  async function enviarLogin(ev) {
    ev.preventDefault();
    if (!elegido) return;
    setError("");
    setCargando(true);
    try {
      const usuario = await iniciarSesion(elegido, password);
      onIngresar(usuario);
    } catch (e) {
      if (e.message === "Ese usuario ya no existe.") {
        setError("No encontramos ese usuario. Si deberías tener acceso a la CdR, pídeselo a Excelencia Operacional.");
      } else {
        setError(e.message || "No se pudo iniciar sesión.");
      }
    } finally {
      setCargando(false);
    }
  }

  let pista;
  if (modoLibre) pista = errorLista ? "No se pudo cargar la lista de usuarios: escribe tu usuario completo." : "Escribe tu usuario completo.";
  else if (elegido) pista = "✓ Usuario seleccionado";
  else if (q.length < 2) pista = "Escribe las primeras letras de tu nombre y elígelo de la lista.";
  else if (sugerencias.length === 0) pista = "No hay ningún usuario con ese nombre. Si deberías tener acceso a la CdR, pídeselo a Excelencia Operacional.";
  else pista = "Elige tu nombre de la lista.";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="ca-card" style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <img src={logoLomasBayas} alt="Lomas Bayas" style={{ height: 42 }} />
        </div>
        <p style={{ textAlign: "center", fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>
          Formularios
        </p>
        <p style={{ textAlign: "center", color: "var(--texto-suave)", fontSize: 13, margin: "0 0 18px" }}>
          Excelencia Operacional · Henny
        </p>
        <form onSubmit={enviarLogin}>
          <label className="ca-label">Usuario</label>
          <div style={{ position: "relative" }}>
            <input
              className="ca-input"
              value={texto}
              onChange={(e) => escribir(e.target.value)}
              onFocus={() => setAbierto(true)}
              onBlur={() => setTimeout(() => setAbierto(false), 180)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (!elegido && sugerencias.length === 1) {
                  e.preventDefault();
                  elegir(sugerencias[0]);
                } else if (!elegido) e.preventDefault();
              }}
              placeholder="Escribe tu nombre y elígelo"
              autoComplete="off"
              autoCapitalize="words"
              autoFocus
            />
            {abierto && !elegido && !modoLibre && sugerencias.length > 0 && (
              <div style={{ position: "absolute", zIndex: 30, left: 0, right: 0, top: "100%", marginTop: 2, background: "#fff", border: "1px solid var(--borde)", borderRadius: 10, maxHeight: 280, overflowY: "auto", boxShadow: "0 8px 22px rgba(0,0,0,.12)" }}>
                {sugerencias.map((n) => (
                  <button key={n} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(n)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--fondo)", padding: "13px 14px", fontSize: 15, cursor: "pointer" }}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: elegido ? "var(--verde-oscuro)" : q.length >= 2 && !modoLibre && sugerencias.length === 0 ? "var(--rojo)" : "var(--texto-suave)" }}>{pista}</div>

          <label className="ca-label" style={{ marginTop: 12 }}>
            Contraseña
          </label>
          <input
            ref={claveRef}
            className="ca-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {error && <p style={{ color: "var(--rojo)", fontSize: 13, marginTop: 10 }}>{error}</p>}
          <button className="ca-btn" style={{ marginTop: 16 }} disabled={cargando || !elegido || !password}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--texto-suave)", marginTop: 12 }}>
            Usas el mismo usuario y contraseña de las otras apps. El acceso a Formularios lo asigna un administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
