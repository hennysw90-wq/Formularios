// Resumen de las respuestas escritas, calculado en el navegador: no usa
// ningún servicio de IA. Busca qué se repite — palabras y frases de dos o
// tres palabras — y lo ordena por cuántas veces aparece y en cuántas
// respuestas distintas. Sirve para responder "qué se está diciendo una y
// otra vez" sin tener que leerlo todo.

// Palabras que no aportan tema. Se sacan antes de contar.
const VACIAS = new Set(`
a al algo algun alguna algunas alguno algunos ante antes aqui aquel aquella
aquello asi aun aunque cada casi como con contra cual cuales cuando cuanto
de del demas desde donde dos durante e el ella ellas ello ellos en entre era
eran eres es esa esas ese eso esos esta estaba estan estar estas este esto
estos fue fueron ha haber habia hace hacen hacer hacia han hasta hay la las
le les lo los mas me mi mientras mucha muchas mucho muchos muy nada ni no
nos nosotros o otra otras otro otros para pero poco por porque pude puede
pueden q que quien quienes se sea segun ser si sido sin sobre solo son su
sus tal tambien tan tanto te tiene tienen toda todas todo todos tras tu un
una uno unos ya yo del lo les nuestro nuestra nuestros nuestras vez veces
ademas sigue siguen debe deben falta faltan
`.trim().split(/\s+/));

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabrasDe(texto) {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length > 2 && !VACIAS.has(p));
}

// Cuenta una frase: cuántas veces aparece en total y en cuántas respuestas
// distintas. Lo segundo importa más: algo dicho por cinco personas pesa más
// que algo repetido cinco veces por una sola.
function sumar(mapa, clave, indiceRespuesta, muestra) {
  if (!mapa.has(clave)) {
    mapa.set(clave, { frase: clave, veces: 0, respuestas: new Set(), muestra });
  }
  const e = mapa.get(clave);
  e.veces++;
  e.respuestas.add(indiceRespuesta);
}

// entradas: [{ texto, reunionNombre, nombreUsuario, fecha }]
export function temasRecurrentes(entradas, { max = 6 } = {}) {
  const mapa = new Map();

  entradas.forEach((e, i) => {
    const palabras = palabrasDe(e.texto);
    const vistasEnEsta = new Set();

    // Frases de 3, de 2 y palabras sueltas.
    for (let n = 3; n >= 1; n--) {
      for (let j = 0; j + n <= palabras.length; j++) {
        const frase = palabras.slice(j, j + n).join(" ");
        if (vistasEnEsta.has(frase)) continue;
        vistasEnEsta.add(frase);
        sumar(mapa, frase, i, e.texto);
      }
    }
  });

  const candidatos = [...mapa.values()]
    .map((x) => ({ ...x, enRespuestas: x.respuestas.size, palabras: x.frase.split(" ").length }))
    // Un tema tiene que aparecer en al menos dos respuestas distintas.
    .filter((x) => x.enRespuestas >= 2)
    .sort(
      (a, b) =>
        b.enRespuestas - a.enRespuestas ||
        b.palabras - a.palabras ||
        b.veces - a.veces
    );

  // Si una frase larga ya quedó, se descartan sus trozos para no repetir
  // "compromisos previos" debajo de "revisar compromisos previos".
  const elegidos = [];
  for (const c of candidatos) {
    const contenida = elegidos.some(
      (e) => e.frase.includes(c.frase) || c.frase.includes(e.frase)
    );
    if (!contenida) elegidos.push(c);
    if (elegidos.length >= max) break;
  }
  return elegidos;
}

// Agrupa las entradas por reunión, de la que más respuestas tiene a la que
// menos.
export function porReunion(entradas) {
  const mapa = new Map();
  for (const e of entradas) {
    const clave = e.reunionNombre || "Sin reunión";
    if (!mapa.has(clave)) mapa.set(clave, { reunion: clave, entradas: [] });
    mapa.get(clave).entradas.push(e);
  }
  return [...mapa.values()]
    .map((g) => ({
      ...g,
      entradas: g.entradas.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")),
      temas: temasRecurrentes(g.entradas, { max: 4 }),
    }))
    .sort((a, b) => b.entradas.length - a.entradas.length);
}

// Junta, para cada pregunta de texto largo del formulario, todo lo escrito
// en las respuestas recibidas.
export function textosPorPregunta(formulario, respuestas) {
  const preguntas = (formulario?.preguntas || []).filter(
    (p) => p.tipo === "parrafo" || p.tipo === "texto"
  );

  return preguntas
    .map((p) => {
      const entradas = [];
      for (const r of respuestas) {
        const v = r.respuestas?.[p.id];
        if (typeof v !== "string" || !v.trim()) continue;
        entradas.push({
          texto: v.trim(),
          reunionNombre: r.reunionNombre || "",
          nombreUsuario: r.nombreUsuario || "",
          destinatario: r.destinatario?.nombre || "",
          fecha: r.fecha || "",
        });
      }
      return {
        pregunta: p,
        entradas,
        temas: temasRecurrentes(entradas),
        grupos: porReunion(entradas),
      };
    })
    .filter((x) => x.entradas.length > 0);
}
