import { useRef, useState } from "react";

// Respaldo fotográfico de un criterio: "Tomar foto" abre la cámara del celular y "Cargar foto" la galería o un
// archivo. La foto se achica en el celular (JPG de ~1000 px) y se guarda dentro de la evaluación.

const LIMITE_FOTO = 110 * 1024; // ~110 KB por foto
export const LIMITE_FOTOS_EVALUACION = 700 * 1024; // la evaluación entera debe caber en un documento

/** Achica una imagen a JPG (máx. 1000 px) bajando la calidad hasta que pese menos de ~110 KB. */
export async function comprimirFoto(archivo) {
  if (!archivo || !String(archivo.type || "").startsWith("image/")) throw new Error("El archivo no es una imagen.");
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    let lado = 1000;
    for (let intento = 0; intento < 6; intento++) {
      const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.7, 0.55, 0.45]) {
        const datos = canvas.toDataURL("image/jpeg", q);
        if (datos.length * 0.75 <= LIMITE_FOTO) return datos;
      }
      lado = Math.round(lado * 0.75);
    }
    throw new Error("No se pudo achicar la foto lo suficiente. Prueba con otra.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Peso aproximado de las fotos ya cargadas en una evaluación (bytes). */
export function pesoFotos(respuestas) {
  return Object.values(respuestas || {}).reduce((s, r) => s + (r?.foto ? r.foto.length * 0.75 : 0), 0);
}

const btn = { border: "1px solid var(--borde, #D3D1C7)", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

export default function FotoRespaldo({ codigo, foto, onCambiar, soloLectura = false, obligatoria = true, pesoOtras = 0 }) {
  const camara = useRef(null);
  const galeria = useRef(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  async function elegir(ev) {
    const archivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!archivo) return;
    setError("");
    setTrabajando(true);
    try {
      const datos = await comprimirFoto(archivo);
      if (pesoOtras + datos.length * 0.75 > LIMITE_FOTOS_EVALUACION) {
        throw new Error("Ya hay muchas fotos en esta evaluación y no cabe otra. Quita alguna o usa una más liviana.");
      }
      onCambiar(datos);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setTrabajando(false);
    }
  }

  if (soloLectura) {
    return foto ? <img src={foto} alt={`Respaldo fotográfico de ${codigo}`} style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid var(--borde, #D3D1C7)", display: "block", marginTop: 6 }} /> : null;
  }
  return (
    <div style={{ marginTop: 10, border: `1.5px dashed ${foto ? "#0F6E56" : obligatoria ? "#BA7517" : "var(--borde, #D3D1C7)"}`, borderRadius: 10, padding: "8px 10px", background: foto ? "#F4FBF9" : "#FFFBF3" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        📷 Respaldo fotográfico{obligatoria ? <span style={{ color: "var(--rojo, #993C1D)" }}> · obligatorio</span> : null}
      </div>
      {foto && <img src={foto} alt={`Respaldo fotográfico de ${codigo}`} style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "1px solid var(--borde, #D3D1C7)", display: "block", marginBottom: 6 }} />}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={btn} disabled={trabajando} onClick={() => camara.current?.click()}>📷 {foto ? "Tomar otra" : "Tomar foto"}</button>
        <button type="button" style={btn} disabled={trabajando} onClick={() => galeria.current?.click()}>🖼 {foto ? "Cambiar foto" : "Cargar foto"}</button>
        {foto && <button type="button" style={{ ...btn, color: "var(--rojo, #993C1D)" }} disabled={trabajando} onClick={() => onCambiar("")}>Quitar</button>}
        {trabajando && <span style={{ fontSize: 13, color: "var(--texto-suave)", alignSelf: "center" }}>Procesando foto…</span>}
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={elegir} aria-label={`Tomar foto para ${codigo}`} />
      <input ref={galeria} type="file" accept="image/*" style={{ display: "none" }} onChange={elegir} aria-label={`Cargar foto para ${codigo}`} />
      {error && <p style={{ color: "var(--rojo, #993C1D)", fontSize: 12.5, margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
