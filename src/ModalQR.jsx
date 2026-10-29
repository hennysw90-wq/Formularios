import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { enlaceFormulario, esEntornoDePrueba } from "./enlaces.js";
import { crearImagenQR, COLOR_QR } from "./qrImagen.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const nombreArchivo = (...partes) => `QR_${partes.filter(Boolean).map((p) => String(p).slice(0, 40)).join("_").replace(/[^\wáéíóúñÁÉÍÓÚÑ-]+/g, "_")}.png`; // cada parte, corta

let fuentesListas = null;
async function cargarFuentes() {
  // El canvas no descarga tipografías por sí solo: se piden antes de dibujar para que la imagen use la de la app.
  if (!fuentesListas) {
    fuentesListas = (async () => {
      try {
        if (document.fonts && document.fonts.load) await Promise.all(["800 40px Archivo"].map((f) => document.fonts.load(f)));
      } catch { /* sin tipografías: se usa la de reserva */ }
    })();
  }
  return fuentesListas;
}

/** Imagen PNG (data URL) del QR del formulario, con su nombre al centro. */
async function generarImagen(form) {
  await cargarFuentes();
  const enlace = enlaceFormulario(form.id);
  try {
    return crearImagenQR({ enlace, nombre: form.nombre });
  } catch (e) {
    // Si el navegador no puede dibujar la imagen completa, se entrega al menos el QR solo.
    console.error("No se pudo componer la imagen del QR:", e);
    return QRCode.toDataURL(enlace, { width: 720, margin: 2, errorCorrectionLevel: "H", color: { dark: COLOR_QR, light: "#ffffff" } });
  }
}

/**
 * QR FIJO del formulario: uno solo por formulario, con su nombre al centro. El enlace es siempre el mismo
 * (no cambia al editar el formulario ni sus asignaciones), así que se puede imprimir una vez y dejarlo pegado.
 * Al escanearlo, cada persona se identifica y ve sus reuniones asignadas de este formulario.
 */
export default function ModalQR({ form, onCerrar }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const link = enlaceFormulario(form.id);
  const publicado = form.estado === "publicado";

  useEffect(() => {
    let vivo = true;
    setDataUrl("");
    generarImagen(form)
      .then((url) => vivo && setDataUrl(url))
      .catch((e) => console.error("No se pudo generar el QR:", e));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, form.nombre]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copia este enlace:", link);
    }
  }

  function imprimir() {
    const v = window.open("", "_blank");
    if (!v) {
      window.alert("El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio, o descarga el QR e imprímelo.");
      return;
    }
    v.document.write(`<html><head><title>QR · ${esc(form.nombre)}</title>
      <style>@page{margin:14mm} body{font-family:Arial,Helvetica,sans-serif;text-align:center;padding:10px;color:#2c2c2a}
      img{width:560px;max-width:100%;height:auto} .url{font-size:12.5px;word-break:break-all;color:#666;margin:10px 0 4px} .pie{font-size:13px;color:#555} .cab{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#b0420e;margin:0} .for{font-size:20px;font-weight:700;margin:2px 0 10px}</style></head>
      <body><p class="cab">Formularios</p><p class="for">${esc(form.nombre)}</p><img src="${dataUrl}" alt="QR" /><p class="url">${esc(link)}</p>
      <p class="pie">Escanéalo, escribe tu nombre y verás los formularios que tienes asignados.</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    v.document.close();
    v.focus();
  }

  const archivo = nombreArchivo(form.nombre || "formulario");

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,18,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onClick={onCerrar}
    >
      <div className="ca-card" style={{ maxWidth: 440, width: "100%", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--verde-oscuro)" }}>QR del formulario</p>
        <p style={{ margin: "4px 0 2px", fontSize: 16, fontWeight: 800 }}>{form.nombre}</p>
        <p style={{ margin: "4px 0 10px", fontSize: 13, color: "var(--texto-suave)" }}>
          Es un QR fijo: siempre es el mismo para este formulario, aunque cambies el formulario o sus asignaciones. Al escanearlo,
          cada persona escribe su nombre y ve las reuniones que tiene asignadas con este formulario.
        </p>

        {!publicado && (
          <p style={{ background: "#fff3de", color: "#7a5200", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>
            ⚠ Este formulario está en borrador: el QR no funcionará hasta que lo publiques.
          </p>
        )}
        {esEntornoDePrueba() && (
          <p style={{ background: "#fff3de", color: "#7a5200", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>
            Estás en una dirección de prueba: este QR solo funciona en este computador. En la app publicada se genera con la dirección real.
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 12px" }}>
          {dataUrl ? <img src={dataUrl} alt={`Código QR de ${form.nombre}`} style={{ width: "100%", maxWidth: 330, height: "auto", borderRadius: 8, border: "1px solid var(--borde)" }} />
            : <div style={{ width: 260, height: 260 }} />}
        </div>

        <div style={{ background: "var(--fondo)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--texto-suave)", overflowWrap: "anywhere" }}>{link.replace(/([/?&=])/g, "$1\u200b")}</div>
        <p style={{ fontSize: 12.5, color: "var(--texto-suave)", margin: "10px 0 14px" }}>
          No hace falta iniciar sesión para responder; para ver las evaluaciones recibidas se pide la clave.
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={dataUrl || undefined} download={archivo} style={{ ...btn, textDecoration: "none", pointerEvents: dataUrl ? "auto" : "none", opacity: dataUrl ? 1 : 0.5 }}>Descargar PNG</a>
          <button style={btn} onClick={imprimir} disabled={!dataUrl}>Imprimir</button>
          <button style={btn} onClick={copiar}>{copiado ? "✓ Copiado" : "Copiar enlace"}</button>
          <button style={btnPrim} onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnPrim = { ...btn, background: "var(--verde)", borderColor: "var(--verde)", color: "#fff" };
