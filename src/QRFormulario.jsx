import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { linkRespuesta } from "./formularios.js";

const LADO = 900; // se genera grande para que imprima nítido

// Azul corporativo del QR y del recuadro con el nombre.
const AZUL = "#0F4C81";

export default function QRFormulario({ formulario, onCerrar }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const link = linkRespuesta(formulario.id);

  useEffect(() => {
    let vivo = true;
    // Corrección de errores alta (H): recupera hasta un 30% del código, que
    // es lo que permite tapar el centro con el nombre sin romper la lectura.
    QRCode.toDataURL(link, {
      width: LADO,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: AZUL, light: "#ffffff" },
    })
      .then((base) => dibujarNombre(base, formulario.titulo))
      .then((final) => vivo && setDataUrl(final))
      .catch(() => {});
    return () => { vivo = false; };
  }, [link, formulario.titulo]);

  function copiarLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  function descargar() {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `QR-${formulario.titulo.replace(/[^\w\s-]/g, "").trim() || "formulario"}.png`;
    a.click();
  }

  function imprimir() {
    const ventana = window.open("", "_blank");
    ventana.document.write(`
      <html><head><title>${formulario.titulo}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px;">
        <h2>${formulario.titulo}</h2>
        ${formulario.descripcion ? `<p style="color:#555;">${formulario.descripcion}</p>` : ""}
        <p>Escanea el QR para responder este formulario</p>
        <img src="${dataUrl}" style="width:360px;height:360px;" />
        <p style="color:#666;font-size:13px;">${link}</p>
      </body></html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
  }

  return (
    <div style={estilos.fondo} onClick={onCerrar}>
      <div style={estilos.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: AZUL, textTransform: "uppercase", letterSpacing: 1 }}>
              QR del formulario
            </p>
            <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 17, color: "#1f2a2e" }}>
              {formulario.titulo}
            </p>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#5b6b6e" }}>✕</button>
        </div>

        {dataUrl ? (
          <img src={dataUrl} alt="QR" style={{ width: "100%", maxWidth: 300, display: "block", margin: "0 auto 16px", borderRadius: 12 }} />
        ) : (
          <p style={{ textAlign: "center", color: "#5b6b6e", padding: "40px 0" }}>Generando…</p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ca-btn ca-btn-secundario" style={{ flex: 1, minWidth: 120 }} onClick={copiarLink}>
            {copiado ? "✓ Copiado" : "Copiar link"}
          </button>
          <button className="ca-btn ca-btn-secundario" style={{ flex: 1, minWidth: 120 }} onClick={descargar} disabled={!dataUrl}>
            Descargar
          </button>
          <button className="ca-btn" style={{ flex: 1, minWidth: 120 }} onClick={imprimir} disabled={!dataUrl}>
            Imprimir
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#5b6b6e", textAlign: "center", marginTop: 12, wordBreak: "break-all" }}>
          {link}
        </p>
      </div>
    </div>
  );
}

// Dibuja el nombre del formulario sobre el centro del QR, dentro de una caja
// blanca. La caja ocupa cerca de un cuarto del lado: lo suficiente para que
// se lea y poco para que la corrección de errores siga reponiendo los
// módulos tapados.
function dibujarNombre(qrDataUrl, titulo) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const lienzo = document.createElement("canvas");
      lienzo.width = LADO;
      lienzo.height = LADO;
      const ctx = lienzo.getContext("2d");
      ctx.drawImage(img, 0, 0, LADO, LADO);

      const texto = (titulo || "").trim();
      if (!texto) return resolve(lienzo.toDataURL("image/png"));

      // Se parte el título en hasta tres líneas que quepan en la caja.
      const anchoCaja = LADO * 0.3;
      let tam = 34;
      let lineas = [];
      for (; tam >= 20; tam -= 2) {
        ctx.font = `700 ${tam}px "Segoe UI", system-ui, Arial, sans-serif`;
        lineas = repartir(ctx, texto, anchoCaja - 26, 3);
        const cabe = lineas.every((l) => ctx.measureText(l).width <= anchoCaja - 26);
        if (cabe) break;
      }

      const altoLinea = tam * 1.22;
      const altoCaja = altoLinea * lineas.length + 26;
      const x = (LADO - anchoCaja) / 2;
      const y = (LADO - altoCaja) / 2;

      // Caja blanca con borde, para que el texto no se confunda con el código.
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = AZUL;
      ctx.lineWidth = 5;
      redondeado(ctx, x, y, anchoCaja, altoCaja, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = AZUL;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${tam}px "Segoe UI", system-ui, Arial, sans-serif`;
      lineas.forEach((linea, i) => {
        const cy = y + 13 + altoLinea * (i + 0.5);
        ctx.fillText(linea, LADO / 2, cy);
      });

      resolve(lienzo.toDataURL("image/png"));
    };
    img.onerror = () => resolve(qrDataUrl);
    img.src = qrDataUrl;
  });
}

// Reparte el texto en líneas que quepan en `ancho`, con un máximo. Si sobra
// texto, la última línea termina en puntos suspensivos.
function repartir(ctx, texto, ancho, maxLineas) {
  const palabras = texto.split(/\s+/);
  const lineas = [];
  let actual = "";

  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho || !actual) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) break;
    }
  }
  if (lineas.length < maxLineas && actual) lineas.push(actual);

  if (lineas.length === maxLineas) {
    const usado = lineas.join(" ").length;
    if (usado < texto.length) {
      let ultima = lineas[maxLineas - 1];
      while (ultima && ctx.measureText(`${ultima}…`).width > ancho) {
        ultima = ultima.slice(0, -1);
      }
      lineas[maxLineas - 1] = `${ultima}…`;
    }
  }
  return lineas;
}

function redondeado(ctx, x, y, ancho, alto, radio) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}

const estilos = {
  fondo: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: "#fff",
    borderRadius: 18,
    padding: "24px 24px 20px",
    maxWidth: 400, width: "100%",
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
    maxHeight: "92vh",
    overflowY: "auto",
  },
};
