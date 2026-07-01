/* =========================================================
   Maravillas del Mediterráneo · Escáner de ingreso (abierto)
   Sin login. Lee el QR de la credencial y marca asistencia.
   ========================================================= */
(function () {
    "use strict";

    var CFG = window.APP_CONFIG || {};
    if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
    var db = firebase.firestore();
    var COL = CFG.coleccion || "inscripciones";

    function $(id) { return document.getElementById(id); }
    var result = $("result"), resIcon = $("resIcon"), resName = $("resName"),
        resMsg = $("resMsg"), resCode = $("resCode"), countEl = $("count");

    function showResult(type, icon, name, msg, code) {
        result.className = "scan-result show " + type;
        resIcon.textContent = icon;
        resName.textContent = name || "";
        resMsg.textContent = msg || "";
        resCode.textContent = code || "";
    }
    function fmtTime(ts) {
        try {
            var d = ts && ts.toDate ? ts.toDate() : null;
            return d ? d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
        } catch (e) { return ""; }
    }
    function beep(ok) {
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            var ctx = new AC(), o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = "sine"; o.frequency.value = ok ? 880 : 200; g.gain.value = 0.07;
            o.start(); setTimeout(function () { o.stop(); if (ctx.close) ctx.close(); }, ok ? 150 : 260);
        } catch (e) { }
    }

    var busy = false, lastCode = null, lastTime = 0;
    async function onScan(decodedText) {
        var code = String(decodedText || "").trim();
        if (!code || busy) return;
        var now = Date.now();
        if (code === lastCode && now - lastTime < 3000) return;
        lastCode = code; lastTime = now; busy = true;
        try {
            var ref = db.collection(COL).doc(code);
            var snap = await ref.get();
            if (!snap.exists) {
                showResult("err", "✕", "Código inválido", "No corresponde a ninguna inscripción.", code);
                beep(false);
            } else {
                var d = snap.data();
                if (d.asistio) {
                    showResult("warn", "!", (d.nombre || "") + " " + (d.apellido || ""),
                        "Ya había ingresado · " + fmtTime(d.asistioTimestamp), code);
                    beep(false);
                } else {
                    await ref.update({ asistio: true, asistioTimestamp: firebase.firestore.FieldValue.serverTimestamp() });
                    showResult("ok", "✓", (d.nombre || "") + " " + (d.apellido || ""),
                        "¡Bienvenido/a! Asistencia registrada.", code);
                    beep(true);
                    countEl.textContent = (parseInt(countEl.textContent || "0", 10) + 1);
                }
            }
        } catch (e) {
            console.error("Error al registrar asistencia:", e);
            showResult("err", "✕", "Error", "No se pudo registrar. Reintentá.", code);
            beep(false);
        }
        setTimeout(function () { busy = false; }, 1500);
    }

    function startScanner() {
        var html5 = new Html5Qrcode("reader");
        html5.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, function () { })
            .catch(function (err) {
                $("reader").innerHTML = "<p class='scan-hint'>No se pudo abrir la cámara.<br>Verificá los permisos y que la página esté en HTTPS.<br><small>" + err + "</small></p>";
            });
    }

    async function cargarConteo() {
        try {
            var q = await db.collection(COL).where("asistio", "==", true).get();
            countEl.textContent = q.size;
        } catch (e) { countEl.textContent = "0"; }
    }

    cargarConteo();
    startScanner();
})();
