const { WhatsAppSender } = require("../../domain/ports/services");

/**
 * Envia a n8n el payload de WhatsApp.
 * El workflow de n8n queda a cargo de procesarlo y entregar el WhatsApp.
 */
class N8nWhatsAppSender extends WhatsAppSender {
  constructor({ webhookUrl, session }) {
    super();
    this.webhookUrl = String(webhookUrl || "").trim();
    this.session = session || "default";
  }

  async enviarImagen({ celularWhatsApp, caption, png }) {
    const numero = String(celularWhatsApp || "").replace(/\D/g, "");
    if (!numero) return { ok: false, error: "Numero invalido." };
    if (!this.webhookUrl) return { ok: false, error: "N8N_WEBHOOK_URL no configurado." };

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
      const resp = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { ok: false, error: `n8n ${resp.status} ${txt.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = { N8nWhatsAppSender };
