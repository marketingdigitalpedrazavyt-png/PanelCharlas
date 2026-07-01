const { ValidationError } = require("../errors");

const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/1/I

function soloDigitos(s) { return String(s || "").replace(/\D/g, ""); }

/** Genera un código único legible tipo "MM-7F3K9". */
function generarCodigo() {
  let s = "";
  for (let i = 0; i < 6; i++) s += ABC[Math.floor(Math.random() * ABC.length)];
  return "MM-" + s;
}

/**
 * Entidad Inscripcion. Obligatorios: nombre, apellido, dni(≥7), celular(≥8), eventoId.
 */
function crearInscripcion({
  id = null, codigo = null, nombre, apellido, dni, celular,
  eventoId, vendedorSlug = null, vendedorNombre = "Directo",
  asistio = false, asistioAt = null,
}) {
  nombre = String(nombre || "").trim();
  apellido = String(apellido || "").trim();
  dni = soloDigitos(dni);
  celular = soloDigitos(celular);

  if (nombre.length < 2) throw new ValidationError("Ingresá tu nombre.");
  if (apellido.length < 2) throw new ValidationError("Ingresá tu apellido.");
  if (dni.length < 7) throw new ValidationError("Ingresá un DNI válido (sin puntos).");
  if (celular.length < 8) throw new ValidationError("Ingresá un celular válido.");
  if (!eventoId) throw new ValidationError("Elegí el evento al que vas a asistir.");

  return Object.freeze({
    id,
    codigo: codigo || generarCodigo(),
    nombre, apellido, dni, celular,
    eventoId,
    vendedorSlug: vendedorSlug || null,
    vendedorNombre: vendedorNombre || "Directo",
    asistio: !!asistio,
    asistioAt: asistioAt || null,
  });
}

/**
 * Normaliza a formato WhatsApp Argentina (mejor esfuerzo): 549 + area + número.
 */
function celularAWhatsApp(celular) {
  let d = soloDigitos(celular);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("9")) d = d.slice(1);
  return "549" + d;
}

module.exports = { crearInscripcion, generarCodigo, celularAWhatsApp, soloDigitos };
