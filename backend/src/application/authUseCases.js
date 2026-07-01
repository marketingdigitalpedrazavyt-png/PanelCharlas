const { crearUsuario } = require("../domain/model/Usuario");
const { ConflictError, UnauthorizedError, ValidationError } = require("../domain/errors");

/** Inicia sesión y devuelve un JWT. */
class LoginUsuario {
  constructor({ usuarioRepo, hasher, tokens }) {
    this.usuarioRepo = usuarioRepo; this.hasher = hasher; this.tokens = tokens;
  }
  async execute({ email, password }) {
    email = String(email || "").trim().toLowerCase();
    const usuario = await this.usuarioRepo.buscarPorEmail(email);
    if (!usuario) throw new UnauthorizedError("Email o contraseña incorrectos.");
    const ok = await this.hasher.compare(String(password || ""), usuario.passwordHash);
    if (!ok) throw new UnauthorizedError("Email o contraseña incorrectos.");
    const token = this.tokens.sign({ sub: usuario.id, email: usuario.email, rol: usuario.rol });
    return { token, usuario: { email: usuario.email, rol: usuario.rol } };
  }
}

/** Crea un usuario staff (solo lo llama el superadmin). */
class CrearUsuario {
  constructor({ usuarioRepo, hasher }) { this.usuarioRepo = usuarioRepo; this.hasher = hasher; }
  async execute({ email, password, rol = "staff" }) {
    email = String(email || "").trim().toLowerCase();
    if (String(password || "").length < 6) throw new ValidationError("La contraseña debe tener al menos 6 caracteres.");
    if (await this.usuarioRepo.buscarPorEmail(email)) throw new ConflictError("Ya existe un usuario con ese email.");
    const passwordHash = await this.hasher.hash(password);
    const usuario = crearUsuario({ email, passwordHash, rol });
    const guardado = await this.usuarioRepo.guardar(usuario);
    return { email: guardado.email, rol: guardado.rol };
  }
}

class ListarUsuarios {
  constructor({ usuarioRepo }) { this.usuarioRepo = usuarioRepo; }
  async execute() {
    const usuarios = await this.usuarioRepo.listar();
    return { total: usuarios.length, usuarios: usuarios.map((u) => ({ email: u.email, rol: u.rol })) };
  }
}

module.exports = { LoginUsuario, CrearUsuario, ListarUsuarios };
