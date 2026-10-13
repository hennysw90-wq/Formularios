// Resumen de las respuestas escritas, calculado en el navegador y sin
// ningún servicio de IA. En vez de contar palabras sueltas, parte los
// textos en frases, agrupa las que hablan de lo mismo y muestra la frase
// que mejor representa cada grupo, tal como la escribió una persona. Así
// los bullets se leen como ideas y no como fragmentos.

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
una uno unos ya yo vez veces ademas sigue siguen debe deben
`.trim().split(/\s+/));

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Términos con contenido de una frase, sin repetir.
function terminos(frase) {
  return new Set(
    normalizar(frase)
      .replace(/[^a-z0-9ñ\s]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 3 && !VACIAS.has(p))
  );
}

// Parte un texto en frases. Corta en punto, punto y coma, salto de línea y
// viñetas, que es como suele escribir la gente en estos formularios.
function enFrases(texto) {
  return (texto || "")
    .split(/(?:[.;!?]+|\n+|\s-\s|•)/)
    .map((f) => f.trim().replace(/\s+/g, " "))
    .filter((f) => f.split(" ").length >= 3);
}

function parecido(a, b) {
  const comunes = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : comunes / union;
}

function primeraMayuscula(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// entradas: [{ texto, reunionNombre, nombreUsuario, fecha }]
// Devuelve ideas: la frase representativa, en cuántas respuestas aparece
// algo equivalente, y las variantes de otras personas.
export function ideasPrincipales(entradas, { max = 6, minRespuestas = 1 } = {}) {
  // 1. Todas las frases, sabiendo de qué respuesta viene cada una.
  const frases = [];
  entradas.forEach((e, i) => {
    for (const f of enFrases(e.texto)) {
      const t = terminos(f);
      if (t.size === 0) continue;
      frases.push({ texto: f, terminos: t, respuesta: i, autor: e.nombreUsuario, reunion: e.reunionNombre });
    }
  });
  if (frases.length === 0) return [];

  // 2. Peso de cada término: cuántas respuestas distintas lo mencionan. Un
  //    término que aparece en varias respuestas marca un tema compartido.
  const peso = new Map();
  for (const t of new Set(frases.flatMap((f) => [...f.terminos]))) {
    const enRespuestas = new Set(
      frases.filter((f) => f.terminos.has(t)).map((f) => f.respuesta)
    ).size;
    peso.set(t, enRespuestas);
  }

  // 3. Puntaje de cada frase: lo que pesan sus términos, moderado por el
  //    largo para que una frase kilométrica no gane solo por extensa.
  for (const f of frases) {
    const suma = [...f.terminos].reduce((s, t) => s + peso.get(t), 0);
    f.puntaje = suma / Math.sqrt(f.terminos.size);
  }
  frases.sort((a, b) => b.puntaje - a.puntaje);

  // 4. Agrupar las que dicen lo mismo; la de mayor puntaje representa.
  const grupos = [];
  for (const f of frases) {
    const grupo = grupos.find((g) => parecido(g.terminos, f.terminos) >= 0.34);
    if (grupo) {
      grupo.miembros.push(f);
      grupo.respuestas.add(f.respuesta);
      f.terminos.forEach((t) => grupo.terminos.add(t));
    } else {
      grupos.push({
        representante: f,
        miembros: [f],
        respuestas: new Set([f.respuesta]),
        terminos: new Set(f.terminos),
      });
    }
  }

  return grupos
    .map((g) => ({
      frase: primeraMayuscula(g.representante.texto),
      autor: g.representante.autor,
      enRespuestas: g.respuestas.size,
      variantes: g.miembros
        .filter((m) => m !== g.representante)
        .map((m) => ({ texto: primeraMayuscula(m.texto), autor: m.autor, reunion: m.reunion })),
    }))
    .filter((g) => g.enRespuestas >= minRespuestas)
    .sort((a, b) => b.enRespuestas - a.enRespuestas || b.variantes.length - a.variantes.length)
    .slice(0, max);
}

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
      ideas: ideasPrincipales(g.entradas, { max: 4 }),
    }))
    .sort((a, b) => b.entradas.length - a.entradas.length);
}

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
        ideas: ideasPrincipales(entradas),
        grupos: porReunion(entradas),
      };
    })
    .filter((x) => x.entradas.length > 0);
}
