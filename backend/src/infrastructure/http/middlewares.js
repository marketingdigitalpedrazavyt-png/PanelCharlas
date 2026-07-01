const { DomainError } = require("../../domain/errors");

/** Envuelve handlers async para que los errores lleguen al errorHandler. */
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Exige un JWT válido (Authorization: Bearer <token>). */
function requireAuth(tokens) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Falta el token de sesión." });
    try {
      const payload = tokens.verify(token);
      req.user = { id: payload.sub, email: payload.email, rol: payload.rol };
      next();
    } catch (e) {
      res.status(401).json({ error: "Sesión inválida o expirada." });
    }
  };
}

/** Exige rol superadmin (usar después de requireAuth). */
function requireSuper(req, res, next) {
  if (!req.user || req.user.rol !== "superadmin") {
    return res.status(403).json({ error: "Requiere permisos de superadmin." });
  }
  next();
}

/** Traduce errores de dominio a códigos HTTP. */
function errorHandler(err, req, res, next) {
  const mapa = { VALIDATION: 400, CONFLICT: 409, NOT_FOUND: 404, UNAUTHORIZED: 401, FORBIDDEN: 403 };
  if (err instanceof DomainError) {
    return res.status(mapa[err.code] || 400).json({ error: err.message });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor." });
}

module.exports = { asyncH, requireAuth, requireSuper, errorHandler };
