const jwt = require("jsonwebtoken");
const { TokenService } = require("../../domain/ports/services");
const { UnauthorizedError } = require("../../domain/errors");

class JwtTokenService extends TokenService {
  constructor(secret, expiresIn = "12h") { super(); this.secret = secret; this.expiresIn = expiresIn; }
  sign(payload) { return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn }); }
  verify(token) {
    try { return jwt.verify(token, this.secret); }
    catch (e) { throw new UnauthorizedError("Sesión inválida o expirada."); }
  }
}

module.exports = { JwtTokenService };
