import { useEffect, useMemo, useRef, useState } from "react";
import {
  listarUsuarios,
  cambiarRolUsuario,
  cambiarAreaUsuario,
  cambiarCargoUsuario,
  cambiarCorreoUsuario,
  cambiarNombreUsuario,
  cambiarAppsUsuario,
  restablecerPassword,
  crearUsuario,
  eliminarUsuario,
  validarUsuarioPendiente,
  listarAreas,
  crearArea,
  editarArea,
  eliminarArea,
  correoPorDefecto,
  APPS_DISPONIBLES,
  APP_ACTUAL_ID,
} from "./auth.js";

// Nombre legible de una lista de ids de apps (ej. ["asistencia","rdp"] ->
// "Asistencia QR, RdP Tracker"). Si no hay ninguna app guardada (usuarios
// migrados antes de que existiera este campo), se asume que tienen acceso
// a todas — no se les corta el paso por una migración de datos.
function nombresApps(apps) {
  if (!Array.isArray(apps) || apps.length === 0) return "Todas (heredado)";
  return apps
    .map((id) => APPS_DISPONIBLES.find((a) => a.id === id)?.nombre || id)
    .join(", ");
}

// Selector de apps habilitadas: chips clicables (uno por app), en vez de
// un <select multiple> nativo — ese tipo de selector es poco intuitivo
// (hay que usar Ctrl+clic en desktop y casi no funciona bien al tacto en
// el celular). Acá cada app es un botón que se prende/apaga con un clic o
// un toque, y muestra claramente cuáles están activas. Siempre debe
// quedar al menos una app marcada — no se puede dejar a alguien sin
// acceso a ninguna app desde acá (para eso existe eliminar usuario).
function SelectorApps({ valor, onCambiar, disabled }) {
  function alternar(id) {
    if (disabled) return;
    const yaEstaba = valor.includes(id);
    if (yaEstaba) {
      if (valor.length <= 1) return; // no dejar la lista vacía
      onCambiar(valor.filter((v) => v !== id));
    } else {
      onCambiar([...valor, id]);
    }
  }
  return (
    <div style={estilos.selectorApps}>
      {APPS_DISPONIBLES.map((a) => {
        const activo = valor.includes(a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => alternar(a.id)}
            disabled={disabled}
            title={
              disabled
                ? undefined
                : activo
                ? `Quitar acceso a ${a.nombre}`
                : `Dar acceso a ${a.nombre}`
            }
            style={{
              ...estilos.chipApp,
              ...(activo ? estilos.chipAppActivo : {}),
              ...(disabled ? estilos.chipAppDeshabilitado : {}),
            }}
          >
            {activo && "✓ "}
            {a.nombre}
          </button>
        );
      })}
    </div>
  );
}

// Fila de la lista de "por verificar": el admin/master puede corregir el
// nombre y cargo (por si quien la creó escribió algo mal) y le fija
// contraseña, rol, área y (si es Master) las apps donde queda habilitada.
function FilaValidacion({ u, areas, usuarios, esMaster, onValidar, onRechazar }) {
  const [nombreUsuario, setNombreUsuario] = useState(u.nombreUsuario);
  const [cargo, setCargo] = useState(u.cargo || "");
  const [correo, setCorreo] = useState(u.correo || correoPorDefecto(u.nombreUsuario));
  const [password, setPassword] = useState("RdPTracker");
  const [rol, setRol] = useState("usuario");
  const [area, setArea] = useState(u.area || "");
  const [apps, setApps] = useState(Array.isArray(u.apps) && u.apps.length ? u.apps : [APP_ACTUAL_ID]);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState("");

  const parecidos = useMemo(
    () => nombresParecidos(nombreUsuario, usuarios || [], u.uid),
    [nombreUsuario, usuarios, u.uid]
  );

  async function validar() {
    setError("");
    if ((rol === "usuario" || rol === "deshabilitado") && !area) {
      setError("Selecciona un área antes de validar.");
      return;
    }
    setValidando(true);
    try {
      await onValidar(u.uid, { password, rol, area, nombreUsuario, cargo, correo, apps });
    } catch (e) {
      setError(e.message || "No se pudo validar.");
    } finally {
      setValidando(false);
    }
  }

  return (
    <div style={estilos.filaValidacion}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={estilos.badgePendienteAdmin}>Por verificar</span>
      </div>
      {parecidos.length > 0 && (
        <div style={estilos.avisoParecidos}>
          <p style={estilos.avisoParecidosTexto}>Estas son las sugerencias, ¿quieres corregir por alguna?</p>
          <div style={estilos.avisoParecidosBotones}>
            {parecidos.map((p) => {
              const seleccionada = nombreUsuario.trim() === p.nombreUsuario;
              return (
                <button
                  key={p.uid}
                  type="button"
                  onClick={() => setNombreUsuario(seleccionada ? u.nombreUsuario : p.nombreUsuario)}
                  style={{ ...estilos.chipSugerencia, ...(seleccionada ? estilos.chipSugerenciaActiva : {}) }}
                  title={
                    seleccionada
                      ? `Nombre corregido a "${p.nombreUsuario}" — clic para deshacer`
                      : `Corregir el nombre a "${p.nombreUsuario}"`
                  }
                >
                  {seleccionada && "✓ "}
                  {p.nombreUsuario}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <div>
          <label style={estilos.etiquetaChica}>Nombre</label>
          <input
            className="rp-input"
            placeholder="Nombre"
            value={nombreUsuario}
            onChange={(ev) => setNombreUsuario(ev.target.value)}
            style={{ maxWidth: 170 }}
          />
        </div>
        <div>
          <label style={estilos.etiquetaChica}>Cargo</label>
          <input
            className="rp-input"
            placeholder="Cargo"
            value={cargo}
            onChange={(ev) => setCargo(ev.target.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
        <div>
          <label style={estilos.etiquetaChica}>Correo</label>
          <input
            className="rp-input"
            type="email"
            placeholder="Correo"
            value={correo}
            onChange={(ev) => setCorreo(ev.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="rp-input"
          type="password"
          placeholder="Contraseña (mín. 6 caracteres)"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          style={{ maxWidth: 190 }}
          title="Por defecto: RdPTracker (puedes cambiarla)"
        />
        {esMaster && (
          <select className="rp-select" value={rol} onChange={(ev) => setRol(ev.target.value)} style={{ maxWidth: 140 }}>
            <option value="usuario">Usuario</option>
            <option value="deshabilitado">Deshabilitado</option>
            <option value="admin">Administrador</option>
            <option value="master">Master</option>
          </select>
        )}
        {rol !== "master" && (
          <select className="rp-select" value={area} onChange={(ev) => setArea(ev.target.value)} style={{ maxWidth: 160 }}>
            <option value="">{(rol === "usuario" || rol === "deshabilitado") ? "Selecciona un área…" : "Sin área"}</option>
            {areas.map((a) => (
              <option key={a.id} value={a.nombre}>{a.nombre}</option>
            ))}
          </select>
        )}
        {esMaster && rol !== "master" && (
          <div>
            <label style={estilos.etiquetaChica}>Apps habilitadas</label>
            <SelectorApps valor={apps} onCambiar={setApps} />
          </div>
        )}
        <button className="rp-btn-icon" style={estilos.botonCrear} onClick={validar} disabled={validando}>
          {validando ? "Validando..." : "Validar"}
        </button>
        <button style={estilos.botonSecundarioChico} onClick={() => onRechazar(u.uid)}>Rechazar</button>
      </div>
      {error && <p style={estilos.error}>{error}</p>}
    </div>
  );
}

// Campo de contraseña de la tabla de usuarios: oculta por defecto (como
// cualquier campo de contraseña normal), con un botón de ojo para
// revelarla al tocar/hacer clic — así no queda expuesta en texto plano
// todo el tiempo en la pantalla, pero el admin puede verla cuando la
// necesita, en vez de tener que "resetearla a ciegas" sin saber cuál era.
function CampoPassword({ uid, valorActual, onGuardar }) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input
        className="rp-input"
        type={mostrar ? "text" : "password"}
        defaultValue={valorActual || ""}
        placeholder="Contraseña"
        title={mostrar ? "Contraseña visible — clic en el ojo para ocultarla de nuevo." : "Contraseña oculta — clic en el ojo para verla."}
        onBlur={(ev) => {
          if (ev.target.value !== (valorActual || "")) onGuardar(uid, ev.target.value);
        }}
        style={{ ...estilos.select, paddingRight: 26 }}
      />
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        title={mostrar ? "Ocultar contraseña" : "Ver contraseña"}
        style={estilos.botonOjo}
      >
        {mostrar ? "🙈" : "👁"}
      </button>
    </span>
  );
}

// Quita tildes y pasa a minúsculas, para comparar nombres sin que
// "María" vs "Maria" o "Núñez" vs "Nuñez" cuenten como distintos.
function normalizarComparacion(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Distancia de edición (Levenshtein) simple, para detectar nombres
// parecidos por un typo, sin tener que coincidir exacto.
function distanciaEdicion(a, b) {
  const m = a.length;
  const n = b.length;
  const fila = new Array(n + 1);
  for (let j = 0; j <= n; j++) fila[j] = j;
  for (let i = 1; i <= m; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = fila[j];
      fila[j] = a[i - 1] === b[j - 1] ? anterior : 1 + Math.min(anterior, fila[j], fila[j - 1]);
      anterior = temp;
    }
  }
  return fila[n];
}

// Busca, entre los usuarios ya existentes, nombres que se parecen al que
// se está por crear o validar (typo, mayúsculas/minúsculas, con o sin
// tilde, o incluso el mismo nombre tal cual) — para avisar antes de que
// queden dos cuentas separadas de la misma persona. Se incluyen también
// las coincidencias exactas (solo difieren en may/min o tilde): entre
// dos personas "por verificar" no hay fusión automática, así que es
// justamente el caso que más importa mostrar.
function nombresParecidos(nombre, listaUsuarios, excluirUid) {
  const objetivo = normalizarComparacion(nombre);
  if (objetivo.length < 3) return [];
  return listaUsuarios
    .filter((u) => u.uid !== excluirUid)
    .map((u) => {
      const comparado = normalizarComparacion(u.nombreUsuario);
      return { u, comparado, dist: comparado === objetivo ? 0 : distanciaEdicion(objetivo, comparado) };
    })
    .filter(({ comparado, dist }) => {
      const largo = Math.max(objetivo.length, comparado.length);
      return dist <= Math.max(2, Math.round(largo * 0.22));
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((x) => x.u);
}

export default function Administracion({ usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);

  const esMaster = usuarioActual?.rol === "master";

  const [nombreNuevo, setNombreNuevo] = useState("");
  const [passwordNuevo, setPasswordNuevo] = useState("RdPTracker");
  const [rolNuevo, setRolNuevo] = useState("usuario");
  const [areaNueva, setAreaNueva] = useState("");
  const [cargoNuevo, setCargoNuevo] = useState("");
  const [correoNuevo, setCorreoNuevo] = useState("");
  const [appsNuevo, setAppsNuevo] = useState([APP_ACTUAL_ID]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [nombreArea, setNombreArea] = useState("");
  const [errorArea, setErrorArea] = useState("");
  const [agregandoArea, setAgregandoArea] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);
  const [errorAccion, setErrorAccion] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const cancelar1 = listarUsuarios((lista) => {
      setUsuarios(lista);
      // Personas creadas antes de que existiera el campo "correo" quedan
      // con el correo por defecto asignado directamente — mismo criterio
      // que el tipo de RdP y el nombre del usuario maestro: se corrige
      // una sola vez, sin pedirle nada a nadie. El usuario maestro
      // (Excelencia Operacional) queda afuera a propósito: no tiene un
      // correo "por defecto" razonable, se deja vacío para que se le
      // ponga a mano.
      lista.forEach((u) => {
        const esMaestro = u.nombreUsuario.toLowerCase() === "excelencia operacional";
        if (u.correo === undefined && !esMaestro) {
          cambiarCorreoUsuario(u.uid, correoPorDefecto(u.nombreUsuario)).catch((e) =>
            console.error("No se pudo asignar correo por defecto a", u.uid, e)
          );
        }
      });
    });
    const cancelar2 = listarAreas(setAreas, (e) => {
      console.error("Error al leer áreas:", e);
      setErrorArea(`No se pudo leer la lista de áreas: ${e?.message || e}${e?.code ? ` (${e.code})` : ""}`);
    });
    return () => {
      cancelar1();
      cancelar2();
    };
  }, []);

  // Envuelve cualquier acción de edición rápida (cambiar rol/área/cargo/apps,
  // borrar usuario o área) para que, si Firestore la rechaza, quede un
  // mensaje visible en vez de fallar en silencio como antes.
  async function conManejoDeError(accion, mensajeError) {
    try {
      setErrorAccion("");
      await accion();
    } catch (e) {
      console.error(mensajeError, e);
      const detalle = e?.code ? ` (${e.code})` : "";
      setErrorAccion(`${e?.message || mensajeError}${detalle}`);
    }
  }

  const parecidosNuevo = useMemo(
    () => nombresParecidos(nombreNuevo, usuarios),
    [nombreNuevo, usuarios]
  );

  async function crear(ev) {
    ev.preventDefault();
    setError("");
    setExito("");
    if (!nombreNuevo.trim() || passwordNuevo.length < 6) {
      setError("Escribe un nombre de usuario y una contraseña de al menos 6 caracteres.");
      return;
    }
    if ((rolNuevo === "usuario" || rolNuevo === "deshabilitado") && !areaNueva) {
      setError("Selecciona un área antes de crear el usuario.");
      return;
    }
    setCreando(true);
    try {
      const resultado = await crearUsuario(
        nombreNuevo,
        passwordNuevo,
        rolNuevo,
        areaNueva,
        cargoNuevo,
        correoNuevo,
        esMaster ? appsNuevo : undefined
      );
      if (resultado?.fusionado) {
        setExito(
          `"${resultado.nombreUsuario}" ya existía (creado desde la otra app) — se le habilitó también esta app, sin crear una cuenta nueva. Mantiene su contraseña, rol y área de antes.`
        );
      } else {
        setExito(`Usuario "${nombreNuevo.trim().toLowerCase()}" creado correctamente.`);
      }
      setNombreNuevo("");
      setPasswordNuevo("");
      setRolNuevo("usuario");
      setAreaNueva("");
      setCargoNuevo("");
      setCorreoNuevo("");
      setAppsNuevo([APP_ACTUAL_ID]);
    } catch (e) {
      setError(e.message || "No se pudo crear el usuario. Intenta de nuevo.");
    } finally {
      setCreando(false);
    }
  }

  async function borrarUsuario(uid) {
    await conManejoDeError(
      () => eliminarUsuario(uid),
      "No se pudo eliminar el usuario. Revisa tu conexión e intenta de nuevo."
    );
    setConfirmarBorrado(null);
  }

  async function validarPendiente(uid, datos) {
    await validarUsuarioPendiente(uid, datos); // deja que FilaValidacion muestre el error si falla
  }

  async function rechazarPendiente(uid) {
    await conManejoDeError(
      () => eliminarUsuario(uid),
      "No se pudo rechazar la persona. Revisa tu conexión e intenta de nuevo."
    );
  }

  const usuariosActivos = usuarios.filter((u) => u.estado !== "pendiente");
  const usuariosPendientes = usuarios.filter((u) => u.estado === "pendiente");

  // Búsqueda simple por nombre, área, cargo o correo — no distingue
  // mayúsculas/tildes exactas, busca coincidencia parcial en cualquiera
  // de esos campos.
  const textoBusqueda = busqueda.trim().toLowerCase();
  const usuariosFiltrados = textoBusqueda
    ? usuariosActivos.filter((u) =>
        [u.nombreUsuario, u.area, u.cargo, u.correo]
          .filter(Boolean)
          .some((campo) => campo.toLowerCase().includes(textoBusqueda))
      )
    : usuariosActivos;

  async function agregarArea(ev) {
    ev.preventDefault();
    setErrorArea("");
    if (!nombreArea.trim()) {
      setErrorArea("Escribe el nombre del área antes de agregarla.");
      return;
    }
    setAgregandoArea(true);
    try {
      await crearArea(nombreArea);
      setNombreArea("");
    } catch (e) {
      console.error("Error al crear área:", e);
      const detalle = e?.code ? ` (código: ${e.code})` : "";
      setErrorArea(`${e?.message || "No se pudo crear el área."}${detalle}`);
    } finally {
      setAgregandoArea(false);
    }
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 4px" }}>
      <h2 style={estilos.titulo}>Crear nuevo usuario</h2>
      <p style={estilos.ayudaSeccion}>
        La contraseña queda por defecto en <strong>RdPTracker</strong>; puedes cambiarla antes de crear.
        {!esMaster && " Quedará habilitado solo en esta app y con rol Usuario (solo un Master puede asignar Administrador o Master)."}
      </p>
      <form onSubmit={crear} style={estilos.formulario}>
        <input
          className="rp-input"
          placeholder="Nombre de usuario"
          value={nombreNuevo}
          onChange={(ev) => setNombreNuevo(ev.target.value)}
          style={{ maxWidth: 180 }}
        />
        <input
          className="rp-input"
          type="password"
          placeholder="Contraseña (mín. 6 caracteres)"
          value={passwordNuevo}
          onChange={(ev) => setPasswordNuevo(ev.target.value)}
          style={{ maxWidth: 200 }}
          title="Por defecto: RdPTracker (puedes cambiarla)"
        />
        {esMaster && (
          <select
            className="rp-select"
            value={rolNuevo}
            onChange={(ev) => setRolNuevo(ev.target.value)}
            style={{ maxWidth: 140 }}
          >
            <option value="usuario">Usuario</option>
            <option value="deshabilitado">Deshabilitado</option>
            <option value="admin">Administrador</option>
            <option value="master">Master</option>
          </select>
        )}
        {rolNuevo !== "master" && (
          <div>
            {(rolNuevo === "usuario" || rolNuevo === "deshabilitado") && <label style={estilos.etiquetaChica}>Área (obligatoria)</label>}
            <select
              className="rp-select"
              value={areaNueva}
              onChange={(ev) => setAreaNueva(ev.target.value)}
              style={{ maxWidth: 160 }}
            >
              <option value="">{(rolNuevo === "usuario" || rolNuevo === "deshabilitado") ? "Selecciona un área…" : "Sin área"}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.nombre}>{a.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <input
          className="rp-input"
          placeholder="Cargo (ej. Jefe de Turno)"
          value={cargoNuevo}
          onChange={(ev) => setCargoNuevo(ev.target.value)}
          style={{ maxWidth: 180 }}
        />
        <input
          className="rp-input"
          type="email"
          placeholder={nombreNuevo.trim() ? correoPorDefecto(nombreNuevo) || "Correo" : "Correo (nombre.apellido@glencore.cl)"}
          value={correoNuevo}
          onChange={(ev) => setCorreoNuevo(ev.target.value)}
          style={{ maxWidth: 220 }}
          title="Si lo dejas en blanco, se usa nombre.apellido@glencore.cl por defecto."
        />
        {esMaster && rolNuevo !== "master" && (
          <div>
            <label style={estilos.etiquetaChica}>Apps habilitadas</label>
            <SelectorApps valor={appsNuevo} onCambiar={setAppsNuevo} />
          </div>
        )}
        <button className="rp-btn-icon" type="submit" disabled={creando} style={estilos.botonCrear}>
          {creando ? "Creando..." : "Crear usuario"}
        </button>
      </form>
      {error && <p style={estilos.error}>{error}</p>}
      {exito && <p style={estilos.exito}>{exito}</p>}
      {parecidosNuevo.length > 0 && (
        <div style={estilos.avisoParecidos}>
          <p style={estilos.avisoParecidosTexto}>Estas son las sugerencias, ¿quieres corregir por alguna?</p>
          <div style={estilos.avisoParecidosBotones}>
            {parecidosNuevo.map((u) => {
              const seleccionada = nombreNuevo.trim() === u.nombreUsuario;
              return (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => setNombreNuevo(u.nombreUsuario)}
                  style={{ ...estilos.chipSugerencia, ...(seleccionada ? estilos.chipSugerenciaActiva : {}) }}
                  title={
                    seleccionada
                      ? `El nombre ya coincide con "${u.nombreUsuario}"`
                      : `Corregir el nombre a "${u.nombreUsuario}"`
                  }
                >
                  {seleccionada && "✓ "}
                  {u.nombreUsuario}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {usuariosPendientes.length > 0 && (
        <>
          <h2 style={{ ...estilos.titulo, marginTop: 28 }}>
            Por verificar <span style={estilos.contadorPendientes}>{usuariosPendientes.length}</span>
          </h2>
          <p style={estilos.ayudaSeccion}>
            Personas que se registraron o que un usuario agregó escribiendo solo su nombre.
            Asígnales contraseña, rol, área{esMaster ? " y apps" : ""} para activarlas, o recházalas si fue un error.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {usuariosPendientes.map((u) => (
              <FilaValidacion
                key={u.uid}
                u={u}
                areas={areas}
                usuarios={usuarios}
                esMaster={esMaster}
                onValidar={validarPendiente}
                onRechazar={rechazarPendiente}
              />
            ))}
          </div>
        </>
      )}

      <h2 style={{ ...estilos.titulo, marginTop: 28 }}>Usuarios existentes</h2>
      <input
        className="rp-input"
        placeholder="Buscar por nombre, área, cargo o correo…"
        value={busqueda}
        onChange={(ev) => setBusqueda(ev.target.value)}
        style={{ maxWidth: 320, marginBottom: 10 }}
      />
      {textoBusqueda && (
        <p style={estilos.ayudaSeccion}>
          {usuariosFiltrados.length} de {usuariosActivos.length} usuario(s) coinciden con "{busqueda.trim()}".
        </p>
      )}
      {errorAccion && <p style={estilos.error}>{errorAccion}</p>}
      <div style={estilos.tabla}>
        <div style={{ ...estilos.fila, ...estilos.filaEncabezado }}>
          <span style={estilos.colUsuario}>Usuario</span>
          <span style={estilos.colRol}>Rol</span>
          <span style={estilos.colArea}>Área</span>
          <span style={estilos.colCargo}>Cargo</span>
          <span style={estilos.colCorreo}>Correo</span>
          <span style={estilos.colPassword}>Contraseña</span>
          <span style={estilos.colApps}>Apps</span>
          <span style={estilos.colAccion}></span>
        </div>
        {usuariosFiltrados.length === 0 && (
          <div style={estilos.fila}>
            <span style={estilos.colUsuario}>Ningún usuario coincide con la búsqueda.</span>
          </div>
        )}
        {usuariosFiltrados.map((u) => {
          const esMaestro = u.nombreUsuario.toLowerCase() === "excelencia operacional";
          const esRolMaster = u.rol === "master";
          return (
          <div key={u.uid} style={estilos.fila}>
            <span style={estilos.colUsuario}>
              {esMaestro ? (
                <span title='El usuario maestro "Excelencia Operacional" no se puede renombrar.'>
                  {u.nombreUsuario} {u.uid === usuarioActual.uid && <em>(tú)</em>}
                </span>
              ) : (
                <input
                  className="rp-input"
                  defaultValue={u.nombreUsuario}
                  onBlur={(ev) => {
                    const nuevo = ev.target.value.trim();
                    if (nuevo && nuevo.toLowerCase() !== u.nombreUsuario) {
                      conManejoDeError(
                        () => cambiarNombreUsuario(u.uid, nuevo),
                        "No se pudo renombrar el usuario. Revisa tu conexión e intenta de nuevo."
                      );
                    } else if (!nuevo) {
                      ev.target.value = u.nombreUsuario;
                    }
                  }}
                  style={{ ...estilos.select, fontWeight: 500 }}
                />
              )}
              {u.uid === usuarioActual.uid && !esMaestro && <em style={{ marginLeft: 6 }}>(tú)</em>}
              {u.rol === "deshabilitado" && (
                <span style={estilos.badgeDeshabilitado} title="Esta cuenta no puede iniciar sesión en ninguna app.">
                  Deshabilitado
                </span>
              )}
            </span>
            <span style={estilos.colRol}>
              {esRolMaster ? (
                <span style={estilos.textoNoAplica} title="Rol Master: acceso completo a todas las apps.">
                  Master
                </span>
              ) : esMaster || u.rol !== "admin" ? (
                <select
                  className="rp-select"
                  value={u.rol}
                  onChange={(ev) =>
                    conManejoDeError(
                      () => cambiarRolUsuario(u.uid, ev.target.value),
                      "No se pudo cambiar el rol. Revisa tu conexión e intenta de nuevo."
                    )
                  }
                  disabled={u.uid === usuarioActual.uid}
                  style={estilos.select}
                >
                  <option value="usuario">Usuario</option>
                  <option value="deshabilitado">Deshabilitado</option>
                  {esMaster && <option value="admin">Administrador</option>}
                  {esMaster && <option value="master">Master</option>}
                </select>
              ) : (
                <span style={estilos.textoNoAplica} title="Solo un Master puede cambiar roles de Administrador.">
                  Administrador
                </span>
              )}
            </span>
            <span style={estilos.colArea}>
              {esMaestro || esRolMaster ? (
                <span style={estilos.textoNoAplica} title="Los roles Administrador y Master no quedan amarrados a un área: ven todas.">
                  No aplica
                </span>
              ) : (
                <select
                  className="rp-select"
                  value={u.area || ""}
                  onChange={(ev) =>
                    conManejoDeError(
                      () => cambiarAreaUsuario(u.uid, ev.target.value),
                      "No se pudo cambiar el área. Revisa tu conexión e intenta de nuevo."
                    )
                  }
                  style={estilos.select}
                >
                  <option value="">Sin área</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.nombre}>{a.nombre}</option>
                  ))}
                </select>
              )}
            </span>
            <span style={estilos.colCargo}>
              {esMaestro ? (
                <span style={estilos.textoNoAplica} title='El usuario maestro "Excelencia Operacional" no puede tener cargo asignado.'>
                  No aplica
                </span>
              ) : (
                <input
                  className="rp-input"
                  defaultValue={u.cargo || ""}
                  placeholder="Cargo"
                  onBlur={(ev) => {
                    if (ev.target.value !== (u.cargo || "")) {
                      conManejoDeError(
                        () => cambiarCargoUsuario(u.uid, ev.target.value),
                        "No se pudo guardar el cargo. Revisa tu conexión e intenta de nuevo."
                      );
                    }
                  }}
                  style={estilos.select}
                />
              )}
            </span>
            <span style={estilos.colCorreo}>
              <input
                className="rp-input"
                type="email"
                defaultValue={u.correo || ""}
                placeholder={esMaestro ? "Correo (sin default)" : correoPorDefecto(u.nombreUsuario) || "Correo"}
                onBlur={(ev) => {
                  if (ev.target.value !== (u.correo || "")) {
                    conManejoDeError(
                      () => cambiarCorreoUsuario(u.uid, ev.target.value),
                      "No se pudo guardar el correo. Revisa tu conexión e intenta de nuevo."
                    );
                  }
                }}
                style={estilos.select}
              />
            </span>
            <span style={estilos.colPassword}>
              {esMaestro ? (
                <span style={estilos.textoNoAplica}>—</span>
              ) : (
                <CampoPassword
                  uid={u.uid}
                  valorActual={u.password}
                  onGuardar={(uid, valor) =>
                    conManejoDeError(
                      () => restablecerPassword(uid, valor),
                      "No se pudo guardar la contraseña. Revisa tu conexión e intenta de nuevo."
                    )
                  }
                />
              )}
            </span>
            <span style={estilos.colApps}>
              {esRolMaster ? (
                <span style={estilos.textoNoAplica} title="El rol Master siempre tiene acceso a todas las apps.">
                  Todas (Master)
                </span>
              ) : esMaster ? (
                <SelectorApps
                  valor={
                    Array.isArray(u.apps) && u.apps.length
                      ? u.apps
                      : APPS_DISPONIBLES.map((a) => a.id) // heredado = acceso a todas, igual que en el login
                  }
                  onCambiar={(seleccion) =>
                    conManejoDeError(
                      () => cambiarAppsUsuario(u.uid, seleccion),
                      "No se pudo cambiar las apps habilitadas. Revisa tu conexión e intenta de nuevo."
                    )
                  }
                />
              ) : (
                <span style={{ fontSize: 12.5, color: "#5F5E5A" }}>{nombresApps(u.apps)}</span>
              )}
            </span>
            <span style={{ ...estilos.colAccion, gap: 6 }}>
              {esMaster && u.uid !== usuarioActual.uid && (
                confirmarBorrado === u.uid ? (
                  <span style={{ display: "flex", gap: 4 }}>
                    <button style={estilos.botonPeligroChico} onClick={() => borrarUsuario(u.uid)}>Sí</button>
                    <button style={estilos.botonSecundarioChico} onClick={() => setConfirmarBorrado(null)}>No</button>
                  </span>
                ) : (
                  <button className="rp-btn-icon" onClick={() => setConfirmarBorrado(u.uid)} title="Eliminar usuario">✕</button>
                )
              )}
            </span>
          </div>
          );
        })}
      </div>

      <h2 style={{ ...estilos.titulo, marginTop: 28 }}>Áreas</h2>
      <form onSubmit={agregarArea} style={estilos.formulario}>
        <input
          className="rp-input"
          placeholder="Nombre del área (ej. Operaciones Mina)"
          value={nombreArea}
          onChange={(ev) => setNombreArea(ev.target.value)}
          style={{ maxWidth: 240 }}
        />
        <button className="rp-btn-icon" type="submit" disabled={agregandoArea} style={estilos.botonCrear}>
          {agregandoArea ? "Agregando..." : "+ Agregar área"}
        </button>
      </form>
      {errorArea && <p style={estilos.error}>{errorArea}</p>}

      <div style={{ ...estilos.grillaAreas, marginTop: 10 }}>
        {areas.length === 0 && (
          <p style={{ color: "#B4B2A9", fontSize: 14, margin: 0 }}>Todavía no hay áreas creadas.</p>
        )}
        {areas.map((a) => (
          <div key={a.id} style={estilos.cajaArea}>
            <input
              defaultValue={a.nombre}
              onBlur={(ev) => {
                const nuevo = ev.target.value.trim();
                if (nuevo && nuevo !== a.nombre) {
                  conManejoDeError(
                    () => editarArea(a.id, nuevo),
                    "No se pudo renombrar el área. Revisa tu conexión e intenta de nuevo."
                  );
                } else if (!nuevo) {
                  ev.target.value = a.nombre; // no permitir dejarla vacía
                }
              }}
              style={estilos.inputCajaArea}
            />
            <button
              className="rp-btn-icon"
              onClick={() =>
                conManejoDeError(
                  () => eliminarArea(a.id),
                  "No se pudo eliminar el área. Revisa tu conexión e intenta de nuevo."
                )
              }
              title="Eliminar área"
              style={{ flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <p style={estilos.notaArea}>
        Al renombrar un área, los RdPs y usuarios que ya tenían asignado el nombre anterior no se
        actualizan solos (el nombre queda guardado tal cual en cada uno).
      </p>
    </div>
  );
}

const estilos = {
  titulo: {
    fontFamily: "'Archivo', 'Helvetica Neue', Arial, sans-serif",
    fontWeight: 600,
    fontSize: 18,
    margin: "0 0 12px",
    color: "#2C2C2A",
  },
  formulario: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-end",
    marginBottom: 6,
  },
  botonCrear: {
    background: "#009899",
    color: "#FFFFFF",
    borderRadius: 4,
    padding: "9px 16px",
    fontSize: 13.5,
    fontWeight: 500,
  },
  error: {
    fontSize: 12.5,
    color: "#993C1D",
    marginTop: 6,
  },
  exito: {
    fontSize: 12.5,
    color: "#009899",
    marginTop: 6,
  },
  avisoParecidos: {
    background: "#FAEEDA",
    border: "1px solid #F0D9A8",
    borderRadius: 6,
    padding: "8px 10px",
    marginTop: 6,
    maxWidth: 760,
  },
  avisoParecidosTexto: {
    fontSize: 12.5,
    color: "#8A5A00",
    margin: "0 0 6px",
    fontWeight: 500,
  },
  avisoParecidosBotones: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chipSugerencia: {
    fontSize: 12.5,
    fontWeight: 500,
    padding: "5px 10px",
    borderRadius: 20,
    border: "1px solid #BA7517",
    background: "#FFFFFF",
    color: "#8A5A00",
    cursor: "pointer",
  },
  chipSugerenciaActiva: {
    background: "#BA7517",
    borderColor: "#BA7517",
    color: "#FFFFFF",
  },
  grillaAreas: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  cajaArea: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    border: "1px solid #D3D1C7",
    borderRadius: 6,
    padding: "3px 4px 3px 10px",
    background: "#FFFFFF",
    width: 210,
  },
  inputCajaArea: {
    flex: 1,
    minWidth: 0,
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#2C2C2A",
    padding: "4px 2px",
  },
  tabla: {
    border: "1px solid #D3D1C7",
    borderRadius: 8,
    maxWidth: 1240,
    overflowX: "auto",
  },
  fila: {
    display: "flex",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #F1EFE8",
    background: "#FFFFFF",
    gap: 8,
  },
  filaEncabezado: {
    background: "#F1EFE8",
    fontWeight: 600,
    fontSize: 11.5,
    color: "#5F5E5A",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  colUsuario: { flex: "1 1 150px", minWidth: 130, fontSize: 13, color: "#2C2C2A" },
  colRol: { width: 110, flexShrink: 0 },
  colArea: { width: 150, flexShrink: 0 },
  colApps: { width: 150, flexShrink: 0 },
  colCargo: { width: 140, flexShrink: 0 },
  colCorreo: { width: 175, flexShrink: 0 },
  colPassword: { width: 120, flexShrink: 0 },
  colAccion: { width: 60, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, flexShrink: 0 },
  textoNoAplica: {
    fontSize: 12.5,
    color: "#B4B2A9",
    fontStyle: "italic",
  },
  select: {
    width: "100%",
    fontSize: 12.5,
    padding: "6px 8px",
    borderRadius: 4,
    border: "1px solid #D3D1C7",
    background: "#FFFFFF",
  },
  selectorApps: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
  },
  chipApp: {
    fontSize: 11.5,
    fontWeight: 500,
    padding: "4px 9px",
    borderRadius: 20,
    border: "1px solid #D3D1C7",
    background: "#FFFFFF",
    color: "#5F5E5A",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  chipAppActivo: {
    background: "#009899",
    borderColor: "#009899",
    color: "#FFFFFF",
  },
  chipAppDeshabilitado: {
    cursor: "default",
    opacity: 0.75,
  },
  badgeDeshabilitado: {
    marginLeft: 8,
    fontSize: 10,
    fontWeight: 700,
    color: "#993C1D",
    background: "#FBE6E1",
    padding: "2px 8px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  botonOjo: {
    position: "absolute",
    right: 4,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    padding: 2,
    lineHeight: 1,
  },
  botonPeligroChico: {
    background: "#993C1D",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 11.5,
    cursor: "pointer",
  },
  botonSecundarioChico: {
    background: "transparent",
    color: "#5F5E5A",
    border: "1px solid #D3D1C7",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 11.5,
    cursor: "pointer",
  },
  filaValidacion: {
    background: "#FAEEDA",
    border: "1px solid #FAEEDA",
    borderRadius: 8,
    padding: "12px 14px",
    maxWidth: 760,
  },
  badgePendienteAdmin: {
    fontSize: 10,
    fontWeight: 700,
    color: "#BA7517",
    background: "#FAEEDA",
    padding: "2px 8px",
    borderRadius: 20,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  contadorPendientes: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 5px",
    borderRadius: 20,
    background: "#993C1D",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 6,
    verticalAlign: "middle",
  },
  etiquetaChica: {
    fontSize: 10,
    color: "#B4B2A9",
    display: "block",
    marginBottom: 2,
  },
  ayudaSeccion: {
    fontSize: 12.5,
    color: "#5F5E5A",
    maxWidth: 760,
    marginTop: -4,
    marginBottom: 12,
  },
  notaArea: {
    fontSize: 11,
    color: "#B4B2A9",
    maxWidth: 760,
    marginTop: 8,
  },
  botonRestablecer: {
    fontSize: 11.5,
    color: "#009899",
    background: "#FFFFFF",
    border: "1px solid #D3D1C7",
    borderRadius: 4,
    padding: "5px 9px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  popoverPassword: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    zIndex: 20,
    background: "#FFFFFF",
    border: "1px solid #D3D1C7",
    borderRadius: 8,
    padding: "12px 14px",
    boxShadow: "0 8px 20px rgba(40,34,20,0.14)",
    width: 220,
    textAlign: "left",
  },
  tituloFormNuevo: {
    fontSize: 12,
    fontWeight: 600,
    color: "#2C2C2A",
    margin: "0 0 6px",
  },
  errorFormNuevo: {
    fontSize: 11,
    color: "#993C1D",
    margin: "0 0 6px",
  },
  botonCrearNuevo: {
    fontSize: 11.5,
    color: "#FFFFFF",
    background: "#009899",
    border: "1px solid #009899",
    borderRadius: 4,
    padding: "6px 10px",
  },
};
