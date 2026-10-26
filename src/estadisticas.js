// Filtros, orden y cálculos de las estadísticas de CdR. Todo son funciones puras (sin Firebase).

export const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const redondear = (x) => Math.round(x * 10) / 10;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const aISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deISO = (iso) => new Date(`${iso}T12:00:00`);
export const hoyISO = () => aISO(new Date());
const sumarDias = (iso, n) => {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
};
export const diasEntre = (desdeIso, hastaIso) => Math.round((deISO(hastaIso) - deISO(desdeIso)) / 86400000);

/** Fecha en que ocurrió la CdR: el dato "Fecha" del formulario; si no hay, el día de envío. */
export function fechaCdR(e) {
  const campo = (e.formulario?.seccionA || []).find((c) => c.tipo === "fecha" && !/anterior/i.test(c.etiqueta));
  const v = campo ? e.datos?.[campo.id] : "";
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return (e.fechaEnvio || "").slice(0, 10);
}

export const claveRutina = (e) => e.rutinaSesionId || norm(e.rutinaNombre);

export const FILTROS_VACIOS = { desde: "", hasta: "", formularioId: "", rutina: "", lider: "", evaluador: "", clasificacion: "", soloCriticos: false, texto: "", verAnuladas: false };

/** Atajos de fecha: devuelve { desde, hasta } (vacío = sin límite). */
export function rangoPreset(nombre, hoy = hoyISO()) {
  if (nombre === "7d") return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (nombre === "30d") return { desde: sumarDias(hoy, -29), hasta: hoy };
  if (nombre === "mes") return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
  if (nombre === "mesAnterior") {
    const primero = `${hoy.slice(0, 7)}-01`;
    const ultimo = sumarDias(primero, -1);
    return { desde: `${ultimo.slice(0, 7)}-01`, hasta: ultimo };
  }
  return { desde: "", hasta: "" };
}

export function filtrar(evals, f) {
  const q = norm(f.texto);
  return evals.filter((e) => {
    if (e.anulada && !f.verAnuladas) return false;
    const fecha = fechaCdR(e);
    if (f.desde && fecha < f.desde) return false;
    if (f.hasta && fecha > f.hasta) return false;
    if (f.formularioId && e.formularioId !== f.formularioId) return false;
    if (f.rutina && norm(e.rutinaNombre) !== norm(f.rutina)) return false;
    if (f.lider && norm(e.lider) !== norm(f.lider)) return false;
    if (f.evaluador && norm(e.evaluadorNombre) !== norm(f.evaluador)) return false;
    if (f.clasificacion && e.resultado?.clasificacion !== f.clasificacion) return false;
    if (f.soloCriticos && !(e.resultado?.criticosEnCero || []).length) return false;
    if (q && !norm(`${e.rutinaNombre} ${e.lider} ${e.evaluadorNombre} ${e.formulario?.nombre}`).includes(q)) return false;
    return true;
  });
}

const CAMPOS = {
  fecha: (e) => fechaCdR(e),
  indice: (e) => e.resultado?.indice ?? 0,
  rutina: (e) => norm(e.rutinaNombre),
  lider: (e) => norm(e.lider),
  evaluador: (e) => norm(e.evaluadorNombre),
  formulario: (e) => norm(e.formulario?.nombre),
};
export const CAMPOS_ORDEN = Object.keys(CAMPOS);

export function ordenar(lista, campo = "fecha", dir = "desc") {
  const get = CAMPOS[campo] || CAMPOS.fecha;
  const m = dir === "asc" ? 1 : -1;
  return [...lista].sort((a, b) => {
    const x = get(a);
    const y = get(b);
    const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "es");
    return c !== 0 ? c * m : (b.fechaEnvio || "").localeCompare(a.fechaEnvio || "");
  });
}

/** Valores únicos (para llenar las listas de filtros). */
export function opciones(evals) {
  const unicos = (fn) => {
    const mapa = new Map();
    evals.forEach((e) => {
      const v = (fn(e) || "").trim();
      if (v && !mapa.has(norm(v))) mapa.set(norm(v), v);
    });
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, "es"));
  };
  const formularios = new Map();
  evals.forEach((e) => e.formularioId && formularios.set(e.formularioId, e.formulario?.nombre || e.formularioId));
  return {
    formularios: [...formularios].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    rutinas: unicos((e) => e.rutinaNombre),
    lideres: unicos((e) => e.lider),
    evaluadores: unicos((e) => e.evaluadorNombre),
  };
}

export function kpis(lista) {
  const n = lista.length;
  if (!n) return { n: 0, promedio: null, pctEfectiva: null, pctCritico: null, rutinas: 0, lideres: 0 };
  const suma = lista.reduce((a, e) => a + (e.resultado?.indice ?? 0), 0);
  const efectivas = lista.filter((e) => e.resultado?.clasificacion === "efectiva").length;
  const criticos = lista.filter((e) => (e.resultado?.criticosEnCero || []).length).length;
  return {
    n,
    promedio: redondear(suma / n),
    pctEfectiva: redondear((efectivas * 100) / n),
    pctCritico: redondear((criticos * 100) / n),
    rutinas: new Set(lista.map(claveRutina)).size,
    lideres: new Set(lista.map((e) => norm(e.lider))).size,
  };
}

export function distribucion(lista) {
  const d = { efectiva: 0, desarrollo: 0, intervencion: 0 };
  lista.forEach((e) => {
    const c = e.resultado?.clasificacion;
    if (c in d) d[c] += 1;
  });
  return d;
}

/** Índice promedio en el tiempo: por semana si el período es corto (≤ 70 días), por mes si es largo. */
export function tendencia(lista) {
  if (!lista.length) return { agrupacion: "mes", puntos: [] };
  const fechas = lista.map(fechaCdR).sort();
  const porSemana = diasEntre(fechas[0], fechas[fechas.length - 1]) <= 70;
  const lunesDe = (iso) => sumarDias(iso, -((deISO(iso).getDay() + 6) % 7));
  const grupos = new Map();
  lista.forEach((e) => {
    const f = fechaCdR(e);
    const clave = porSemana ? lunesDe(f) : f.slice(0, 7);
    const g = grupos.get(clave) || { clave, n: 0, suma: 0 };
    g.n += 1;
    g.suma += e.resultado?.indice ?? 0;
    grupos.set(clave, g);
  });
  const puntos = [...grupos.values()]
    .sort((a, b) => a.clave.localeCompare(b.clave))
    .map((g) => ({
      clave: g.clave,
      n: g.n,
      promedio: redondear(g.suma / g.n),
      etiqueta: porSemana ? `${g.clave.slice(8, 10)} ${MESES[Number(g.clave.slice(5, 7)) - 1]}` : `${MESES[Number(g.clave.slice(5, 7)) - 1]} ${g.clave.slice(2, 4)}`,
    }));
  return { agrupacion: porSemana ? "semana" : "mes", puntos };
}

/** Promedio del índice agrupado por lo que devuelva `fnClave` (rutina, líder, evaluador…). Mayor a menor. */
export function promedioPor(lista, fnClave) {
  const grupos = new Map();
  lista.forEach((e) => {
    const nombre = (fnClave(e) || "").trim() || "(sin dato)";
    const k = norm(nombre);
    const g = grupos.get(k) || { clave: nombre, n: 0, suma: 0, efectivas: 0, ultima: "" };
    g.n += 1;
    g.suma += e.resultado?.indice ?? 0;
    if (e.resultado?.clasificacion === "efectiva") g.efectivas += 1;
    const f = fechaCdR(e);
    if (f > g.ultima) g.ultima = f;
    grupos.set(k, g);
  });
  return [...grupos.values()]
    .map((g) => ({ clave: g.clave, n: g.n, promedio: redondear(g.suma / g.n), efectivas: g.efectivas, ultima: g.ultima }))
    .sort((a, b) => b.promedio - a.promedio || b.n - a.n);
}

export function porBloque(lista) {
  const mapa = new Map();
  lista.forEach((e) =>
    (e.resultado?.bloques || []).forEach((b) => {
      if (b.puntaje === null || b.puntaje === undefined) return;
      const g = mapa.get(b.nombre) || { clave: b.nombre, n: 0, suma: 0 };
      g.n += 1;
      g.suma += b.puntaje;
      mapa.set(b.nombre, g);
    })
  );
  return [...mapa.values()].map((g) => ({ clave: g.clave, n: g.n, promedio: redondear(g.suma / g.n) }));
}

/** Cumplimiento promedio de cada criterio (2 = 100%, 1 = 50%, 0 = 0%; N/A no cuenta). Del más débil al más fuerte. */
export function porCriterio(lista) {
  const mapa = new Map();
  lista.forEach((e) =>
    (e.formulario?.bloques || []).forEach((b) =>
      b.criterios.forEach((c) => {
        const r = e.respuestas?.[c.codigo];
        if (!r || r.nivel === "NA" || r.nivel === "" || r.nivel === undefined) return;
        const clave = `${c.codigo} · ${c.nombre}`;
        const g = mapa.get(clave) || { clave, codigo: c.codigo, bloque: b.nombre, critico: !!c.critico, n: 0, suma: 0, ceros: 0 };
        g.n += 1;
        g.suma += Number(r.nivel) / 2;
        if (Number(r.nivel) === 0) g.ceros += 1;
        mapa.set(clave, g);
      })
    )
  );
  return [...mapa.values()]
    .map((g) => ({ ...g, cumplimiento: redondear((g.suma * 100) / g.n), pctCero: redondear((g.ceros * 100) / g.n) }))
    .sort((a, b) => a.cumplimiento - b.cumplimiento);
}

const ETIQUETA_SEGUIMIENTO = { cumplido: "Cumplido", parcial: "Parcial", no: "No cumplido" };

/** Compromisos de mejora y en qué estado están (según la CdR siguiente de la misma rutina). */
export function compromisos(lista, hoy = hoyISO()) {
  const orden = [...lista].sort((a, b) => (a.fechaEnvio || "").localeCompare(b.fechaEnvio || ""));
  return orden
    .filter((e) => (e.feedback?.compromiso?.accion || "").trim())
    .map((e) => {
      const c = e.feedback.compromiso;
      const posterior = orden.find(
        (o) => o !== e && (o.fechaEnvio || "") > (e.fechaEnvio || "") && claveRutina(o) === claveRutina(e) && (o.compromisoAnterior?.accion || "").trim() === c.accion.trim()
      );
      let estado;
      if (posterior) estado = ETIQUETA_SEGUIMIENTO[posterior.feedback?.seguimiento] || "Revisado";
      else estado = c.fecha && c.fecha < hoy ? "Vencido" : "Pendiente";
      return { id: e.id, rutina: e.rutinaNombre, lider: e.lider, accion: c.accion, responsable: c.responsable || e.lider, fecha: c.fecha || "", fechaCdR: fechaCdR(e), estado };
    })
    .sort((a, b) => b.fechaCdR.localeCompare(a.fechaCdR));
}

/** Para cada rutina que se puede evaluar: cuántas CdR tiene en el período y hace cuánto fue la última. */
export function cobertura(formularios, todas, filtradas, hoy = hoyISO()) {
  const rutinas = new Map();
  formularios
    .filter((f) => f.estado === "publicado")
    .forEach((f) =>
      (f.rutinas || []).forEach((r) => {
        const k = r.sesionId || norm(r.nombre);
        const g = rutinas.get(k) || { clave: k, nombre: r.nombre, lideres: new Set() };
        (r.lideres || []).forEach((l) => g.lideres.add(l));
        rutinas.set(k, g);
      })
    );
  todas.filter((e) => !e.anulada).forEach((e) => {
    const k = claveRutina(e);
    if (!rutinas.has(k)) rutinas.set(k, { clave: k, nombre: e.rutinaNombre, lideres: new Set(e.lider ? [e.lider] : []) });
  });
  return [...rutinas.values()]
    .map((r) => {
      const propias = todas.filter((e) => !e.anulada && claveRutina(e) === r.clave).sort((a, b) => fechaCdR(b).localeCompare(fechaCdR(a)));
      const ultima = propias[0];
      return {
        nombre: r.nombre,
        lideres: [...r.lideres],
        enPeriodo: filtradas.filter((e) => claveRutina(e) === r.clave).length,
        ultima: ultima ? fechaCdR(ultima) : "",
        dias: ultima ? diasEntre(fechaCdR(ultima), hoy) : null,
        ultimoIndice: ultima ? ultima.resultado?.indice ?? null : null,
      };
    })
    // Primero las que nunca se evaluaron, luego las que llevan más tiempo sin una CdR.
    .sort((a, b) => (b.dias === null ? 1 : 0) - (a.dias === null ? 1 : 0) || (b.dias ?? 0) - (a.dias ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
}

const ETIQUETA_RESULTADO = { efectiva: "Rutina efectiva", desarrollo: "En desarrollo", intervencion: "Requiere intervención" };

/** CSV listo para Excel (separador ";", coma decimal y BOM para que respete las tildes). */
export function aCSV(lista) {
  const bloques = [];
  const criterios = [];
  lista.forEach((e) =>
    (e.formulario?.bloques || []).forEach((b) => {
      if (!bloques.includes(b.nombre)) bloques.push(b.nombre);
      b.criterios.forEach((c) => {
        const k = `${c.codigo} ${c.nombre}`;
        if (!criterios.some((x) => x.k === k)) criterios.push({ k, codigo: c.codigo });
      });
    })
  );
  const num = (x) => (x === null || x === undefined ? "" : String(x).replace(".", ","));
  const celda = (v) => {
    const t = String(v ?? "");
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const cab = ["Fecha CdR", "Enviada", "Formulario", "Rutina", "Líder", "Evaluador", "Índice %", "Resultado", "Críticos en 0", ...bloques.map((b) => `Nota bloque: ${b}`), ...criterios.map((c) => `Nivel ${c.k}`), "Compromiso", "Responsable", "Fecha compromiso", "Anulada"];
  const filas = lista.map((e) => {
    const porBloque = Object.fromEntries((e.resultado?.bloques || []).map((b) => [b.nombre, b.puntaje]));
    return [
      fechaCdR(e),
      (e.fechaEnvio || "").slice(0, 10),
      e.formulario?.nombre,
      e.rutinaNombre,
      e.lider,
      e.evaluadorNombre,
      num(e.resultado?.indice),
      ETIQUETA_RESULTADO[e.resultado?.clasificacion] || "",
      (e.resultado?.criticosEnCero || []).join(", "),
      ...bloques.map((b) => num(porBloque[b])),
      ...criterios.map((c) => {
        const r = e.respuestas?.[c.codigo];
        return r && r.nivel !== "" && r.nivel !== undefined ? (r.nivel === "NA" ? "N/A" : r.nivel) : "";
      }),
      e.feedback?.compromiso?.accion || "",
      e.feedback?.compromiso?.responsable || "",
      e.feedback?.compromiso?.fecha || "",
      e.anulada ? "Sí" : "",
    ];
  });
  return "\uFEFF" + [cab, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
}
