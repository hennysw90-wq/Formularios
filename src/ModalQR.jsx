import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { enlaceFormulario, esEntornoDePrueba } from "./enlaces.js";
import { crearImagenQR, COLOR_QR } from "./qrImagen.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const horarioDe = (r) => (r.horaInicio && r.horaFin ? `${r.horaInicio} – ${r.horaFin}` : r.horaInicio || "");
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

/** Imagen PNG (data URL) del QR de una reunión del formulario. */
async function generarImagen(form, reunion) {
  await cargarFuentes();
  const enlace = enlaceFormulario(form.id, reunion ? reunion.sesionId : "");
  try {
    return crearImagenQR({ enlace, nombre: reunion ? reunion.nombre : form.nombre });
  } catch (e) {
    // Si el navegador no puede dibujar la imagen completa, se entrega al menos el QR solo.
    console.error("No se pudo componer la imagen del QR:", e);
    return QRCode.toDataURL(enlace, { width: 720, margin: 2, errorCorrectionLevel: "H", color: { dark: COLOR_QR, light: "#ffffff" } });
  }
}

/**
 * QR de una reunión de un formulario: al escanearlo con el celular se abre directo la CdR de ESA reunión
 * (quien evalúa no la puede cambiar). Si el formulario tiene varias reuniones, se elige para cuál es el QR.
 */
export default function ModalQR({ form, onCerrar }) {
  const rutinas = form.rutinas || [];
  const [rutinaId, setRutinaId] = useState(rutinas.length === 1 ? rutinas[0].sesionId : "");
  const [dataUrl, setDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [descargando, setDescargando] = useState("");
  const reunion = rutinas.find((r) => r.sesionId === rutinaId) || null;
  const falta = rutinas.length > 0 && !reunion; // hay reuniones y aún no se elige para cuál es el QR
  const link = enlaceFormulario(form.id, reunion ? reunion.sesionId : "");
  const publicado = form.estado === "publicado";
  const sinSesion = form.accesoSinSesion !== false;

  useEffect(() => {
    let vivo = true;
    setDataUrl("");
    if (falta) return undefined;
    generarImagen(form, reunion)
      .then((url) => vivo && setDataUrl(url))
      .catch((e) => console.error("No se pudo generar el QR:", e));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link, form.nombre, falta, reunion && reunion.nombre, reunion && horarioDe(reunion)]);

  async function descargarTodos() {
    try {
      for (let i = 0; i < rutinas.length; i += 1) {
        setDescargando(`${i + 1} de ${rutinas.length}`);
        const url = await generarImagen(form, rutinas[i]);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreArchivo(form.nombre, rutinas[i].nombre);
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 350)); // el navegador acepta varias descargas seguidas si van con una pausa
      }
    } finally {
      setDescargando("");
    }
  }

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
    v.document.write(`<html><head><title>QR · ${esc(form.nombre)}${reunion ? " · " + esc(reunion.nombre) : ""}</title>
      <style>@page{margin:14mm} body{font-family:Arial,Helvetica,sans-serif;text-align:center;padding:10px;color:#2c2c2a}
      img{width:560px;max-width:100%;height:auto} .url{font-size:12.5px;word-break:break-all;color:#666;margin:10px 0 4px} .pie{font-size:13px;color:#555} .cab{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#b0420e;margin:0} .for{font-size:20px;font-weight:700;margin:2px 0 10px}</style></head>
      <body><p class="cab">CdR · Confirmación de Rol</p><p class="for">${esc(form.nombre)}</p><img src="${dataUrl}" alt="QR" /><p class="url">${esc(link)}</p>
      <p class="pie">${sinSesion ? "No necesitas iniciar sesión: elige tu nombre en la lista de asistentes." : "Necesitas tu usuario y contraseña. Solo pueden abrirlo las personas asignadas como evaluadoras."}</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    v.document.close();
    v.focus();
  }

  const archivo = nombreArchivo(form.nombre || "formulario", reunion && reunion.nombre);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(20,20,18,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onClick={onCerrar}
    >
      <div className="ca-card" style={{ maxWidth: 440, width: "100%", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--verde-oscuro)" }}>QR de una reunión</p>
        <p style={{ margin: "4px 0 10px", fontSize: 13, color: "var(--texto-suave)" }}>
          {rutinas.length
            ? "Cada QR es de una sola reunión: al escanearlo se abre la CdR de esa reunión ya definida, y quien evalúa no puede cambiarla. La imagen lleva el nombre de la reunión en el centro, para que se sepa de qué es."
            : "Al escanearlo con el celular se abre directo la CdR de este formulario. Este formulario aún no tiene reuniones definidas (pestaña A · Datos generales)."}
        </p>

        {rutinas.length > 1 && (
          <div style={{ textAlign: "left", margin: "0 0 12px" }}>
            <label className="ca-label">¿Para qué reunión es este QR?</label>
            <select className="rp-select" aria-label="Reunión de este QR" value={rutinaId} onChange={(e) => setRutinaId(e.target.value)}>
              <option value="">Elige la reunión…</option>
              {rutinas.map((r) => <option key={r.sesionId} value={r.sesionId}>{r.nombre}{horarioDe(r) ? ` (${horarioDe(r)})` : ""}</option>)}
            </select>
          </div>
        )}
        {rutinas.length === 1 && (
          <p style={{ background: "var(--fondo)", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, fontWeight: 700, margin: "0 0 12px", textAlign: "left" }}>
            Reunión: {rutinas[0].nombre}{horarioDe(rutinas[0]) ? <span style={{ fontWeight: 500, color: "var(--texto-suave)" }}> · {horarioDe(rutinas[0])}</span> : null}
          </p>
        )}

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
          {dataUrl ? <img src={dataUrl} alt={`Código QR de ${form.nombre}${reunion ? " · " + reunion.nombre : ""}`} style={{ width: "100%", maxWidth: 330, height: "auto", borderRadius: 8, border: "1px solid var(--borde)" }} />
            : falta ? <div style={{ width: "100%", maxWidth: 330, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed var(--borde)", borderRadius: 8, color: "var(--texto-suave)", fontSize: 13.5, padding: 14 }}>Elige la reunión para generar su QR.</div>
            : <div style={{ width: 260, height: 260 }} />}
        </div>

        {!falta && <div style={{ background: "var(--fondo)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--texto-suave)", overflowWrap: "anywhere" }}>{link.replace(/([/?&=])/g, "$1\u200b")}</div>}
        <p style={{ fontSize: 12.5, color: "var(--texto-suave)", margin: "10px 0 14px" }}>
          {sinSesion
            ? "Quien lo escanee no necesita iniciar sesión: elige su nombre de la lista de asistentes de Control de Asistencia. Cualquiera que tenga este QR podrá registrar una CdR, así que cuídalo."
            : "Quien lo escanee debe iniciar sesión con su usuario y contraseña (solo la primera vez en ese celular). Solo pueden abrirlo las personas asignadas como evaluadoras y el Master."}
        </p>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={dataUrl || undefined} download={archivo} style={{ ...btn, textDecoration: "none", pointerEvents: dataUrl ? "auto" : "none", opacity: dataUrl ? 1 : 0.5 }}>Descargar PNG</a>
          <button style={btn} onClick={imprimir} disabled={!dataUrl}>Imprimir</button>
          <button style={btn} onClick={copiar} disabled={falta}>{copiado ? "✓ Copiado" : "Copiar enlace"}</button>
          {rutinas.length > 1 && <button style={btn} onClick={descargarTodos} disabled={!!descargando}>{descargando ? `Descargando ${descargando}…` : `Descargar los ${rutinas.length} QR`}</button>}
          <button style={btnPrim} onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const btn = { border: "1px solid var(--borde)", background: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, color: "var(--texto)", cursor: "pointer" };
const btnPrim = { ...btn, background: "var(--verde)", borderColor: "var(--verde)", color: "#fff" };
