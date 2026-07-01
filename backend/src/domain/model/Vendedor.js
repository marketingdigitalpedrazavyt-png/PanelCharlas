const { ValidationError } = require("../errors");

/** Convierte "María González" → "maria-gonzalez" */
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Entidad Vendedor. Cada uno tiene un slug único usado en su link (?v=slug).
 */
function crearVendedor({ id = null, slug = "", nombre, activo = true }) {
  nombre = String(nombre || "").trim();
  if (nombre.length < 2) throw new ValidationError("El nombre del vendedor es obligatorio.");
  slug = slugify(slug || nombre);
  if (!slug) throw new ValidationError("El código de link no es válido.");
  return Object.freeze({ id, slug, nombre, activo: !!activo });
}

module.exports = { crearVendedor, slugify };
