// Imagen del QR del formulario: el código ocupa toda la imagen, en el color de la CdR (el mismo terracota del botón
// «Confirmación de Rol» de la portada, para que se asocie a esta app), y el nombre del formulario va en un recuadro
// redondeado al centro. Se dibuja en un canvas (el QR se pinta módulo a módulo).
//
// El recuadro tapa una parte del código, así que se usa el nivel de corrección de errores más alto («H», recupera hasta
// ~30 %) y el recuadro se limita a ~8 % del área del código; la imagen se probó con lectores de QR (ver pruebas).
import QRCode from "qrcode";

const FUENTE = "Archivo, Arial, Helvetica, sans-serif";
/** Terracota del botón «Confirmación de Rol» del portal (rgb 176, 66, 14): contraste ~5,8:1 sobre blanco. */
export const COLOR_QR = "#b0420e";
const LADO = 900; // la imagen es cuadrada
const ZONA_SILENCIO = 3; // módulos en blanco alrededor del código
const MAX_ANCHO_ETIQUETA = 0.4; // del lado del código
const MAX_ALTO_ETIQUETA = 0.2;

/** Parte un texto en líneas que caben en `ancho`; corta las palabras que no caben y pone "…" si sobran líneas. */
export function partirTexto(ctx, texto, ancho, maxLineas = 3) {
  const cabe = (t) => ctx.measureText(t).width <= ancho;
  const lineas = [];
  let actual = "";
  for (let palabra of String(texto || "").split(/\s+/).filter(Boolean)) {
    while (!cabe(palabra)) {
      let n = palabra.length;
      while (n > 1 && !cabe(palabra.slice(0, n))) n -= 1;
      if (actual) {
        lineas.push(actual);
        actual = "";
      }
      lineas.push(palabra.slice(0, n));
      palabra = palabra.slice(n);
    }
    if (!palabra) continue;
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(prueba)) actual = prueba;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length <= maxLineas) return lineas;
  const recortadas = lineas.slice(0, maxLineas);
  let ultima = recortadas[maxLineas - 1];
  while (ultima.length > 1 && !cabe(`${ultima}…`)) ultima = ultima.slice(0, -1);
  recortadas[maxLineas - 1] = `${ultima}…`;
  return recortadas;
}

/**
 * Elige el tamaño de letra más grande con que el nombre cabe en el recuadro (entre 40 y 22 px). Si ni a 22 px cabe,
 * se recorta con «…». Devuelve las líneas y las medidas del recuadro.
 */
export function ajustarEtiqueta(ctx, nombre, maxAncho, maxAlto) {
  const relleno = 18;
  const interior = maxAncho - relleno * 2;
  const texto = String(nombre || "").trim() || "Reunión";
  let elegido = null;
  for (let px = 40; px >= 22; px -= 2) {
    ctx.font = `800 ${px}px ${FUENTE}`;
    const interlineado = Math.round(px * 1.22);
    const maxLineas = Math.max(1, Math.floor((maxAlto - relleno * 2) / interlineado));
    const completo = partirTexto(ctx, texto, interior, 99);
    elegido = { px, interlineado, lineas: completo.length <= maxLineas ? completo : partirTexto(ctx, texto, interior, maxLineas) };
    if (completo.length <= maxLineas) break; // cabe entero con esta letra
  }
  ctx.font = `800 ${elegido.px}px ${FUENTE}`;
  const anchoTexto = Math.max(...elegido.lineas.map((l) => ctx.measureText(l).width));
  return {
    ...elegido,
    ancho: Math.min(maxAncho, Math.max(150, Math.ceil(anchoTexto) + relleno * 2)),
    alto: elegido.lineas.length * elegido.interlineado + relleno * 2,
  };
}

function rectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pintar(ctx, { enlace, nombre }) {
  const qr = QRCode.create(enlace, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const celda = Math.floor(LADO / (n + ZONA_SILENCIO * 2));
  const ladoQr = celda * n;
  const x0 = Math.round((LADO - ladoQr) / 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LADO, LADO);
  ctx.fillStyle = COLOR_QR;
  for (let f = 0; f < n; f += 1) {
    for (let c = 0; c < n; c += 1) {
      if (qr.modules.get(f, c)) ctx.fillRect(x0 + c * celda, x0 + f * celda, celda, celda);
    }
  }

  // Recuadro central con el nombre de la reunión
  const e = ajustarEtiqueta(ctx, nombre, ladoQr * MAX_ANCHO_ETIQUETA, ladoQr * MAX_ALTO_ETIQUETA);
  const bx = Math.round((LADO - e.ancho) / 2);
  const by = Math.round((LADO - e.alto) / 2);
  ctx.fillStyle = "#ffffff"; // halo blanco: aleja los módulos del borde para que el recuadro se lea limpio
  rectRedondeado(ctx, bx - 8, by - 8, e.ancho + 16, e.alto + 16, 28);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = COLOR_QR;
  rectRedondeado(ctx, bx, by, e.ancho, e.alto, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOR_QR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${e.px}px ${FUENTE}`;
  e.lineas.forEach((l, i) => ctx.fillText(l, LADO / 2, by + 18 + e.interlineado * (i + 0.5)));
  return { n, tapado: (e.ancho + 16) * (e.alto + 16) / (ladoQr * ladoQr) };
}

/**
 * Devuelve la imagen PNG (data URL) del QR de `enlace` con `nombre` (la reunión) al centro.
 * `crearCanvas` se puede reemplazar (pruebas); por defecto usa el del navegador.
 */
export function crearImagenQR({ enlace, nombre }, crearCanvas = () => document.createElement("canvas")) {
  const canvas = crearCanvas();
  canvas.width = LADO;
  canvas.height = LADO;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede dibujar la imagen del QR.");
  pintar(ctx, { enlace, nombre });
  return canvas.toDataURL("image/png");
}
