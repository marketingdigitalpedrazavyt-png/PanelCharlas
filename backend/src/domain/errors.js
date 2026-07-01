/**
 * Errores del dominio (agnósticos del transporte HTTP).
 * La capa HTTP los mapea a códigos de estado.
 */
class DomainError extends Error {
  constructor(message, code = "DOMAIN_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

class ValidationError extends DomainError {
  constructor(message) { super(message, "VALIDATION"); }
}

class ConflictError extends DomainError {
  constructor(message) { super(message, "CONFLICT"); }
}

class NotFoundError extends DomainError {
  constructor(message) { super(message, "NOT_FOUND"); }
}

class UnauthorizedError extends DomainError {
  constructor(message = "No autorizado") { super(message, "UNAUTHORIZED"); }
}

class ForbiddenError extends DomainError {
  constructor(message = "Prohibido") { super(message, "FORBIDDEN"); }
}

module.exports = {
  DomainError, ValidationError, ConflictError,
  NotFoundError, UnauthorizedError, ForbiddenError,
};
