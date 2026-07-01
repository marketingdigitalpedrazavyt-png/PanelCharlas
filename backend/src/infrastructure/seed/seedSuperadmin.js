const { crearUsuario } = require("../../domain/model/Usuario");

/**
 * Siembra (upsert) el superadmin al arrancar, tomando email/contraseña de
 * las variables de entorno. Si no hay contraseña configurada, no hace nada.
 */
async function seedSuperadmin({ usuarioRepo, hasher, config }) {
  const { email, password } = config.superadmin;
  if (!email || !password) {
    console.log("[seed] SUPERADMIN_PASSWORD vacío: no se siembra superadmin.");
    return;
  }
  const passwordHash = await hasher.hash(password);
  const usuario = crearUsuario({ email, passwordHash, rol: "superadmin" });
  await usuarioRepo.guardar(usuario); // upsert
  console.log(`[seed] Superadmin listo: ${email}`);
}

module.exports = { seedSuperadmin };
