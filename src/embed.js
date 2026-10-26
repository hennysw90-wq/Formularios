// Modo embebido: la app se abre dentro del portal (?embed=1). El portal ya pone el banner, el título y el fondo,
// así que aquí se ocultan los logos y el título propios y se deja el fondo transparente.
export function esEmbebido(search = typeof window !== "undefined" ? window.location.search : "") {
  return new URLSearchParams(search || "").get("embed") === "1";
}

export function aplicarModoEmbebido() {
  if (esEmbebido()) document.documentElement.classList.add("ca-embed");
}
