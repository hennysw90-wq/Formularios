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

const CLAVE_SESION = "formularios_sesion_uid";

const USUARIO_MAESTRO = "Excelencia Operacional";
const CLAVE_MAESTRO = "Excelencia OEMS";

// ID de esta app en el campo `apps` del directorio de usuarios
export const APP_ACTUAL_ID = "formularios";

export const APPS_DISPONIBLES = [
  { id: "asistencia", nombre: "Asistencia QR" },
  { id: "rdp", nombre: "RdP Tracker" },
  { id: "formularios", nombre: "Formularios" },
];

function normalizarUsuario(nombreUsuario) {
  return (nombreUsuario || "").trim().replace(/\s+/g, " ");
}

function normalizarParaCorreo(txt) {
  return (txt || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function correoPorDefecto(nombreUsuario) {
  const partes = normalizarUsuario(nombreUsuario).split(" ").filter(Boolean);
  if (partes.length === 0) return "";
  const nombre = normalizarParaCorreo(partes[0]);
  const apellido = partes.length > 1 ? normalizarParaCorreo(partes[partes.length - 1]) : "";
  if (!nombre) return "";
  return apellido ? `${nombre}.${apellido}@glencore.cl` : `${nombre}@glencore.cl`;
}

function claveUsuario(nombreUsuario) {
  return normalizarUsuario(nombreUsuario).toLowerCase().replace(/\s+/g, "");
}

async function buscarUsuarioPorNombre(nombreUsuario) {
  const clave = claveUsuario(nombreUsuario);
  if (!clave) return null;
  const snap = await getDocs(collection(db, "usuarios"));
  const encontrado = snap.docs.find((d) => claveUsuario(d.data().nombreUsuario) === clave);
  return encontrado || null;
}

// Retorna true si el usuario tiene acceso a esta app.
// - Master siempre tiene acceso
// - Deshabilitado nunca
// - Sin campo apps → acceso a todas (compatibilidad)
// - Con campo apps → solo las que tenga
export function tieneAccesoAEstaApp(usuario) {
  if (!usuario) return false;
  if (usuario.rol === "deshabilitado") return false;
  if (usuario.rol === "master") return true;
  if (!usuario.apps || usuario.apps.length === 0) return true;
  return usuario.apps.includes(APP_ACTUAL_ID);
}

// Asegura que el campo `apps` del usuario incluya esta app.
async function asegurarAppHabilitada(usuarioDoc) {
  const datos = usuarioDoc.data ? usuarioDoc.data() : usuarioDoc;
  const id = usuarioDoc.id || usuarioDoc.uid;
  const appsActuales = datos.apps || [];
  if (!appsActuales.includes(APP_ACTUAL_ID)) {
    const nuevasApps = [...appsActuales, APP_ACTUAL_ID];
    await updateDoc(doc(db, "usuarios", id), { apps: nuevasApps });
    return { ...datos, apps: nuevasApps };
  }
  return datos;
}

export async function asegurarUsuarioMaestro() {
  const conNombreNuevo = await buscarUsuarioPorNombre(USUARIO_MAESTRO);
  if (conNombreNuevo) return;
  const conNombreViejo = await buscarUsuarioPorNombre("Excelencia");
  if (conNombreViejo) {
    await updateDoc(doc(db, "usuarios", conNombreViejo.id), { nombreUsuario: USUARIO_MAESTRO });
    return;
  }
  const ref = doc(collection(db, "usuarios"));
  await setDoc(ref, {
    nombreUsuario: USUARIO_MAESTRO,
    password: CLAVE_MAESTRO,
    rol: "master",
    estado: "activo",
    correo: "",
    apps: APPS_DISPONIBLES.map((a) => a.id),
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

function areaSegunRol(rol, area) {
  return rol === "admin" || rol === "master" ? "" : area || "";
}

export async function crearUsuario(nombreUsuario, password, rol, area = "", cargo = "", correo) {
  const yaExiste = await buscarUsuarioPorNombre(nombreUsuario);
  if (yaExiste) {
    // Fusionar: agregar esta app al usuario existente
    const datosExistentes = await asegurarAppHabilitada(yaExiste);
    return { fusionado: true, nombreUsuario: datosExistentes.nombreUsuario };
  }
  const ref = doc(collection(db, "usuarios"));
  await setDoc(ref, {
    nombreUsuario: normalizarUsuario(nombreUsuario),
    password,
    rol,
    area: areaSegunRol(rol, area),
    cargo,
    correo: correo !== undefined && correo !== null ? correo.trim() : correoPorDefecto(nombreUsuario),
    estado: "activo",
    apps: [APP_ACTUAL_ID],
    creado: new Date().toISOString(),
  });
  return { fusionado: false };
}

export async function crearUsuarioPendiente(nombreUsuario, password, correo = "", area = "", cargo = "") {
  const nombreLimpio = normalizarUsuario(nombreUsuario);
  if (!nombreLimpio) throw new Error("Escribe tu nombre.");
  if (!password || password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const yaExiste = await buscarUsuarioPorNombre(nombreUsuario);
  if (yaExiste) {
    throw new Error("Ya existe un usuario con ese nombre. Si es tuyo, pide la clave a un administrador.");
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
  return { uid: ref.id, ...datos };
}

export async function validarUsuarioPendiente(uid, { password, rol, area, nombreUsuario, cargo, correo } = {}) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) throw new Error("Ese usuario ya no existe.");
  const actual = snap.data();

  const passwordFinal = password || actual.password;
  if (!passwordFinal || passwordFinal.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const rolFinal = rol || actual.rol || "usuario";

  // Si el nombre ya existe en otro uid → fusionar
  if (nombreUsuario !== undefined) {
    const nombreLimpio = normalizarUsuario(nombreUsuario);
    if (!nombreLimpio) throw new Error("El nombre no puede quedar vacío.");
    const existente = await buscarUsuarioPorNombre(nombreUsuario);
    if (existente && existente.id !== uid) {
      const datosExistentes = await asegurarAppHabilitada(existente);
      await deleteDoc(doc(db, "usuarios", uid));
      return { fusionado: true, nombreUsuario: datosExistentes.nombreUsuario };
    }
  }

  const datos = {
    password: passwordFinal,
    rol: rolFinal,
    area: areaSegunRol(rolFinal, area !== undefined ? area : actual.area),
    estado: "activo",
    correo:
      correo !== undefined && correo !== null && correo !== ""
        ? correo.trim()
        : actual.correo || correoPorDefecto(nombreUsuario || actual.nombreUsuario),
  };
  if (cargo !== undefined) datos.cargo = cargo.trim();
  if (nombreUsuario !== undefined) {
    datos.nombreUsuario = normalizarUsuario(nombreUsuario);
  }
  // Asegurar que esta app quede en su lista
  const appsActuales = actual.apps || [];
  if (!appsActuales.includes(APP_ACTUAL_ID)) {
    datos.apps = [...appsActuales, APP_ACTUAL_ID];
  }
  await updateDoc(doc(db, "usuarios", uid), datos);
  return { fusionado: false };
}

export async function cambiarAppsUsuario(uid, apps) {
  await updateDoc(doc(db, "usuarios", uid), { apps });
}

export async function cambiarRolUsuario(uid, rol) {
  const cambios = { rol };
  if (rol === "admin" || rol === "master") cambios.area = "";
  await updateDoc(doc(db, "usuarios", uid), cambios);
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

export async function cambiarNombreUsuario(uid, nuevoNombre) {
  const nombreLimpio = normalizarUsuario(nuevoNombre);
  if (!nombreLimpio) throw new Error("El nombre de usuario no puede quedar vacío.");
  const existente = await buscarUsuarioPorNombre(nuevoNombre);
  if (existente && existente.id !== uid) throw new Error("Ese nombre de usuario ya está en uso.");
  await updateDoc(doc(db, "usuarios", uid), { nombreUsuario: nombreLimpio });
  return nombreLimpio;
}

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

export async function iniciarSesion(nombreUsuario, password) {
  const encontrado = await buscarUsuarioPorNombre(nombreUsuario);
  if (!encontrado) throw new Error("Ese usuario no existe.");
  const datos = encontrado.data();
  if (datos.rol === "deshabilitado") {
    throw new Error("Tu cuenta está deshabilitada. Contacta a un administrador.");
  }
  if (datos.estado === "pendiente") {
    throw new Error("Tu cuenta todavía no fue validada por un administrador.");
  }
  if (!tieneAccesoAEstaApp({ ...datos, uid: encontrado.id })) {
    throw new Error("No tienes acceso a esta aplicación.");
  }
  if (datos.password !== password) throw new Error("Contraseña incorrecta.");
  const usuario = { uid: encontrado.id, ...datos };
  window.localStorage.setItem(CLAVE_SESION, usuario.uid);
  return usuario;
}

export function cerrarSesion() {
  window.localStorage.removeItem(CLAVE_SESION);
}

export async function recuperarSesion() {
  const uid = window.localStorage.getItem(CLAVE_SESION);
  if (!uid) return null;
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) {
    window.localStorage.removeItem(CLAVE_SESION);
    return null;
  }
  const datos = snap.data();
  if (!tieneAccesoAEstaApp({ ...datos, uid })) {
    window.localStorage.removeItem(CLAVE_SESION);
    return null;
  }
  return { uid, ...datos };
}
