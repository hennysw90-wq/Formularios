import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { linkRespuesta } from "./formularios.js";

export default function QRFormulario({ formulario, onCerrar }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const link = linkRespuesta(formulario.id);

  useEffect(() => {
    QRCode.toDataURL(link, {
      width: 480,
      margin: 1,
      color: { dark: "#0e7d75", light: "#ffffff" },
    }).then(setDataUrl);
  }, [link]);

  function copiarLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  function imprimir() {
    const ventana = window.open("", "_blank");
    ventana.document.write(`
      <html><head><title>${formulario.titulo}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px;">
        <h2>${formulario.titulo}</h2>
        ${formulario.descripcion ? `<p style="color:#555;">${formulario.descripcion}</p>` : ""}
        <p>Escanea el QR para responder este formulario</p>
        <img src="${dataUrl}" style="width:340px;height:340px;" />
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
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#0e7d75", textTransform: "uppercase", letterSpacing: 1 }}>
              QR del formulario
            </p>
            <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 17, color: "#1f2a2e" }}>
              {formulario.titulo}
            </p>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#5b6b6e" }}>✕</button>
        </div>

        {dataUrl && (
          <img src={dataUrl} alt="QR" style={{ width: "100%", maxWidth: 280, display: "block", margin: "0 auto 16px", borderRadius: 12 }} />
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="ca-btn ca-btn-secundario" style={{ flex: 1 }} onClick={copiarLink}>
            {copiado ? "✓ Copiado" : "Copiar link"}
          </button>
          <button className="ca-btn" style={{ flex: 1 }} onClick={imprimir}>
            Imprimir QR
          </button>
        </div>

        <p style={{ fontSize: 12, color: "#5b6b6e", textAlign: "center", marginTop: 12, wordBreak: "break-all" }}>
          {link}
        </p>
      </div>
    </div>
  );
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
    maxWidth: 380, width: "100%",
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
  },
};
