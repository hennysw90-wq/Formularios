// A quién le corresponde revisar un compromiso de mejora en la CdR siguiente.
// Regla: lo que yo acordé con un líder lo reviso yo, con ese mismo líder y en esa misma rutina, y solo el último.

export const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * ¿Son la misma persona? Una persona puede aparecer como usuario del portal (uid), como asistente de
 * Control de Asistencia (personaId) o solo por su nombre; basta con que coincida alguna de las tres cosas.
 */
export function mismaPersona(a, b) {
  if (a.uid && b.uid && a.uid === b.uid) return true;
  if (a.personaId && b.personaId && a.personaId === b.personaId) return true;
  const na = norm(a.nombre);
  return !!na && na === norm(b.nombre);
}

/** Mismo líder; si alguno de los dos no está definido todavía, no se descarta. */
export function mismoLider(a, b) {
  const na = norm(a);
  const nb = norm(b);
  return !na || !nb || na === nb;
}

/**
 * De todas las evaluaciones de una rutina, elige el compromiso que debe revisar quien evalúa ahora:
 * el de su CdR enviada más reciente con ese líder. Ignora las anuladas y las de otros evaluadores.
 * `actual` = { id, lider, evaluador: { uid, personaId, nombre } }
 */
export function elegirCompromisoAnterior(evaluaciones, actual) {
  const propias = evaluaciones
    .filter(
      (e) =>
        e.estado === "enviada" &&
        !e.anulada &&
        e.id !== actual.id &&
        (e.feedback?.compromiso?.accion || "").trim() &&
        mismaPersona({ uid: e.evaluadorUid, personaId: e.evaluadorPersonaId, nombre: e.evaluadorNombre }, actual.evaluador) &&
        mismoLider(e.lider, actual.lider)
    )
    .sort((a, b) => (b.fechaEnvio || "").localeCompare(a.fechaEnvio || ""));
  const e = propias[0];
  if (!e) return null;
  return { fecha: e.fechaEnvio, accion: e.feedback.compromiso.accion, responsable: e.feedback.compromiso.responsable || "", lider: e.lider || "", evaluador: e.evaluadorNombre || "" };
}
