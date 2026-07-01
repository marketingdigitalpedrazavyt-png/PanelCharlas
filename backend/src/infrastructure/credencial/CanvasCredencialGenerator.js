const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const { CredencialGenerator } = require("../../domain/ports/services");
const { formatFecha } = require("../../domain/model/Evento");

const W = 1240, H = 780;
const PEARL = "#f3ead3", GOLD = "#e3c275", GOLD_L = "#f6e4b0", GOLD_D = "#b8893f";
const NAVY_D = "#051428";
const ASSETS = path.join(__dirname, "assets");
const FONTS = path.join(ASSETS, "fonts");

// Registro de fuentes (best-effort; si no están, usa la de sistema)
(function registrarFuentes() {
  const map = [
    ["CormorantGaramond-SemiBold.ttf", "Cormorant Garamond"],
    ["CormorantGaramond-Bold.ttf", "Cormorant Garamond"],
    ["Montserrat-Regular.ttf", "Montserrat"],
    ["Montserrat-SemiBold.ttf", "Montserrat"],
    ["Montserrat-Bold.ttf", "Montserrat"],
    ["GreatVibes-Regular.ttf", "Great Vibes"],
  ];
  for (const [file, family] of map) {
    const p = path.join(FONTS, file);
    try { if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family); } catch (e) { /* ignore */ }
  }
})();

/** Generador de credencial (boarding pass) con la estética del paquete. */
class CanvasCredencialGenerator extends CredencialGenerator {
  constructor({ paqueteNombre, paqueteBajada } = {}) {
    super();
    this.paqueteNombre = paqueteNombre || "Maravillas del Mediterráneo";
    this.paqueteBajada = paqueteBajada || "Charla informativa";
  }

  async generar(data) {
    const png = await this._dibujarPng(data);
    const pdf = await this._aPdf(png);
    return { png, pdf };
  }

  async _dibujarPng(data) {
    const ev = data.evento || {};
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Fondo navy
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c2a52"); g.addColorStop(1, NAVY_D);
    rr(ctx, 0, 0, W, H, 36); ctx.fillStyle = g; ctx.fill();

    // Glow superior
    const rg = ctx.createRadialGradient(W * 0.5, -120, 60, W * 0.5, -120, 620);
    rg.addColorStop(0, "rgba(227,194,117,0.18)"); rg.addColorStop(1, "rgba(227,194,117,0)");
    rr(ctx, 0, 0, W, H, 36); ctx.fillStyle = rg; ctx.fill();

    // Marco dorado
    ctx.lineWidth = 3;
    const bg2 = ctx.createLinearGradient(0, 0, W, H);
    bg2.addColorStop(0, GOLD_L); bg2.addColorStop(0.5, GOLD_D); bg2.addColorStop(1, GOLD_L);
    rr(ctx, 16, 16, W - 32, H - 32, 26); ctx.strokeStyle = bg2; ctx.stroke();

    corner(ctx, 40, 40, 1, 1); corner(ctx, W - 40, 40, -1, 1);
    corner(ctx, 40, H - 40, 1, -1); corner(ctx, W - 40, H - 40, -1, -1);

    const stubX = W - 360;
    ctx.save();
    ctx.strokeStyle = "rgba(227,194,117,0.7)"; ctx.lineWidth = 2;
    ctx.setLineDash([3, 9]); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(stubX, 70); ctx.lineTo(stubX, H - 70); ctx.stroke();
    ctx.restore();

    const padX = 64;
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";

    ctx.fillStyle = GOLD; ctx.font = "700 17px 'Montserrat'";
    spaced(ctx, "PASE DE EMBARQUE", padX, 92, 4);

    ctx.fillStyle = PEARL; ctx.font = "700 50px 'Cormorant Garamond'";
    ctx.fillText(this.paqueteNombre, padX, 150);
    ctx.fillStyle = "rgba(243,234,211,0.7)"; ctx.font = "400 18px 'Montserrat'";
    ctx.fillText(this.paqueteBajada, padX, 182);

    ctx.fillStyle = GOLD; ctx.font = "600 14px 'Montserrat'";
    spaced(ctx, "PASAJERO/A", padX, 250, 3);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 56px 'Cormorant Garamond'";
    fitText(ctx, `${data.nombre || ""} ${data.apellido || ""}`.trim().toUpperCase(), padX, 304, stubX - padX - 30);

    const colY = 392;
    detalle(ctx, padX, colY, "DOCUMENTO", data.dni || "—");
    detalle(ctx, padX + 280, colY, "CÓDIGO", data.codigo || "—");
    detalle(ctx, padX, colY + 92, "FECHA", formatFecha(ev.dia) || "A confirmar");
    detalle(ctx, padX + 280, colY + 92, "HORA", ev.hora ? ev.hora + " hs" : "—");
    const lugar = [ev.lugar, ev.direccion, ev.barrio].filter(Boolean).join(" · ") || "A confirmar";
    detalle(ctx, padX, colY + 184, "LUGAR", lugar, stubX - padX - 40);

    // Logo
    try {
      const logo = await loadImage(path.join(ASSETS, "logopedraza.png"));
      const lw = 150, lh = lw * (logo.height / logo.width);
      ctx.drawImage(logo, padX, H - 60 - lh / 2, lw, lh);
    } catch (e) { /* sin logo */ }

    // Talón: QR
    const cx = stubX + (W - stubX) / 2;
    ctx.fillStyle = GOLD; ctx.font = "700 14px 'Montserrat'"; ctx.textAlign = "center";
    spacedCentered(ctx, "Nº DE PASE", cx, 96, 3);

    const qrSize = 240;
    const qrBuf = await QRCode.toBuffer(String(data.codigo || ""), {
      type: "png", margin: 1, width: qrSize, color: { dark: "#08152e", light: "#ffffff" },
    });
    const qrImg = await loadImage(qrBuf);
    const qx = cx - qrSize / 2, qy = 150;
    ctx.fillStyle = "#ffffff"; rr(ctx, qx - 16, qy - 16, qrSize + 32, qrSize + 32, 18); ctx.fill();
    ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);

    ctx.fillStyle = PEARL; ctx.font = "700 30px 'Montserrat'"; ctx.textAlign = "center";
    ctx.fillText(data.codigo || "", cx, qy + qrSize + 70);
    ctx.fillStyle = "rgba(243,234,211,0.6)"; ctx.font = "400 14px 'Montserrat'";
    ctx.fillText("Presentá este código en el ingreso", cx, qy + qrSize + 100);

    ctx.fillStyle = GOLD_L; ctx.font = "400 38px 'Great Vibes'";
    ctx.fillText("¡Bienvenido/a a bordo!", cx, H - 70);

    return canvas.toBuffer("image/png");
  }

  _aPdf(png) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [W, H], margin: 0 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.image(png, 0, 0, { width: W, height: H });
      doc.end();
    });
  }
}

/* ---------- helpers de dibujo ---------- */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function corner(ctx, x, y, sx, sy) {
  ctx.save();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x + sx * 26, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 26);
  ctx.stroke(); ctx.restore();
}
function spaced(ctx, text, x, y, sp) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
}
function spacedCentered(ctx, text, centerX, y, sp) {
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + sp;
  total -= sp;
  let cx = centerX - total / 2;
  const prev = ctx.textAlign; ctx.textAlign = "left";
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
  ctx.textAlign = prev;
}
function detalle(ctx, x, y, label, value, maxW) {
  ctx.textAlign = "left";
  ctx.fillStyle = GOLD; ctx.font = "700 13px 'Montserrat'";
  spaced(ctx, label, x, y, 2);
  ctx.fillStyle = "#ffffff"; ctx.font = "600 26px 'Montserrat'";
  fitText(ctx, String(value), x, y + 34, maxW || 250);
}
function fitText(ctx, text, x, y, maxW) {
  const m = ctx.font.match(/^(.*?)(\d+)px(.*)$/);
  let size = m ? parseInt(m[2], 10) : 26;
  while (size > 12) {
    ctx.font = `${m[1]}${size}px${m[3]}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 2;
  }
  ctx.fillText(text, x, y);
}

module.exports = { CanvasCredencialGenerator };
