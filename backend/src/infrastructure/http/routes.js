const { Router } = require("express");
const { asyncH, requireAuth, requireSuper } = require("./middlewares");
const { UnauthorizedError, ValidationError } = require("../../domain/errors");

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
  r.get("/eventos/publicos", asyncH(async (req, res) => res.json(await uc.listarEventosPublicos.execute(req.query.modalidad))));
  r.get("/vendedores/:slug", asyncH(async (req, res) => res.json(await uc.resolverVendedor.execute(req.params.slug))));
  r.post("/inscripciones", asyncH(async (req, res) => res.status(201).json(await uc.crearInscripcion.execute(req.body || {}))));

  // Credencial (pública, por código no adivinable)
  r.get("/inscripciones/:codigo/credencial.png", asyncH((req, res) => enviarCredencial(uc, req, res, "png")));
  r.get("/inscripciones/:codigo/credencial.pdf", asyncH((req, res) => enviarCredencial(uc, req, res, "pdf")));

  // Escáner (abierto): marca asistencia
  r.post("/asistencia/:codigo", asyncH(async (req, res) => res.json(await uc.marcarAsistencia.execute(req.params.codigo))));

  // Puente para n8n: recibe datos simples o payload WAHA y lo envia a WAHA.
  r.post("/n8n/waha/send-image", asyncH((req, res) => enviarImagenWahaDesdeN8n(uc, req, res)));
  r.post("/n8n/waha/send-text", asyncH((req, res) => enviarTextoWahaDesdeN8n(uc, req, res)));

  /* ---------- Protegido (staff logueado) ---------- */
  r.get("/inscripciones", auth, asyncH(async (req, res) => res.json(await uc.listarInscripciones.execute())));
  r.put("/inscripciones/:codigo", auth, asyncH(async (req, res) => res.json(await uc.actualizarInscripcion.execute(req.params.codigo, req.body || {}))));
  r.put("/inscripciones/:codigo/asistencia", auth, asyncH(async (req, res) => res.json(await uc.cambiarAsistencia.execute(req.params.codigo, (req.body || {}).asistio))));
  r.delete("/inscripciones/:codigo", auth, asyncH(async (req, res) => res.json(await uc.eliminarInscripcion.execute(req.params.codigo))));

  r.get("/eventos", auth, asyncH(async (req, res) => res.json(await uc.listarEventos.execute())));
  r.post("/eventos", auth, asyncH(async (req, res) => res.status(201).json(await uc.crearEvento.execute(req.body || {}))));
  r.put("/eventos/:id", auth, asyncH(async (req, res) => res.json(await uc.actualizarEvento.execute(req.params.id, req.body || {}))));
  r.put("/eventos/:id/activo", auth, asyncH(async (req, res) => res.json(await uc.cambiarEstadoEvento.execute(req.params.id, (req.body || {}).activo))));
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

async function enviarImagenWahaDesdeN8n(uc, req, res) {
  validarTokenN8n(uc.config, req);
  const payload = normalizarPayloadWaha(req.body || {}, uc.config);
  responderWaha(res, await postWaha(uc.config, "/api/sendImage", payload));
}

async function enviarTextoWahaDesdeN8n(uc, req, res) {
  validarTokenN8n(uc.config, req);
  const payload = normalizarPayloadTextoWaha(req.body || {}, uc.config);
  responderWaha(res, await postWaha(uc.config, "/api/sendText", payload));
}

async function postWaha(config, path, payload) {
  const { url, apiKey } = config.waha;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const resp = await fetch(`${String(url).replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await resp.text().catch(() => "");
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch (e) {}

  if (!resp.ok) {
    return { ok: false, status: resp.status, error: data || text || `WAHA ${resp.status}` };
  }

  return { ok: true, status: resp.status, waha: data };
}

function responderWaha(res, result) {
  if (!result.ok) return res.status(result.status || 502).json(result);
  return res.json(result);
}

function validarTokenN8n(config, req) {
  const esperado = config.n8n.bridgeToken;
  if (!esperado) return;

  const auth = req.headers.authorization || "";
  const recibido = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-n8n-token"];
  if (recibido !== esperado) throw new UnauthorizedError("Token n8n invalido.");
}

function normalizarPayloadWaha(input, config) {
  if (input.chatId && input.file) return input;

  const body = input.body && typeof input.body === "object" ? input.body : {};
  const bodyText = typeof input.body === "string" ? input.body : "";
  const numeroRaw = input.numero || input.celular || input.phone || input.to || body.numero || body.celular || body.phone || body.to;
  const numero = String(numeroRaw || "").replace(/\D/g, "");
  if (!numero) throw new ValidationError("Falta numero/celular valido.");

  const imagen = input.imagen || input.image || input.file || body.imagen || body.image || body.file;
  const file = normalizarImagen(imagen);
  if (!file.data) throw new ValidationError("Falta imagen en base64.");

  return {
    session: input.session || body.session || config.n8n.session,
    chatId: input.chatId || body.chatId || `${numero}@c.us`,
    caption: input.caption || input.mensaje || input.message || body.caption || body.mensaje || body.message || bodyText || "",
    file,
  };
}

function normalizarPayloadTextoWaha(input, config) {
  if (input.chatId && input.text) return input;

  const body = input.body && typeof input.body === "object" ? input.body : {};
  const bodyText = typeof input.body === "string" ? input.body : "";
  const numeroRaw = input.numero || input.celular || input.phone || input.to || body.numero || body.celular || body.phone || body.to;
  const numero = String(numeroRaw || "").replace(/\D/g, "");
  if (!numero) throw new ValidationError("Falta numero/celular valido.");

  const text = input.text || input.mensaje || input.message || body.text || body.mensaje || body.message || bodyText;
  if (!text) throw new ValidationError("Falta texto del mensaje.");

  return {
    session: input.session || body.session || config.n8n.session,
    chatId: input.chatId || body.chatId || `${numero}@c.us`,
    text,
  };
}

function normalizarImagen(imagen) {
  if (imagen && typeof imagen === "object") {
    return {
      mimetype: imagen.mimetype || imagen.mimeType || "image/png",
      filename: imagen.filename || imagen.fileName || "credencial.png",
      data: limpiarBase64(imagen.data || imagen.base64 || ""),
    };
  }

  return {
    mimetype: "image/png",
    filename: "credencial.png",
    data: limpiarBase64(imagen || ""),
  };
}

function limpiarBase64(valor) {
  return String(valor || "").replace(/^data:[^;]+;base64,/, "");
}

module.exports = { buildRouter };
