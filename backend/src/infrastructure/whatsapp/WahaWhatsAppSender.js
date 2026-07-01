const { WhatsAppSender } = require("../../domain/ports/services");

/**
 * Adaptador de WhatsApp usando WAHA (https://waha.devlike.pro).
 * Envía la credencial como imagen a un número.
 */
class WahaWhatsAppSender extends WhatsAppSender {
  constructor({ url, apiKey, session }) {
    super();
    this.url = String(url || "").replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.session = session || "default";
  }

  async enviarImagen({ celularWhatsApp, caption, png }) {
    const numero = String(celularWhatsApp || "").replace(/\D/g, "");
    if (!numero) return { ok: false, error: "Número inválido." };

    const body = {
      session: this.session,
      chatId: `${numero}@c.us`,
      caption: caption || "",
      file: {
        mimetype: "image/png",
        filename: "credencial.png",
        data: Buffer.isBuffer(png) ? png.toString("base64") : String(png),
      },
    };

    try {
      const resp = await fetch(`${this.url}/api/sendImage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": this.apiKey },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { ok: false, error: `WAHA ${resp.status} ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = { WahaWhatsAppSender };
