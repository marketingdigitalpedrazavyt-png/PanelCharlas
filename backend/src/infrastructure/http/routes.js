const { Router } = require("express");
const { asyncH, requireAuth, requireSuper } = require("./middlewares");

/**
 * Construye el router de la API a partir de los casos de uso ya cableados.
 * @param {object} uc casos de uso + { tokens }
 */
function buildRouter(uc) {
  const r = Router();
  const auth = requireAuth(uc.tokens);

  r.get("/health", (req, res) => res.json({ ok: true }));

  /* ---------- Auth ---------- */
  r.post("/auth/login", asyncH(async (req, res) => res.json(await uc.login.execute(req.body || {}))));
  r.get("/auth/me", auth, (req, res) => res.json(req.user));

  /* ---------- Público (formulario) ---------- */
  r.get("/eventos/publicos", asyncH(async (req, res) => res.json(await uc.listarEventosPublicos.execute())));
  r.get("/vendedores/:slug", asyncH(async (req, res) => res.json(await uc.resolverVendedor.execute(req.params.slug))));
  r.post("/inscripciones", asyncH(async (req, res) => res.status(201).json(await uc.crearInscripcion.execute(req.body || {}))));

  // Credencial (pública, por código no adivinable)
  r.get("/inscripciones/:codigo/credencial.png", asyncH((req, res) => enviarCredencial(uc, req, res, "png")));
  r.get("/inscripciones/:codigo/credencial.pdf", asyncH((req, res) => enviarCredencial(uc, req, res, "pdf")));

  // Escáner (abierto): marca asistencia
  r.post("/asistencia/:codigo", asyncH(async (req, res) => res.json(await uc.marcarAsistencia.execute(req.params.codigo))));

  /* ---------- Protegido (staff logueado) ---------- */
  r.get("/inscripciones", auth, asyncH(async (req, res) => res.json(await uc.listarInscripciones.execute())));
  r.delete("/inscripciones/:codigo", auth, asyncH(async (req, res) => res.json(await uc.eliminarInscripcion.execute(req.params.codigo))));

  r.get("/eventos", auth, asyncH(async (req, res) => res.json(await uc.listarEventos.execute())));
  r.post("/eventos", auth, asyncH(async (req, res) => res.status(201).json(await uc.crearEvento.execute(req.body || {}))));
  r.delete("/eventos/:id", auth, asyncH(async (req, res) => res.json(await uc.eliminarEvento.execute(req.params.id))));

  r.get("/vendedores", auth, asyncH(async (req, res) => res.json(await uc.listarVendedores.execute())));
  r.post("/vendedores", auth, asyncH(async (req, res) => res.status(201).json(await uc.crearVendedor.execute(req.body || {}))));
  r.delete("/vendedores/:id", auth, asyncH(async (req, res) => res.json(await uc.eliminarVendedor.execute(req.params.id))));

  /* ---------- Superadmin ---------- */
  r.get("/usuarios", auth, requireSuper, asyncH(async (req, res) => res.json(await uc.listarUsuarios.execute())));
  r.post("/usuarios", auth, requireSuper, asyncH(async (req, res) => res.status(201).json(await uc.crearUsuario.execute(req.body || {}))));

  return r;
}

async function enviarCredencial(uc, req, res, formato) {
  const { buffer, mime, filename } = await uc.obtenerCredencial.execute(req.params.codigo, formato);
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { buildRouter };
