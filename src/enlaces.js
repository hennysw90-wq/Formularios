// Enlaces directos a un formulario (los que van dentro del QR).
export const URL_APP = "https://formularioseo.web.app";

/** En tu computador de pruebas usa esa dirección; en producción siempre la dirección pública de la app. */
export function baseUrl() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  return /^(localhost|127\.0\.0\.1)$/.test(host) ? window.location.origin : URL_APP;
}

export function esEntornoDePrueba() {
  return baseUrl() !== URL_APP;
}

/** Enlace del QR: del formulario y, si se indica, de UNA reunión (el evaluador no puede cambiarla). */
export function enlaceFormulario(id, rutinaId) {
  const base = `${baseUrl()}/?formulario=${encodeURIComponent(id)}`;
  return rutinaId ? `${base}&rutina=${encodeURIComponent(rutinaId)}` : base;
}

export function rutinaDesdeUrl(search) {
  return new URLSearchParams(search || "").get("rutina") || "";
}

export function formularioDesdeUrl(search) {
  return new URLSearchParams(search || "").get("formulario") || "";
}
