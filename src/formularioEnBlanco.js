// Formulario en blanco, tipo reporte: una hoja imprimible (o "Guardar como PDF") con todo lo que pide el
// formulario —datos generales, notas de terreno, criterios con su rúbrica, feedback y compromiso— para llenarlo a
// mano o revisarlo antes de una sesión. No guarda nada: solo abre la vista de impresión.
import { normalizarFormulario } from "./calculo.js";
import { etiquetaCampo, siglaDe } from "./referencia.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const linea = (n = 1) => Array.from({ length: n }, () => '<div class="ln"></div>').join("");

function campoA(c, form) {
  const nombre = esc(etiquetaCampo(c, form) || c.etiqueta || "Dato");
  const req = c.obligatorio ? ' <span class="req">*</span>' : "";
  if (c.tipo === "seleccion" && (c.opciones || []).length && (c.opciones || []).length <= 8) {
    return `<div class="dato ancho"><span class="et">${nombre}${req}</span><span class="ops">${c.opciones.map((o) => `<span class="op">☐ ${esc(o)}</span>`).join("")}</span></div>`;
  }
  const corto = ["fecha", "hora", "numero"].includes(c.tipo);
  const pista = c.tipo === "fecha" ? "___ / ___ / ______" : c.tipo === "hora" ? "___ : ___" : "";
  return `<div class="dato${corto ? "" : " ancho"}"><span class="et">${nombre}${req}</span><span class="raya">${pista}</span></div>`;
}

export function htmlFormularioEnBlanco(entrada) {
  const form = normalizarFormulario(entrada);
  const sigla = siglaDe(form) === "evaluación" ? "Evaluación" : siglaDe(form);
  const receptor = String(form.receptor || "").trim() || "líder";
  const p = form.parametros || {};
  const fb = form.feedback || {};
  const n = Math.max(1, Number(fb.maxPorTipo) || 2);
  const hoy = new Date().toLocaleDateString("es-CL");

  const seccionA = (form.seccionA || []).map((c) => campoA(c, form)).join("") || `<div class="dato ancho"><span class="et">Fecha</span><span class="raya"></span></div>`;

  const puntos = (form.seccionB?.puntos || []);
  const seccionB = `
    ${puntos.length ? `<p class="sub">Puntos a observar</p><ul class="puntos">${puntos.map((x) => `<li>☐ ${esc(x.texto)}${x.criterio ? ` <span class="gris">(${esc(x.criterio)})</span>` : ""}</li>`).join("")}</ul>` : ""}
    <p class="sub">Notas${form.seccionB?.horaAutomatica ? " (anota la hora de cada una)" : ""}</p>
    <div class="caja notas">${linea(9)}</div>`;

  const bloques = (form.bloques || []).map((b) => `
    <div class="bloque">
      <div class="bloque-tit"><span>${esc(b.nombre)}</span><span class="peso">${esc(b.peso)}% del total</span></div>
      <table class="crit">
        <thead><tr><th class="c-cod">Criterio</th><th>2 · Cumple</th><th>1 · Parcial</th><th>0 · No cumple</th></tr></thead>
        <tbody>
          ${(b.criterios || []).map((c) => `
            <tr class="fila-crit">
              <td class="c-cod"><b>${esc(c.codigo)}</b> ${esc(c.nombre)}${c.critico ? ' <span class="critico">CRÍTICO</span>' : ""}<div class="peso-c">${esc(c.peso)}% del bloque</div>${c.verificar ? `<div class="verif">Verificar: ${esc(c.verificar)}</div>` : ""}</td>
              <td><span class="chk">☐</span> ${esc(c.nivel2) || "&nbsp;"}</td>
              <td><span class="chk">☐</span> ${esc(c.nivel1) || "&nbsp;"}</td>
              <td><span class="chk">☐</span> ${esc(c.nivel0) || "&nbsp;"}</td>
            </tr>
            <tr class="fila-nota"><td colspan="4"><span class="gris">Evidencia / comentario${c.admiteNA ? " &nbsp;·&nbsp; ☐ N/A (no aplica)" : ""}:</span>${linea(1)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`).join("");

  const items = (titulo) => `
    <p class="sub">${titulo} (hasta ${n})</p>
    ${Array.from({ length: n }, (_, i) => `
      <div class="fb">
        <div class="fb-n">${i + 1}</div>
        <div class="fb-c">
          <div class="dato ancho"><span class="et">Criterio</span><span class="raya"></span></div>
          ${fb.situacion ? `<div class="dato ancho"><span class="et">Situación</span><span class="raya"></span></div>` : ""}
          <div class="dato ancho"><span class="et">Comportamiento observado</span><span class="raya"></span></div>
          <div class="dato ancho"><span class="et">Impacto</span><span class="raya"></span></div>
        </div>
      </div>`).join("")}`;

  const seccionD = `
    ${fb.seguimientoAnterior ? `<p class="sub">Seguimiento del compromiso anterior</p><div class="ops">${["☐ Cumplido", "☐ Parcial", "☐ No cumplido", `☐ Es la primera ${esc(sigla)}`].map((x) => `<span class="op">${x}</span>`).join("")}</div><div class="dato ancho"><span class="et">Comentario</span><span class="raya"></span></div>` : ""}
    ${fb.fortalezas ? items("Fortalezas") : ""}
    ${fb.oportunidades ? items("Oportunidades de mejora") : ""}
    ${fb.compromisoMejora ? `
      <p class="sub">Compromiso de mejora acordado con el ${esc(receptor)}</p>
      <div class="dato ancho"><span class="et">Acción</span><span class="raya"></span></div>
      ${linea(1)}
      <div class="fila2"><div class="dato"><span class="et">Responsable</span><span class="raya"></span></div><div class="dato"><span class="et">Plazo</span><span class="raya">___ / ___ / ______</span></div></div>` : ""}
    <p class="conoc">☐ El ${esc(receptor)} tomó conocimiento del feedback entregado &nbsp;&nbsp; Firma: ______________________</p>`;

  const totalCrit = (form.bloques || []).reduce((s, b) => s + (b.criterios || []).length, 0);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(form.nombre)} · formulario en blanco</title>
<style>
  @page { size: A4; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #2c2c2a; font-size: 10.5px; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .barra { display: flex; gap: 8px; justify-content: flex-end; padding: 10px 12px; background: #f1efe8; position: sticky; top: 0; }
  .barra button { font: inherit; font-size: 13px; font-weight: 700; padding: 7px 14px; border-radius: 8px; border: 1px solid #0f6e56; background: #0f6e56; color: #fff; cursor: pointer; }
  .barra button.sec { background: #fff; color: #0f6e56; }
  @media print { .barra { display: none; } }
  .hoja { max-width: 190mm; margin: 0 auto; padding: 6mm 0; }
  .cab { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 3px solid #0f6e56; padding-bottom: 6px; }
  .cab h1 { font-size: 18px; margin: 2px 0 0; color: #0f6e56; }
  .eyebrow { font-size: 9.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #b0420e; }
  .desc { font-size: 10px; color: #5f5e5a; margin: 4px 0 0; max-width: 130mm; }
  .meta { text-align: right; font-size: 9.5px; color: #5f5e5a; white-space: nowrap; }
  .rangos { display: flex; gap: 6px; margin: 8px 0 2px; flex-wrap: wrap; }
  .rango { border-radius: 99px; padding: 2px 9px; font-weight: 700; font-size: 9.5px; }
  h2 { font-size: 12px; margin: 12px 0 6px; padding: 4px 8px; background: #e1f5ee; color: #0f6e56; border-radius: 6px; break-after: avoid; }
  .sub { font-weight: 700; margin: 8px 0 4px; font-size: 10.5px; }
  .gris { color: #888780; }
  .req { color: #a32d2d; }
  .datos { display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .dato { display: flex; align-items: flex-end; gap: 6px; flex: 1 1 45%; min-width: 60mm; margin: 3px 0; }
  .dato.ancho { flex-basis: 100%; }
  .et { font-weight: 700; white-space: nowrap; }
  .raya { flex: 1; border-bottom: 1px solid #888780; min-height: 15px; color: #b4b2a9; font-size: 9.5px; text-align: center; }
  .ops { display: flex; flex-wrap: wrap; gap: 4px 12px; flex: 1; }
  .op { white-space: nowrap; }
  .ln { border-bottom: 1px solid #b4b2a9; height: 17px; }
  .caja { border: 1px solid #d3d1c7; border-radius: 6px; padding: 2px 8px 8px; }
  .puntos { margin: 0 0 4px; padding-left: 4px; list-style: none; columns: 2; column-gap: 14px; }
  .puntos li { margin: 2px 0; break-inside: avoid; }
  .bloque { margin: 6px 0 10px; break-inside: auto; }
  .bloque-tit { display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; border-bottom: 1.5px solid #2c2c2a; padding-bottom: 2px; margin-bottom: 3px; break-after: avoid; }
  .peso { font-weight: 400; color: #5f5e5a; }
  table.crit { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.crit th { font-size: 9px; text-align: left; background: #f1efe8; padding: 3px 5px; border: 1px solid #d3d1c7; }
  table.crit th.c-cod, td.c-cod { width: 27%; }
  table.crit td { vertical-align: top; padding: 4px 5px; border: 1px solid #d3d1c7; font-size: 9.2px; line-height: 1.3; }
  tr.fila-crit, tr.fila-nota { break-inside: avoid; }
  tr.fila-nota td { border-top: none; padding-top: 1px; }
  .chk { font-size: 11px; }
  .critico { background: #fcebeb; color: #a32d2d; font-weight: 800; font-size: 8px; padding: 0 4px; border-radius: 4px; }
  .peso-c { color: #888780; font-size: 8.5px; margin-top: 2px; }
  .verif { color: #5f5e5a; font-style: italic; margin-top: 2px; }
  .fb { display: flex; gap: 8px; border: 1px solid #d3d1c7; border-radius: 6px; padding: 4px 8px; margin: 4px 0; break-inside: avoid; }
  .fb-n { font-weight: 800; color: #0f6e56; font-size: 13px; }
  .fb-c { flex: 1; }
  .fila2 { display: flex; gap: 14px; }
  .conoc { margin-top: 10px; font-weight: 700; }
  .resultado { display: flex; gap: 14px; flex-wrap: wrap; border: 1.5px solid #0f6e56; border-radius: 8px; padding: 8px 10px; margin-top: 10px; break-inside: avoid; }
  .resultado .dato { min-width: 40mm; flex: 1 1 30%; }
  .pie { margin-top: 12px; font-size: 8.5px; color: #888780; display: flex; justify-content: space-between; }
</style></head><body>
<div class="barra"><button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button><button class="sec" onclick="window.close()">Cerrar</button></div>
<div class="hoja">
  <div class="cab">
    <div>
      <div class="eyebrow">${esc(sigla)} · formulario en blanco</div>
      <h1>${esc(form.nombre)}</h1>
      ${form.descripcion ? `<p class="desc">${esc(form.descripcion)}</p>` : ""}
    </div>
    <div class="meta">${(form.bloques || []).length} bloques · ${totalCrit} criterios<br/>Versión ${esc(form.version || 1)} · impreso ${hoy}</div>
  </div>
  <div class="rangos">
    <span class="rango" style="background:#e1f5ee;color:#0f6e56">Efectiva ≥ ${esc(p.umbralEfectiva)}% y sin críticos en 0</span>
    <span class="rango" style="background:#faeeda;color:#854f0b">En desarrollo ≥ ${esc(p.umbralDesarrollo)}%</span>
    <span class="rango" style="background:#fcebeb;color:#a32d2d">Requiere intervención &lt; ${esc(p.umbralDesarrollo)}%</span>
  </div>

  <h2>A · Datos generales</h2>
  <div class="datos">
    ${seccionA}
    ${(form.seccionA || []).some((c) => c.tipo === "evaluador" || /evaluador/i.test(c.etiqueta || "")) ? "" : '<div class="dato"><span class="et">Evaluador</span><span class="raya"></span></div>'}
  </div>

  <h2>B · Notas de terreno</h2>
  ${seccionB}

  <h2>C · Evaluación por criterio <span class="gris" style="font-weight:400">(marca un nivel por criterio)</span></h2>
  ${bloques}

  <h2>D · Feedback</h2>
  ${seccionD}

  <div class="resultado">
    <div class="dato"><span class="et">Índice</span><span class="raya">______ %</span></div>
    <div class="dato ancho" style="flex-basis:60%"><span class="et">Resultado</span><span class="ops"><span class="op">☐ Efectiva</span><span class="op">☐ En desarrollo</span><span class="op">☐ Requiere intervención</span></span></div>
  </div>
  <div class="pie"><span>Cada criterio: 2 = 100%, 1 = 50%, 0 = 0% de su peso; N/A no cuenta y su peso se reparte en el bloque. El índice lo calcula la app al ingresar la ${esc(sigla)}.</span><span>Formularios</span></div>
</div>
</body></html>`;
}

/** Abre el formulario en blanco en una pestaña nueva, listo para imprimir o guardar como PDF. */
export function abrirFormularioEnBlanco(form) {
  const v = window.open("", "_blank");
  if (!v) {
    window.alert("El navegador bloqueó la ventana nueva. Permite las ventanas emergentes para este sitio.");
    return;
  }
  v.document.open();
  v.document.write(htmlFormularioEnBlanco(form));
  v.document.close();
  v.focus();
}
