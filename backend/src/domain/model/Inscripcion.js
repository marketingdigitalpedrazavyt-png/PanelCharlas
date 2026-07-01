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
 * Normaliza a formato WhatsApp Argentina (mejor esfuerzo): 549 + área + número.
 * Contempla el prefijo "15" de celular (que se marca en modo local):
 *   - "11 15 2390 1345" -> 549 11 2390 1345
 *   - "15 2390 1345"    -> 549 11 2390 1345   (sin área: se asume CABA/11)
 * También quita 54 (país), 0 (troncal) y 9 (celular internacional).
 */
function celularAWhatsApp(celular) {
  let d = soloDigitos(celular);
  if (d.startsWith("54")) d = d.slice(2);   // país
  if (d.startsWith("0")) d = d.slice(1);    // troncal
  if (d.startsWith("9")) d = d.slice(1);    // celular (formato internacional)

  if (d.length === 10 && d.startsWith("15")) {
    // Local sin código de área (se asume CABA / 11)
    d = "11" + d.slice(2);
  } else if (d.length === 11 || d.length === 12) {
    // "15" incrustado tras el código de área (2, 3 o 4 dígitos): se remueve
    for (const a of [2, 3, 4]) {
      if (d.slice(a, a + 2) === "15") { d = d.slice(0, a) + d.slice(a + 2); break; }
    }
  }
  return "549" + d;
}

module.exports = { crearInscripcion, generarCodigo, celularAWhatsApp, soloDigitos };
