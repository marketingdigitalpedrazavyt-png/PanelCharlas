const { ValidationError } = require("../errors");

const ROLES = ["superadmin", "staff"];
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entidad Usuario (staff del panel).
 * @param {{id?, email, passwordHash, rol?}} props
 */
function crearUsuario({ id = null, email, passwordHash, rol = "staff" }) {
  email = String(email || "").trim().toLowerCase();
  if (!RE_EMAIL.test(email)) throw new ValidationError("Email inválido.");
  if (!passwordHash) throw new ValidationError("Falta el hash de contraseña.");
  if (!ROLES.includes(rol)) throw new ValidationError("Rol inválido.");
  return Object.freeze({ id, email, passwordHash, rol });
}

module.exports = { crearUsuario, ROLES };
