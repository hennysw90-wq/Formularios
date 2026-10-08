import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
} from "firebase/firestore";
import { dbDirectorio as db } from "./firebaseDirectorio.js";

const CLAVE_SESION = "rdp_sesion_uid";

const USUARIO_MAESTRO = "Excelencia Operacional";
const CLAVE_MAESTRO = "Excelencia OEMS";

// Identificador de esta app dentro del directorio compartido de usuarios.
// Se usa para: (1) marcar con qué app queda habilitado un usuario nuevo
// creado desde aquí, y (2) revisar en el login si el usuario tiene
// permiso para entrar a este sitio en particular. El rol "master" se
// salta esta revisión: siempre tiene acceso a todo.
export const APP_ACTUAL_ID = "formularios";

export const APPS_DISPONIBLES = [
  { id: "asistencia", nombre: "Asistencia QR" },
  { id: "rdp", nombre: "RdP Tracker" },
  { id: "formularios", nombre: "Formularios" },
];

// Solo recorta espacios sueltos al inicio/final y colapsa espacios
// dobles. A propósito NO cambia mayúsculas ni saca los espacios internos,
// para que un nombre como "Henny Silva" se guarde y se vea así en toda la
// app, en vez de quedar todo pegado como "hennysilva".
function normalizarUsuario(nombreUsuario) {
  return (nombreUsuario || "").trim().replace(/\s+/g, " ");
}

// Deja solo letras (a-z), sacando tildes/ñ, para armar un correo válido a
// partir de un nombre con acentos (ej. "José Muñoz" -> "jose"/"munoz").
function normalizarParaCorreo(txt) {
  return (txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// Correo por defecto para cualquier persona nueva que no sea el usuario
// maestro "Excelencia Operacional": nombre.apellido@glencore.cl, tomando
// la primera y la última palabra del nombre completo. Queda como punto de
// partida editable, no como algo fijo.
export function correoPorDefecto(nombreUsuario) {
  const partes = normalizarUsuario(nombreUsuario).split(" ").filter(Boolean);
  if (partes.length === 0) return "";
  const nombre = normalizarParaCorreo(partes[0]);
  const apellido = partes.length > 1 ? normalizarParaCorreo(partes[partes.length - 1]) : "";
  if (!nombre) return "";
  return apellido ? `${nombre}.${apellido}@glencore.cl` : `${nombre}@glencore.cl`;
}

// Para detectar duplicados o hacer login sin que importen mayúsculas ni
// espacios (así "Henny Silva", "henny silva" y "hennysilva" cuentan como
// la misma persona). Esto NUNCA se guarda, solo se usa para comparar.
function claveUsuario(nombreUsuario) {
  return normalizarUsuario(nombreUsuario).toLowerCase().replace(/\s+/g, "");
}

// Firestore no permite comparar sin distinguir mayúsculas, así que para
// buscar "¿ya existe esta persona?" se trae la lista completa (la
// colección de usuarios de un equipo es chica) y se compara en el propio
// código con `claveUsuario`.
async function buscarUsuarioPorNombre(nombreUsuario) {
  const clave = claveUsuario(nombreUsuario);
  if (!clave) return null;
  const snap = await getDocs(collection(db, "usuarios"));
  const encontrado = snap.docs.find((d) => claveUsuario(d.data().nombreUsuario) === clave);
  return encontrado || null;
}

export async function asegurarUsuarioMaestro() {
  // Si ya existe con el nombre nuevo, se asegura de que tenga rol
  // "master" (por si quedó como "admin" de una versión anterior) y de
  // que tenga acceso a todas las apps del ecosistema. Si existe con el
  // nombre viejo ("Excelencia", de antes de este cambio), se renombra
  // directamente — el mismo criterio que se usó para asignarle tipo a
  // los RdP ya existentes: se corrige una sola vez, sin pedirle nada a
  // nadie.
  const todasLasApps = APPS_DISPONIBLES.map((a) => a.id);
  const conNombreNuevo = await buscarUsuarioPorNombre(USUARIO_MAESTRO);
  if (conNombreNuevo) {
    const datos = conNombreNuevo.data();
    if (datos.rol !== "master" || !Array.isArray(datos.apps) || datos.apps.length < todasLasApps.length) {
      await updateDoc(doc(db, "usuarios", conNombreNuevo.id), { rol: "master", apps: todasLasApps });
    }
    return;
  }
  const conNombreViejo = await buscarUsuarioPorNombre("Excelencia");
  if (conNombreViejo) {
    await updateDoc(doc(db, "usuarios", conNombreViejo.id), {
      nombreUsuario: USUARIO_MAESTRO,
      rol: "master",
      apps: todasLasApps,
    });
    return;
  }
  const ref = doc(collection(db, "usuarios"));
  await setDoc(ref, {
    nombreUsuario: USUARIO_MAESTRO,
    password: CLAVE_MAESTRO,
    rol: "master",
    estado: "activo",
    correo: "",
    apps: todasLasApps,
    creado: new Date().toISOString(),
  });
}

export function listarUsuarios(callback, onError) {
  return onSnapshot(
    collection(db, "usuarios"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (a.nombreUsuario || "").localeCompare(b.nombreUsuario || ""));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo usuarios:", error);
      if (onError) onError(error);
    }
  );
}

// Los roles "admin" y "master" nunca quedan amarrados a un área (ven
// todas) — cualquier valor de área se descarta para esos roles.
function areaSegunRol(rol, area) {
  return rol === "admin" || rol === "master" ? "" : area || "";
}

// Apps donde queda habilitado un usuario nuevo. Si es "master" queda con
// acceso a todas (el campo ni siquiera se revisa en el login para ese
// rol, pero se guarda igual para que se vea reflejado en Administración).
// Si viene una lista explícita (el rol Master la eligió a mano en el
// formulario de Administración), se respeta tal cual; si no, por defecto
// solo queda habilitado en esta misma app.
function appsSegunRol(rol, apps) {
  if (rol === "master") return APPS_DISPONIBLES.map((a) => a.id);
  return Array.isArray(apps) && apps.length ? apps : [APP_ACTUAL_ID];
}

// Agrega esta app a la lista de apps habilitadas de un usuario que ya
// existe en el directorio compartido (si todavía no la tenía). Se usa en
// vez de bloquear cuando alguien "aparece" en esta app pero ya tenía una
// cuenta creada desde la otra: es la misma persona en el ecosistema
// compartido, así que queda habilitada automáticamente acá también, sin
// tocar su contraseña, rol ni área ya existentes.
async function asegurarAppHabilitada(docExistente) {
  const datos = docExistente.data();
  const appsActuales = Array.isArray(datos.apps) && datos.apps.length ? datos.apps : APPS_DISPONIBLES.map((a) => a.id);
  if (!appsActuales.includes(APP_ACTUAL_ID)) {
    await updateDoc(doc(db, "usuarios", docExistente.id), { apps: [...appsActuales, APP_ACTUAL_ID] });
  }
  return datos;
}

export async function crearUsuario(nombreUsuario, password, rol, area = "", cargo = "", correo, apps) {
  const yaExiste = await buscarUsuarioPorNombre(nombreUsuario);
  if (yaExiste) {
    const datosExistentes = await asegurarAppHabilitada(yaExiste);
    return { uid: yaExiste.id, fusionado: true, nombreUsuario: datosExistentes.nombreUsuario };
  }
  const ref = doc(collection(db, "usuarios"));
  const datosNuevos = {
    nombreUsuario: normalizarUsuario(nombreUsuario),
    password,
    rol,
    area: areaSegunRol(rol, area),
    cargo,
    correo: correo !== undefined && correo !== null ? correo.trim() : correoPorDefecto(nombreUsuario),
    estado: "activo",
    apps: appsSegunRol(rol, apps),
    creado: new Date().toISOString(),
  };
  await setDoc(ref, datosNuevos);
  return { uid: ref.id, fusionado: false, nombreUsuario: datosNuevos.nombreUsuario };
}

// Autorregistro: cuando alguien intenta entrar al portal con un usuario que
// no existe, puede crear su propio perfil (nombre, clave que él mismo
// elige, correo y área). Queda en estado "pendiente" — no puede iniciar
// sesión todavía — hasta que un administrador lo valide en Administración,
// donde ya se puede revisar la clave y el correo que escribió.
export async function crearUsuarioPendiente(nombreUsuario, password, correo = "", area = "", cargo = "") {
  const nombreLimpio = normalizarUsuario(nombreUsuario);
  if (!nombreLimpio) throw new Error("Escribe tu nombre.");
  if (!password || password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const yaExiste = await buscarUsuarioPorNombre(nombreUsuario);
  if (yaExiste) {
    // Ya existe (por ejemplo, se creó antes desde RdP Tracker): no se
    // pisa su contraseña ni se crea una cuenta duplicada — se le
    // habilita esta app automáticamente sobre su cuenta existente.
    const datosExistentes = await asegurarAppHabilitada(yaExiste);
    return {
      uid: yaExiste.id,
      fusionado: true,
      estado: datosExistentes.estado,
      nombreUsuario: datosExistentes.nombreUsuario,
    };
  }
  const ref = doc(collection(db, "usuarios"));
  const datos = {
    nombreUsuario: nombreLimpio,
    password,
    rol: "usuario",
    area: area || "",
    cargo: (cargo || "").trim(),
    correo: correo ? correo.trim() : correoPorDefecto(nombreLimpio),
    estado: "pendiente",
    apps: [APP_ACTUAL_ID],
    creado: new Date().toISOString(),
  };
  await setDoc(ref, datos);
  return { uid: ref.id, fusionado: false, estado: "pendiente", ...datos };
}

// El administrador valida una persona pendiente (o corrige un usuario
// activo): puede cambiar cualquier campo. Si no manda una contraseña
// nueva, se conserva la que la persona escribió al autorregistrarse. Si
// el rol queda en "admin", el área se limpia sola.
export async function validarUsuarioPendiente(uid, { password, rol, area, nombreUsuario, cargo, correo, apps } = {}) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) throw new Error("Ese usuario ya no existe.");
  const actual = snap.data();

  const passwordFinal = password || actual.password;
  if (!passwordFinal || passwordFinal.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const rolFinal = rol || actual.rol || "usuario";

  const datos = {
    password: passwordFinal,
    rol: rolFinal,
    area: areaSegunRol(rolFinal, area !== undefined ? area : actual.area),
    estado: "activo",
    correo:
      correo !== undefined && correo !== null && correo !== ""
        ? correo.trim()
        : actual.correo || correoPorDefecto(nombreUsuario || actual.nombreUsuario),
    apps: appsSegunRol(rolFinal, apps !== undefined ? apps : actual.apps),
  };
  if (cargo !== undefined) datos.cargo = cargo.trim();
  if (nombreUsuario !== undefined) {
    const nombreLimpio = normalizarUsuario(nombreUsuario);
    if (!nombreLimpio) throw new Error("El nombre no puede quedar vacío.");
    const existente = await buscarUsuarioPorNombre(nombreUsuario);
    if (existente && existente.id !== uid) {
      // Es la misma persona que ya tiene cuenta (coincide el nombre
      // corregido, a mano o con una sugerencia): en vez de bloquear o
      // crear un duplicado, se fusiona — se le habilita esta app a la
      // cuenta existente y se descarta el registro pendiente, sin tocar
      // su contraseña, rol ni área ya guardados.
      const datosExistentes = await asegurarAppHabilitada(existente);
      await deleteDoc(doc(db, "usuarios", uid));
      return { fusionado: true, nombreUsuario: datosExistentes.nombreUsuario };
    }
    datos.nombreUsuario = nombreLimpio;
  }
  await updateDoc(doc(db, "usuarios", uid), datos);
  return { fusionado: false };
}

// Clave por defecto para quien se registra por primera vez desde el QR
// (ahí nunca se pide clave): las primeras 4 letras del nombre + "26". Ej.
// "Juan Pérez" -> "juan26". El admin la puede ver y cambiar al validarlo.
function claveDefaultDesdeNombre(nombre) {
  const soloLetras = normalizarParaCorreo(nombre);
  const primeras4 = soloLetras.slice(0, 4).padEnd(4, "x");
  return `${primeras4}26`;
}

// Se llama desde el formulario público del QR cuando alguien se registra
// por primera vez a una reunión: además de guardar su ficha de asistencia,
// le crea (o actualiza) un perfil de portal en estado "pendiente", con una
// clave por defecto (las primeras 4 letras de su nombre + "26") ya que el
// QR nunca pide clave — el admin la puede cambiar al validarlo. Si la
// persona ya tiene un usuario de portal (pendiente o activo), solo se le
// refresca correo/área, sin tocar su estado ni su contraseña.
export async function registrarPersonaComoUsuarioPendiente(nombreUsuario, correo = "", area = "") {
  const nombreLimpio = normalizarUsuario(nombreUsuario);
  if (!nombreLimpio) return;
  const existente = await buscarUsuarioPorNombre(nombreLimpio);
  if (existente) {
    const datosExistentes = existente.data();
    const cambios = {};
    if (correo) cambios.correo = correo.trim();
    // El área del perfil queda fija una vez establecida: registrarse en una
    // reunión con otra área no la cambia (solo el admin la cambia a mano).
    // Se completa automáticamente solo la primera vez, si estaba vacía.
    if (area && !datosExistentes.area) cambios.area = area;
    // Si ya existía (ej. lo agregaron como líder/integrante en un RdP)
    // pero todavía no tenía esta app habilitada, se le agrega acá — es
    // la misma persona registrándose por primera vez en Asistencia QR.
    const appsExistentes = Array.isArray(datosExistentes.apps) && datosExistentes.apps.length
      ? datosExistentes.apps
      : APPS_DISPONIBLES.map((a) => a.id);
    if (!appsExistentes.includes(APP_ACTUAL_ID)) {
      cambios.apps = [...appsExistentes, APP_ACTUAL_ID];
    }
    if (Object.keys(cambios).length > 0) {
      await updateDoc(doc(db, "usuarios", existente.id), cambios);
    }
    return;
  }
  const ref = doc(collection(db, "usuarios"));
  await setDoc(ref, {
    nombreUsuario: nombreLimpio,
    password: claveDefaultDesdeNombre(nombreLimpio),
    rol: "usuario",
    area: area || "",
    cargo: "",
    correo: correo ? correo.trim() : correoPorDefecto(nombreLimpio),
    estado: "pendiente",
    apps: [APP_ACTUAL_ID],
    creado: new Date().toISOString(),
  });
}

export async function cambiarRolUsuario(uid, rol) {
  const cambios = { rol };
  if (rol === "admin" || rol === "master") cambios.area = ""; // admin/master no quedan amarrados a un área
  if (rol === "master") cambios.apps = APPS_DISPONIBLES.map((a) => a.id);
  await updateDoc(doc(db, "usuarios", uid), cambios);
}

// Solo tiene sentido usarlo desde el rol Master en Administración: qué
// apps del ecosistema (Asistencia QR / RdP Tracker) tiene habilitadas un
// usuario. Un usuario con rol "master" siempre tiene acceso a todas,
// independiente de lo que quede guardado en este campo.
export async function cambiarAppsUsuario(uid, apps) {
  await updateDoc(doc(db, "usuarios", uid), { apps: Array.isArray(apps) ? apps : [] });
}

export async function cambiarAreaUsuario(uid, area) {
  await updateDoc(doc(db, "usuarios", uid), { area });
}

export async function cambiarCargoUsuario(uid, cargo) {
  await updateDoc(doc(db, "usuarios", uid), { cargo });
}

export async function cambiarCorreoUsuario(uid, correo) {
  await updateDoc(doc(db, "usuarios", uid), { correo: (correo || "").trim() });
}

// Renombrar el nombre de usuario (con el que se muestra e inicia sesión),
// verificando que no choque con otro ya existente.
export async function cambiarNombreUsuario(uid, nuevoNombre) {
  const nombreLimpio = normalizarUsuario(nuevoNombre);
  if (!nombreLimpio) throw new Error("El nombre de usuario no puede quedar vacío.");
  const existente = await buscarUsuarioPorNombre(nuevoNombre);
  if (existente && existente.id !== uid) throw new Error("Ese nombre de usuario ya está en uso.");
  await updateDoc(doc(db, "usuarios", uid), { nombreUsuario: nombreLimpio });
  return nombreLimpio;
}

// Restablecer la contraseña de un usuario ya activo (ej. si la olvidó).
export async function restablecerPassword(uid, nuevaPassword) {
  if (!nuevaPassword || nuevaPassword.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  await updateDoc(doc(db, "usuarios", uid), { password: nuevaPassword });
}

export async function eliminarUsuario(uid) {
  await deleteDoc(doc(db, "usuarios", uid));
}

// --- Áreas ---

export function listarAreas(callback, onError) {
  return onSnapshot(
    collection(db, "areas"),
    (snap) => {
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      callback(lista);
    },
    (error) => {
      console.error("Error leyendo áreas:", error);
      if (onError) onError(error);
    }
  );
}

export async function crearArea(nombre) {
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return;
  const clave = nombreLimpio.toLowerCase();
  const snap = await getDocs(collection(db, "areas"));
  const yaExiste = snap.docs.some((d) => (d.data().nombre || "").trim().toLowerCase() === clave);
  if (yaExiste) throw new Error("Esa área ya existe.");
  await addDoc(collection(db, "areas"), {
    nombre: nombreLimpio,
    creado: new Date().toISOString(),
  });
}

// Renombra un área existente (la usan tanto el filtro del listado como la
// ficha de cada usuario y RdP, que guardan el NOMBRE del área, no su id —
// por eso al renombrar hay que avisar de que los RdPs/usuarios antiguos no
// se actualizan solos).
export async function editarArea(id, nuevoNombre) {
  const nombreLimpio = nuevoNombre.trim();
  if (!nombreLimpio) throw new Error("El nombre del área no puede quedar vacío.");
  const clave = nombreLimpio.toLowerCase();
  const snap = await getDocs(collection(db, "areas"));
  const yaExiste = snap.docs.some(
    (d) => d.id !== id && (d.data().nombre || "").trim().toLowerCase() === clave
  );
  if (yaExiste) throw new Error("Ya existe otra área con ese nombre.");
  await updateDoc(doc(db, "areas", id), { nombre: nombreLimpio });
}

export async function eliminarArea(id) {
  await deleteDoc(doc(db, "areas", id));
}

// Un usuario tiene paso a esta app si es "master" (acceso a todo), o si
// el campo "apps" incluye esta app. Los usuarios migrados antes de que
// existiera este campo (sin "apps" guardado) quedan con acceso a todas
// por compatibilidad — no se les corta el paso por una migración de
// datos; el corte solo aplica hacia adelante, para cuentas nuevas o para
// cuentas donde el rol Master haya elegido a mano restringir el acceso.
function tieneAccesoAEstaApp(datos) {
  // Un usuario "deshabilitado" no entra a ninguna app, sin excepción —
  // ni siquiera si en algún momento fue Master. Es la forma de dar de
  // baja a alguien sin borrar su cuenta (historial, RdPs, asistencia).
  if (datos.rol === "deshabilitado") return false;
  if (datos.rol === "master") return true;
  if (!Object.prototype.hasOwnProperty.call(datos, "apps")) return true;
  return Array.isArray(datos.apps) && datos.apps.includes(APP_ACTUAL_ID);
}

// Revisa el usuario y contraseña directamente contra Firestore.
export async function iniciarSesion(nombreUsuario, password) {
  const encontrado = await buscarUsuarioPorNombre(nombreUsuario);
  if (!encontrado) throw new Error("Ese usuario ya no existe.");
  const datos = encontrado.data();
  if (datos.estado === "pendiente") {
    throw new Error("Tu cuenta todavía no fue validada por un administrador.");
  }
  if (datos.password !== password) throw new Error("Contraseña incorrecta.");
  if (datos.rol === "deshabilitado") {
    throw new Error("Tu cuenta fue deshabilitada. Contacta a un administrador.");
  }
  if (!tieneAccesoAEstaApp(datos)) {
    throw new Error("Tu usuario no está habilitado para esta aplicación. Pide a un administrador que te habilite acceso.");
  }
  const usuario = { uid: encontrado.id, ...datos };
  window.localStorage.setItem(CLAVE_SESION, usuario.uid);
  return usuario;
}

export function cerrarSesion() {
  window.localStorage.removeItem(CLAVE_SESION);
}

// Al cargar la app, intenta recuperar la sesión guardada localmente.
export async function recuperarSesion() {
  const uid = window.localStorage.getItem(CLAVE_SESION);
  if (!uid) return null;
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) {
    window.localStorage.removeItem(CLAVE_SESION);
    return null;
  }
  const datos = snap.data();
  if (!tieneAccesoAEstaApp(datos)) {
    // Le sacaron el acceso a esta app (o lo bajaron de Master) mientras
    // tenía la sesión abierta: se cierra la sesión local.
    window.localStorage.removeItem(CLAVE_SESION);
    return null;
  }
  return { uid, ...datos };
}
