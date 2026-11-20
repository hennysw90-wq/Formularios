// Versiones sin caché viejo: los archivos del sitio llevan un código en el nombre (solo cambian cuando hay cambios) y la
// página principal se revisa siempre. Aquí se cubre lo que queda: una pestaña que ya estaba abierta cuando salió una
// versión nueva. Se compara con version.json (nunca en caché) y, si cambió, avisa con un botón para actualizar
// (sin recargar sola, para no cortar a alguien que está llenando un formulario).
const ID = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

function avisar() {
  if (document.getElementById("aviso-version")) return;
  const d = document.createElement("div");
  d.id = "aviso-version";
  d.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;max-width:460px;margin:0 auto;background:#1b3b36;color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:10px;align-items:center;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)";
  d.innerHTML = '<span style="flex:1">Hay una versión nueva de la app.</span><button style="background:#fff;color:#1b3b36;border:0;border-radius:8px;padding:7px 12px;font:700 14px system-ui,sans-serif;cursor:pointer">Actualizar</button>';
  d.querySelector("button").onclick = () => window.location.reload();
  document.body.appendChild(d);
}

async function revisar() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const { id } = await r.json();
    if (id && id !== ID) avisar();
  } catch { /* sin conexión: se revisa la próxima vez */ }
}

export function vigilarVersion() {
  if (ID === "dev") return;
  // Un archivo de una versión anterior que ya no existe: se recarga una sola vez para tomar la nueva.
  window.addEventListener("vite:preloadError", () => {
    try {
      if (sessionStorage.getItem("recarga-version")) return;
      sessionStorage.setItem("recarga-version", "1");
    } catch { /* sin almacenamiento */ }
    window.location.reload();
  });
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && revisar());
  setInterval(revisar, 5 * 60 * 1000);
  setTimeout(revisar, 4000);
}
