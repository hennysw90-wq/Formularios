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

// Familias de palabras del dominio. Todo lo que cae en una familia se trata
// como el mismo concepto, aunque se escriba distinto: así "mejorar la
// participación" y "falta que participen" quedan juntas. Es lo más parecido
// a entender sinónimos que se puede hacer sin un modelo de lenguaje.
const FAMILIAS = {
  reunion: ["reunion", "rutina", "sesion", "junta", "instancia"],
  compromiso: ["compromiso", "acuerdo", "accion", "tarea", "comprometer"],
  participacion: ["participacion", "participante", "participar", "involucrar", "asistencia", "asistente", "presencia"],
  liderazgo: ["lider", "liderazgo", "moderacion", "moderar", "conduccion", "conducir", "facilitador"],
  indicador: ["kpi", "indicador", "tablero", "metrica", "meta", "objetivo"],
  seguridad: ["seguridad", "riesgo", "incidente", "peligro"],
  disciplina: ["disciplina", "puntualidad", "orden", "formalidad", "rigor"],
  desempeno: ["desempeno", "resultado", "rendimiento", "cumplimiento"],
  seguimiento: ["seguimiento", "control", "revision", "revisar", "monitoreo"],
  comunicacion: ["comunicacion", "comunicar", "informacion", "informar", "claridad"],
};

// Nombre legible de cada familia, para que el bullet quede siempre bien
// escrito en vez de depender de qué palabras usó quien respondió.
const NOMBRE_FAMILIA = {
  reunion: "Desarrollo de la reunión",
  compromiso: "Gestión de compromisos",
  participacion: "Participación de los asistentes",
  liderazgo: "Liderazgo y moderación",
  indicador: "KPIs e indicadores",
  seguridad: "Seguridad",
  disciplina: "Disciplina y puntualidad",
  desempeno: "Desempeño y resultados",
  seguimiento: "Seguimiento y control",
  comunicacion: "Comunicación y claridad",
};

// Índice raíz -> familia, armado una sola vez.
const DE_FAMILIA = new Map();
for (const [familia, palabras] of Object.entries(FAMILIAS)) {
  for (const palabra of palabras) DE_FAMILIA.set(raizSimple(palabra), familia);
}

// Reducción a raíz para el español. No es un lematizador completo: quita
// plurales y las terminaciones más comunes, y después recorta, que es lo
// que hace que "participacion", "participantes" y "participen" terminen en
// la misma raíz.
function raizSimple(palabra) {
  let p = palabra;
  // Plural, cuidando las formas en -ciones / -mientos / -dades.
  p = p
    .replace(/ciones$/, "cion")
    .replace(/siones$/, "sion")
    .replace(/mientos$/, "miento")
    .replace(/(dad|tad)es$/, "$1")
    .replace(/([^aeiou])es$/, "$1")
    .replace(/([aeiou])s$/, "$1");
  // Terminaciones derivativas y verbales más frecuentes.
  p = p.replace(
    /(acion|icion|amiento|imiento|ante|ente|ando|iendo|ado|ido|aron|aban|aba|amos|emos|imos|aran|eran|iran|ar|er|ir|an|en|on)$/,
    ""
  );
  // Se recorta para que las variantes de una misma familia coincidan.
  return p.length >= 4 ? p.slice(0, 6) : palabra.slice(0, 6);
}

// Concepto de una palabra: su familia si pertenece a una, si no su raíz.
function concepto(palabra) {
  const raiz = raizSimple(palabra);
  return DE_FAMILIA.get(raiz) || raiz;
}

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
      .map(concepto)
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

// Cuánto se solapan dos frases. Se mide contra la más corta de las dos y
// no contra la unión: así "Mala gestión de compromisos" se reconoce como la
// misma idea que "La gestión de compromisos es deficiente, hay personas que
// los desconocen", que al ser más larga diluiría el parecido.
function parecido(a, b) {
  const comunes = [...a].filter((t) => b.has(t)).length;
  if (comunes < 2) return 0; // una sola palabra en común no hace un tema
  const menor = Math.min(a.size, b.size);
  return menor === 0 ? 0 : comunes / menor;
}

// Coseno entre dos frases, tomando sus términos como vector binario.
function coseno(a, b) {
  const comunes = [...a].filter((t) => b.has(t)).length;
  if (comunes === 0) return 0;
  return comunes / (Math.sqrt(a.size) * Math.sqrt(b.size));
}

// PageRank sobre el grafo de frases. Devuelve un puntaje por frase.
function textRank(frases, { amortiguacion = 0.85, iteraciones = 40 } = {}) {
  const n = frases.length;
  if (n === 0) return [];
  if (n === 1) return [1];

  const sim = Array.from({ length: n }, () => new Float64Array(n));
  const salida = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = coseno(frases[i].terminos, frases[j].terminos);
      sim[i][j] = s;
      sim[j][i] = s;
      salida[i] += s;
      salida[j] += s;
    }
  }

  let r = new Float64Array(n).fill(1 / n);
  for (let paso = 0; paso < iteraciones; paso++) {
    const nuevo = new Float64Array(n).fill((1 - amortiguacion) / n);
    for (let j = 0; j < n; j++) {
      if (salida[j] === 0) continue;
      for (let i = 0; i < n; i++) {
        if (i === j || sim[j][i] === 0) continue;
        nuevo[i] += amortiguacion * r[j] * (sim[j][i] / salida[j]);
      }
    }
    r = nuevo;
  }
  const max = Math.max(...r) || 1;
  return [...r].map((x) => x / max);
}

// Busca dentro de una frase el trozo que mejor nombra su tema: una
// secuencia corta que empiece y termine en palabras con contenido, con los
// conectores naturales en medio ("gestion DE compromisos"). Se queda con la
// ventana de mayor peso según cuánto aparecen sus términos en el conjunto.
// Terminaciones verbales frecuentes: un tema que termina en verbo
// ("participantes entienden") se lee cortado, así que se penaliza.
const FIN_VERBAL = /(ar|er|ir|an|en|on|ando|iendo|aba|aron|aban|amos|emos|imos)$/;

function temaDe(fraseOriginal, peso, vetadas = new Set()) {
  const crudas = fraseOriginal.split(/\s+/).filter(Boolean);
  const limpias = crudas.map((p) =>
    normalizar(p).replace(/[^a-z0-9ñ]/g, "")
  );
  // No sirven como tema las palabras vacías ni las que vienen del propio
  // enunciado de la pregunta: decir "Fortaleza buena: se destaca como
  // fortaleza" no aporta nada.
  // Se compara por raíz para que "fortaleza" quede vetada por "Fortalezas"
  // y no vuelva a aparecer como tema de su propia pregunta.
  const vetada = (palabra) => {
    if (vetadas.has(palabra)) return true;
    const raiz = palabra.slice(0, 6);
    for (const v of vetadas) {
      if (v.length >= 5 && raiz.length >= 5 && v.slice(0, 6) === raiz) return true;
    }
    return false;
  };
  const esContenido = (i) =>
    limpias[i].length > 2 && !VACIAS.has(limpias[i]) && !vetada(limpias[i]);

  let mejor = null;
  for (let largo = 2; largo <= 5; largo++) {
    for (let i = 0; i + largo <= crudas.length; i++) {
      const fin = i + largo - 1;
      if (!esContenido(i) || !esContenido(fin)) continue;
      let suma = 0;
      let cuantas = 0;
      for (let j = i; j <= fin; j++) {
        if (!esContenido(j)) continue;
        suma += peso.get(concepto(limpias[j])) || 0;
        cuantas++;
      }
      if (cuantas < 2) continue;
      // Se premia el peso, se castiga arrastrar relleno, y se penaliza
      // cerrar en un verbo, que deja el tema a medio decir.
      let valor = (suma / cuantas) * (cuantas / largo);
      if (FIN_VERBAL.test(limpias[fin])) valor *= 0.45;
      // Un conector interno ("gestión DE compromisos") suele indicar que el
      // tramo es una expresión completa.
      if (largo >= 3 && !esContenido(i + 1)) valor *= 1.25;
      if (!mejor || valor > mejor.valor) {
        mejor = { valor, texto: crudas.slice(i, fin + 1).join(" ") };
      }
    }
  }
  if (!mejor) return null;
  return mejor.texto.replace(/[,.;:]+$/, "");
}

// Tono de la pregunta, para redactar el mensaje: lo que se pregunta por
// fortalezas se afirma como fortaleza, y lo que se pregunta por brechas se
// afirma como oportunidad.
export function tonoDePregunta(textoPregunta) {
  const t = normalizar(textoPregunta || "");
  if (/(fortaleza|positiv|destaca|buena|logro|bien)/.test(t)) return "fortaleza";
  if (/(mejora|oportunidad|brecha|debilidad|problema|falencia|dificultad)/.test(t))
    return "mejora";
  return "neutro";
}

// Arma la frase que se muestra como bullet. Es texto generado, no copiado:
// nombra el tema y dice cuánto respaldo tiene.
export function redactarIdea({ tema, tono, enRespuestas, totalRespuestas, menciones }) {
  const sujeto = primeraMayuscula(tema);
  const respaldo =
    enRespuestas > 1
      ? `en ${enRespuestas} de ${totalRespuestas} evaluaciones`
      : menciones > 1
      ? `${menciones} veces en una evaluación`
      : "en una evaluación";

  if (tono === "fortaleza") return `${sujeto}: se destaca como fortaleza ${respaldo}.`;
  if (tono === "mejora") return `${sujeto}: aparece como oportunidad de mejora ${respaldo}.`;
  return `${sujeto}: se menciona ${respaldo}.`;
}

// Familia temática que domina un grupo de frases: la que más peso suma
// entre los términos de sus miembros.
function familiaDominante(grupo, peso) {
  const puntajes = new Map();
  for (const m of grupo.miembros) {
    for (const t of m.terminos) {
      if (!NOMBRE_FAMILIA[t]) continue;
      puntajes.set(t, (puntajes.get(t) || 0) + (peso.get(t) || 1));
    }
  }
  if (puntajes.size === 0) return null;
  return [...puntajes.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function primeraMayuscula(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// entradas: [{ texto, reunionNombre, nombreUsuario, fecha }]
// Devuelve ideas: la frase representativa, en cuántas respuestas aparece
// algo equivalente, y las variantes de otras personas.
export function ideasPrincipales(
  entradas,
  { max = 6, minRespuestas = 1, tono = "neutro", textoPregunta = "" } = {}
) {
  // Las palabras del enunciado no pueden ser el tema de su propia respuesta.
  const vetadas = new Set(
    normalizar(textoPregunta)
      .replace(/[^a-z0-9ñ\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
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

  // 3. TextRank: se arma un grafo donde cada frase es un nodo y el peso de
  //    la arista es cuánto se parecen. Después se corre PageRank sobre ese
  //    grafo. Una frase es central si se parece a muchas otras que a su vez
  //    son centrales — es decir, si dice lo que el conjunto está diciendo.
  //    Es el mismo principio con el que Google ordenaba páginas, aplicado a
  //    oraciones, y da resultados bastante mejores que contar palabras.
  const rank = textRank(frases);

  //    El rank se corrige por dos cosas: cuánta información trae la frase
  //    (una nota telegráfica de dos palabras no resume nada) y cuánto pesan
  //    sus términos dentro del conjunto.
  frases.forEach((f, i) => {
    const suma = [...f.terminos].reduce((s, t) => s + peso.get(t), 0);
    const densidad = suma / Math.sqrt(f.terminos.size);
    // Satura alrededor de las 6 palabras con contenido: más allá no suma.
    const informacion = Math.min(f.terminos.size, 6) / 6;
    f.puntaje = rank[i] * (0.45 + 0.55 * informacion) * (0.5 + 0.5 * densidad / (1 + densidad));
  });
  frases.sort((a, b) => b.puntaje - a.puntaje);

  // 4. Agrupar las que dicen lo mismo; la de mayor puntaje representa.
  let grupos = [];
  for (const f of frases) {
    // Se compara contra la frase que representa al grupo, no contra la
    // bolsa acumulada de términos, que se va ensuciando a medida que el
    // grupo crece y terminaría tragándose frases de otros temas.
    const grupo = grupos.find((g) => parecido(g.representante.terminos, f.terminos) >= 0.5);
    if (grupo) {
      grupo.miembros.push(f);
      grupo.respuestas.add(f.respuesta);
    } else {
      grupos.push({
        representante: f,
        miembros: [f],
        respuestas: new Set([f.respuesta]),
      });
    }
  }

  // 5. Los grupos que hablan de la misma familia temática se unen: da lo
  //    mismo que uno diga "compromisos" y otro "acuerdos", es un solo tema.
  //    Las familias del dominio están arriba, con su nombre ya redactado.
  const porFamilia = new Map();
  const sueltos = [];
  for (const g of grupos) {
    const familia = familiaDominante(g, peso);
    if (!familia) {
      sueltos.push(g);
      continue;
    }
    if (!porFamilia.has(familia)) {
      porFamilia.set(familia, { ...g, familia });
    } else {
      const base = porFamilia.get(familia);
      base.miembros = base.miembros.concat(g.miembros);
      g.respuestas.forEach((r) => base.respuestas.add(r));
      if (g.representante.puntaje > base.representante.puntaje) {
        base.representante = g.representante;
      }
    }
  }
  grupos = [...porFamilia.values(), ...sueltos];

  // 6. Selección con diversidad (MMR): se elige primero el grupo más fuerte
  //    y, para los siguientes, se penaliza parecerse a lo ya elegido. Así
  //    los bullets cubren temas distintos en vez de repetir el mismo con
  //    otras palabras.
  const porFuerza = grupos
    .map((g) => ({
      g,
      fuerza: g.respuestas.size * 2 + g.miembros.length + g.representante.puntaje,
    }))
    .sort((a, b) => b.fuerza - a.fuerza);

  const elegidos = [];
  while (elegidos.length < max && porFuerza.length > 0) {
    let mejorIdx = 0;
    let mejorValor = -Infinity;
    porFuerza.forEach((c, i) => {
      const redundancia = elegidos.length
        ? Math.max(...elegidos.map((e) => coseno(e.representante.terminos, c.g.representante.terminos)))
        : 0;
      const valor = c.fuerza * (1 - 0.6 * redundancia);
      if (valor > mejorValor) {
        mejorValor = valor;
        mejorIdx = i;
      }
    });
    elegidos.push(porFuerza.splice(mejorIdx, 1)[0].g);
  }

  return elegidos
    .map((g) => {
      // Si el grupo cae en una familia conocida, el tema es su nombre ya
      // redactado; si no, se extrae del texto como antes.
      const tema = g.familia
        ? NOMBRE_FAMILIA[g.familia]
        : temaDe(g.representante.texto, peso, vetadas);
      return {
      tema,
      tono,
      // Mensaje redactado a partir del tema; si no se pudo aislar un tema
      // limpio, se cae a la frase textual para no inventar.
      frase: tema
        ? redactarIdea({
            tema,
            tono,
            enRespuestas: g.respuestas.size,
            totalRespuestas: entradas.length,
            menciones: g.miembros.length,
          })
        : primeraMayuscula(g.representante.texto),
      textual: primeraMayuscula(g.representante.texto),
      autor: g.representante.autor,
      enRespuestas: g.respuestas.size,
      menciones: g.miembros.length,
      variantes: g.miembros
        .filter((m) => m !== g.representante)
        .map((m) => ({ texto: primeraMayuscula(m.texto), autor: m.autor, reunion: m.reunion })),
      };
    })
    .filter((g) => g.enRespuestas >= minRespuestas)
    .sort((a, b) => b.enRespuestas - a.enRespuestas || b.variantes.length - a.variantes.length);
}

export function porReunion(entradas, tono = "neutro", textoPregunta = "") {
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
      ideas: ideasPrincipales(g.entradas, { max: 4, tono, textoPregunta }),
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
        ideas: ideasPrincipales(entradas, { tono: tonoDePregunta(p.texto), textoPregunta: p.texto }),
        grupos: porReunion(entradas, tonoDePregunta(p.texto), p.texto),
      };
    })
    .filter((x) => x.entradas.length > 0);
}
