/* =========================================================
   Maravillas del Mediterráneo · Credencial (Boarding Pass)
   Dibuja una tarjeta premium estilo crucero con los datos
   del pasajero + QR estático, y la exporta como PDF / compartir.
   Expone: window.Credencial
   Requiere: qrcode.min.js y jspdf.umd.min.js
   ========================================================= */
window.Credencial = (function () {
    "use strict";

    var W = 1240, H = 780;           // lienzo de la credencial (px)
    var PEARL = "#f3ead3", GOLD = "#e3c275", GOLD_L = "#f6e4b0", GOLD_D = "#b8893f";
    var NAVY = "#0a2347", NAVY_D = "#051428";

    function rr(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function formatFecha(dia) {
        if (!dia) return "";
        var p = String(dia).split("-");
        return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : dia;
    }

    function loadImage(src) {
        return new Promise(function (resolve) {
            var img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };
            img.src = src;
        });
    }

    async function ensureFonts() {
        if (!document.fonts || !document.fonts.load) return;
        try {
            await Promise.all([
                document.fonts.load("700 64px 'Cormorant Garamond'"),
                document.fonts.load("600 30px 'Cormorant Garamond'"),
                document.fonts.load("700 22px 'Montserrat'"),
                document.fonts.load("600 18px 'Montserrat'"),
                document.fonts.load("500 16px 'Montserrat'"),
                document.fonts.load("400 40px 'Great Vibes'")
            ]);
            await document.fonts.ready;
        } catch (e) { /* fuentes por defecto si falla */ }
    }

    /* Dibuja la credencial en un canvas y lo devuelve */
    async function dibujar(data) {
        await ensureFonts();

        var marca = (window.APP_CONFIG && window.APP_CONFIG.evento) || {};
        var ev = data.evento || {};
        var canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        var ctx = canvas.getContext("2d");

        /* Fondo navy con degradado */
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#0c2a52"); g.addColorStop(1, NAVY_D);
        ctx.fillStyle = g; rr(ctx, 0, 0, W, H, 36); ctx.fill();

        /* Glow superior */
        var rg = ctx.createRadialGradient(W * 0.5, -120, 60, W * 0.5, -120, 620);
        rg.addColorStop(0, "rgba(227,194,117,0.18)"); rg.addColorStop(1, "rgba(227,194,117,0)");
        ctx.fillStyle = rg; rr(ctx, 0, 0, W, H, 36); ctx.fill();

        /* Marco dorado */
        ctx.lineWidth = 3;
        var bg2 = ctx.createLinearGradient(0, 0, W, H);
        bg2.addColorStop(0, GOLD_L); bg2.addColorStop(0.5, GOLD_D); bg2.addColorStop(1, GOLD_L);
        ctx.strokeStyle = bg2; rr(ctx, 16, 16, W - 32, H - 32, 26); ctx.stroke();

        /* Esquinas náuticas */
        drawCorner(ctx, 40, 40, 1, 1);
        drawCorner(ctx, W - 40, 40, -1, 1);
        drawCorner(ctx, 40, H - 40, 1, -1);
        drawCorner(ctx, W - 40, H - 40, -1, -1);

        var stubX = W - 360;   // inicio del talón derecho

        /* Línea perforada dorada (separador) */
        ctx.save();
        ctx.strokeStyle = "rgba(227,194,117,0.7)";
        ctx.lineWidth = 2; ctx.setLineDash([3, 9]); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(stubX, 70); ctx.lineTo(stubX, H - 70); ctx.stroke();
        ctx.restore();

        /* ---- Columna izquierda: info ---- */
        var padX = 64;

        // Eyebrow
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = GOLD;
        ctx.font = "700 17px 'Montserrat', sans-serif";
        ctx.save(); spaced(ctx, "PASE DE EMBARQUE", padX, 92, 4); ctx.restore();

        // Título (marca del paquete)
        ctx.fillStyle = PEARL;
        ctx.font = "700 50px 'Cormorant Garamond', serif";
        ctx.fillText(marca.nombre || "Maravillas del Mediterráneo", padX, 150);

        ctx.fillStyle = "rgba(243,234,211,0.7)";
        ctx.font = "500 18px 'Montserrat', sans-serif";
        ctx.fillText(marca.bajada || "Charla informativa", padX, 182);

        // Nombre del pasajero
        ctx.fillStyle = GOLD;
        ctx.font = "600 14px 'Montserrat', sans-serif";
        ctx.save(); spaced(ctx, "PASAJERO/A", padX, 250, 3); ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.font = "700 56px 'Cormorant Garamond', serif";
        var nombreCompleto = ((data.nombre || "") + " " + (data.apellido || "")).trim().toUpperCase();
        fitText(ctx, nombreCompleto, padX, 304, stubX - padX - 30, 56);

        // Detalles en grilla (datos del evento elegido)
        var colY = 392;
        detalle(ctx, padX, colY, "DOCUMENTO", data.dni || "—");
        detalle(ctx, padX + 280, colY, "CÓDIGO", data.codigo || "—");

        detalle(ctx, padX, colY + 92, "FECHA", formatFecha(ev.dia) || "A confirmar");
        detalle(ctx, padX + 280, colY + 92, "HORA", ev.hora ? (ev.hora + " hs") : "—");

        var lugarTxt = [ev.lugar, ev.direccion, ev.barrio].filter(Boolean).join(" · ") || "A confirmar";
        detalle(ctx, padX, colY + 184, "LUGAR", lugarTxt, stubX - padX - 40);

        // Logo (abajo izquierda)
        var logo = await loadImage("logopedraza.png");
        if (logo) {
            var lw = 150, lh = lw * (logo.height / logo.width);
            ctx.globalAlpha = 0.95;
            ctx.drawImage(logo, padX, H - 60 - lh / 2, lw, lh);
            ctx.globalAlpha = 1;
        }

        /* ---- Talón derecho: QR ---- */
        var cx = stubX + (W - stubX) / 2;

        ctx.fillStyle = GOLD;
        ctx.font = "700 14px 'Montserrat', sans-serif";
        ctx.textAlign = "center";
        ctx.save(); ctx.textAlign = "center"; spacedCentered(ctx, "Nº DE PASE", cx, 96, 3); ctx.restore();

        // QR
        var qrSize = 240;
        var qrCanvas = document.createElement("canvas");
        await window.QRCode.toCanvas(qrCanvas, String(data.codigo || ""), {
            margin: 1, width: qrSize,
            color: { dark: "#08152e", light: "#ffffff" },
            errorCorrectionLevel: "M"
        });
        var qx = cx - qrSize / 2, qy = 150;
        // marco blanco
        ctx.fillStyle = "#ffffff";
        rr(ctx, qx - 16, qy - 16, qrSize + 32, qrSize + 32, 18); ctx.fill();
        ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);

        // Código bajo el QR
        ctx.fillStyle = PEARL;
        ctx.font = "700 30px 'Montserrat', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(data.codigo || "", cx, qy + qrSize + 70);

        ctx.fillStyle = "rgba(243,234,211,0.6)";
        ctx.font = "500 14px 'Montserrat', sans-serif";
        ctx.fillText("Presentá este código en el ingreso", cx, qy + qrSize + 100);

        // Flourish script
        ctx.fillStyle = GOLD_L;
        ctx.font = "400 38px 'Great Vibes', cursive";
        ctx.fillText("¡Bienvenido/a a bordo!", cx, H - 70);

        ctx.textAlign = "left";
        return canvas;
    }

    function drawCorner(ctx, x, y, sx, sy) {
        ctx.save();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + sx * 26, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 26);
        ctx.stroke(); ctx.restore();
    }

    function spaced(ctx, text, x, y, sp) {
        var cx = x;
        for (var i = 0; i < text.length; i++) {
            ctx.fillText(text[i], cx, y);
            cx += ctx.measureText(text[i]).width + sp;
        }
    }
    function spacedCentered(ctx, text, centerX, y, sp) {
        var total = 0, i;
        for (i = 0; i < text.length; i++) total += ctx.measureText(text[i]).width + sp;
        total -= sp;
        var cx = centerX - total / 2;
        var prev = ctx.textAlign; ctx.textAlign = "left";
        for (i = 0; i < text.length; i++) {
            ctx.fillText(text[i], cx, y);
            cx += ctx.measureText(text[i]).width + sp;
        }
        ctx.textAlign = prev;
    }

    function detalle(ctx, x, y, label, value, maxW) {
        ctx.textAlign = "left";
        ctx.fillStyle = GOLD;
        ctx.font = "700 13px 'Montserrat', sans-serif";
        ctx.save(); spaced(ctx, label, x, y, 2); ctx.restore();
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 26px 'Montserrat', sans-serif";
        fitText(ctx, String(value), x, y + 34, maxW || 250, 26);
    }

    // Reduce el tamaño de fuente si el texto no entra en maxW
    function fitText(ctx, text, x, y, maxW, baseSize) {
        var size = baseSize;
        var family = ctx.font.replace(/^[^p]*px/, "").trim();
        var weight = ctx.font.split(" ")[0];
        while (size > 12) {
            ctx.font = weight + " " + size + "px " + family;
            if (ctx.measureText(text).width <= maxW) break;
            size -= 2;
        }
        ctx.fillText(text, x, y);
    }

    /* Genera un PDF (jsPDF) a partir del canvas */
    function aPDF(canvas, codigo) {
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({ orientation: "landscape", unit: "px", format: [W, H] });
        doc.addImage(canvas.toDataURL("image/png", 1), "PNG", 0, 0, W, H);
        return doc;
    }

    /* API pública */
    return {
        /* Devuelve { canvas, pngDataUrl, pdf } */
        construir: async function (data) {
            var canvas = await dibujar(data);
            return {
                canvas: canvas,
                pngDataUrl: canvas.toDataURL("image/png", 1),
                pdf: aPDF(canvas, data.codigo)
            };
        },
        descargarPDF: function (pdf, codigo) {
            pdf.save("credencial-" + (codigo || "maravillas") + ".pdf");
        },
        compartir: async function (pdf, codigo, evento) {
            var blob = pdf.output("blob");
            var file = new File([blob], "credencial-" + (codigo || "maravillas") + ".pdf", { type: "application/pdf" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: "Mi credencial",
                        text: "Mi pase de embarque para " + (evento || "la charla")
                    });
                    return true;
                } catch (e) { return false; }
            }
            // Fallback: descargar
            pdf.save("credencial-" + (codigo || "maravillas") + ".pdf");
            return false;
        }
    };
})();
