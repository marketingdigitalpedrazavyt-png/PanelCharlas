const { ValidationError } = require("../errors");

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;   // yyyy-mm-dd
const RE_HORA = /^\d{2}:\d{2}$/;          // HH:MM

/**
 * Entidad Evento (charla). Obligatorios: dia, hora, direccion, barrio.
 */
function crearEvento({ id = null, dia, hora, lugar = "", direccion, barrio, vendedor = "", activo = true }) {
  dia = String(dia || "").trim();
  hora = String(hora || "").trim();
  direccion = String(direccion || "").trim();
  barrio = String(barrio || "").trim();

  if (!RE_FECHA.test(dia)) throw new ValidationError("El día es obligatorio (formato yyyy-mm-dd).");
  if (!RE_HORA.test(hora)) throw new ValidationError("La hora es obligatoria (formato HH:MM).");
  if (!direccion) throw new ValidationError("La dirección es obligatoria.");
  if (!barrio) throw new ValidationError("El barrio es obligatorio.");

  return Object.freeze({
    id, dia, hora,
    lugar: String(lugar || "").trim(),
    direccion, barrio,
    vendedor: String(vendedor || "").trim(),
    activo: !!activo,
  });
}

/** Etiqueta legible: "15/08/2026 · 19:00 hs · Recoleta — Hotel Alvear" */
function etiquetaEvento(ev) {
  const fecha = formatFecha(ev.dia);
  const partes = [fecha];
  if (ev.hora) partes.push(ev.hora + " hs");
  if (ev.barrio) partes.push(ev.barrio);
  let base = partes.join(" · ");
  if (ev.lugar) base += " — " + ev.lugar;
  else if (ev.direccion) base += " — " + ev.direccion;
  return base;
}

function formatFecha(dia) {
  const p = String(dia || "").split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(dia || "");
}

module.exports = { crearEvento, etiquetaEvento, formatFecha };
