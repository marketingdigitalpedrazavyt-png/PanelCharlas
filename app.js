/* =========================================================
   Pedraza · Travesía Mediterránea
   Lógica de formulario (Firebase) + experiencia visual
   ========================================================= */
(function () {
    "use strict";

    /* ---- Audio del video al primer gesto del usuario ---- */
    document.body.addEventListener("click", function () {
        var videoFondo = document.getElementById("video-fondo");
        if (!videoFondo) return;
        videoFondo.muted = false;
        if (videoFondo.paused) {
            videoFondo.play().catch(function (error) {
                console.error("Error al reproducir el video:", error);
            });
        }
    }, { once: true });

    /* ---- Configuración (desde config.js) ---- */
    var CFG = window.APP_CONFIG || {};
    var COL = CFG.coleccion || "inscripciones";

    firebase.initializeApp(CFG.firebase);
    var db = firebase.firestore();

    /* ---- Referencias DOM ---- */
    var formulario = document.getElementById("miFormulario");
    var submitBtn = document.getElementById("submitBtn");
    var loading = document.getElementById("loading");
    var modal = document.getElementById("modal-confirmacion");
    var modalBackdrop = document.getElementById("modal-backdrop");
    var modalGreeting = document.getElementById("modalGreeting");
    var formError = document.getElementById("formError");
    var formErrorText = document.getElementById("formErrorText");
    var credPreview = document.getElementById("credPreview");
    var credSkeleton = document.getElementById("credSkeleton");
    var btnPdf = document.getElementById("btnPdf");
    var btnShare = document.getElementById("btnShare");
    var waStatus = document.getElementById("waStatus");
    var selectEvento = document.getElementById("evento");

    var inputs = {
        nombre: formulario.nombre,
        apellido: formulario.apellido,
        dni: formulario.dni,
        celular: formulario.celular
    };

    /* ---- Carga de eventos en el desplegable ---- */
    var EVENTOS = {}; // id -> datos del evento
    function formatFecha(dia) {
        if (!dia) return "";
        var p = String(dia).split("-");
        return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : dia;
    }
    function etiquetaEvento(ev) {
        var partes = [formatFecha(ev.dia)];
        if (ev.hora) partes.push(ev.hora + " hs");
        if (ev.barrio) partes.push(ev.barrio);
        var base = partes.join(" · ");
        if (ev.lugar) base += " — " + ev.lugar;
        else if (ev.direccion) base += " — " + ev.direccion;
        return base;
    }
    function cargarEventos() {
        db.collection(CFG.coleccionEventos || "eventos").get().then(function (qs) {
            var docs = qs.docs
                .map(function (d) { var x = d.data(); x._id = d.id; return x; })
                .filter(function (x) { return x.activo !== false; });
            docs.sort(function (a, b) { return ((a.dia || "") + (a.hora || "")).localeCompare((b.dia || "") + (b.hora || "")); });

            if (!docs.length) {
                selectEvento.innerHTML = "<option value='' disabled selected>No hay eventos disponibles</option>";
                submitBtn.disabled = true;
                return;
            }
            var html = "<option value='' disabled selected>Elegí un evento…</option>";
            docs.forEach(function (ev) {
                EVENTOS[ev._id] = ev;
                html += "<option value='" + ev._id + "'>" + etiquetaEvento(ev).replace(/</g, "&lt;") + "</option>";
            });
            selectEvento.innerHTML = html;
        }).catch(function (err) {
            console.error("Error al cargar eventos:", err);
            selectEvento.innerHTML = "<option value='' disabled selected>Error al cargar eventos</option>";
        });
    }
    selectEvento.addEventListener("change", function () {
        clearError();
        this.closest(".field").classList.toggle("valid", !!this.value);
        selectEvento.setAttribute("aria-invalid", "false");
    });

    /* ---- Vendedor por link (estilo UTM): ?v=slug ---- */
    var vendorChip = document.getElementById("vendorChip");
    var VENDEDOR = { id: "", nombre: "Directo" };
    function paramVendedor() {
        var p = new URLSearchParams(location.search);
        return (p.get("v") || p.get("vendedor") || p.get("utm_source") || "").trim().toLowerCase();
    }
    function cargarVendedor() {
        var slug = paramVendedor();
        if (!slug) return;
        VENDEDOR = { id: slug, nombre: slug }; // por defecto, el propio slug
        db.collection(CFG.coleccionVendedores || "vendedores").doc(slug).get().then(function (snap) {
            if (snap.exists) VENDEDOR.nombre = snap.data().nombre || slug;
            if (vendorChip) {
                vendorChip.textContent = "Te invitó: " + VENDEDOR.nombre;
                vendorChip.hidden = false;
            }
        }).catch(function (err) { console.warn("No se pudo resolver el vendedor:", err); });
    }

    /* ---- Manejo visual de estados ---- */
    function setLoading(active) {
        loading.classList.toggle("is-active", active);
    }

    function showError(message, field) {
        formErrorText.textContent = message;
        formError.classList.add("show");
        // Marcar y enfocar el campo conflictivo
        Object.keys(inputs).forEach(function (key) {
            inputs[key].setAttribute("aria-invalid", key === field ? "true" : "false");
        });
        if (field && inputs[field]) inputs[field].focus();
    }

    function clearError() {
        formError.classList.remove("show");
        Object.keys(inputs).forEach(function (key) {
            inputs[key].removeAttribute("aria-invalid");
        });
    }

    /* ---- Validación visual + máscaras en vivo (#5 y #6) ---- */
    var fields = {};
    Object.keys(inputs).forEach(function (key) {
        fields[key] = inputs[key].closest(".field");
    });

    function onlyDigits(str) { return str.replace(/\D/g, ""); }

    // Máscara de teléfono: "11 5555 5555"
    function maskPhone(value) {
        var d = onlyDigits(value).slice(0, 11);
        if (d.length <= 2) return d;
        if (d.length <= 6) return d.slice(0, 2) + " " + d.slice(2);
        return d.slice(0, 2) + " " + d.slice(2, 6) + " " + d.slice(6);
    }

    function isValid(key) {
        var v = inputs[key].value.trim();
        if (key === "nombre" || key === "apellido") return v.length >= 2;
        if (key === "dni") return onlyDigits(v).length >= 7;
        if (key === "celular") return onlyDigits(v).length >= 8;
        return false;
    }

    function refreshValidity(key) {
        fields[key].classList.toggle("valid", isValid(key));
    }

    Object.keys(inputs).forEach(function (key) {
        inputs[key].addEventListener("input", function () {
            clearError();
            // Máscaras: el celular se formatea; el DNI queda solo numérico
            if (key === "celular") {
                var atEnd = this.selectionStart === this.value.length;
                this.value = maskPhone(this.value);
                if (atEnd) { this.selectionStart = this.selectionEnd = this.value.length; }
            } else if (key === "dni") {
                this.value = onlyDigits(this.value).slice(0, 9);
            }
            refreshValidity(key);
        });
    });

    cargarEventos();
    cargarVendedor();

    function resetSubmit() {
        submitBtn.disabled = false;
        setLoading(false);
    }

    /* ---- Código único + normalización WhatsApp ---- */
    var ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/1/I para evitar confusión
    function generarCodigo() {
        var s = "";
        var arr = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint32Array(6)) : null;
        for (var i = 0; i < 6; i++) {
            var r = arr ? arr[i] : Math.floor(Math.random() * 1e9);
            s += ABC[r % ABC.length];
        }
        return "MM-" + s;
    }
    async function codigoUnico() {
        for (var intento = 0; intento < 6; intento++) {
            var c = generarCodigo();
            var snap = await db.collection(COL).doc(c).get();
            if (!snap.exists) return c;
        }
        return "MM-" + Date.now().toString(36).toUpperCase();
    }
    // Mejor esfuerzo para WhatsApp Argentina; tu backend debe validar/normalizar.
    function aWhatsApp(telDigits) {
        var d = String(telDigits).replace(/\D/g, "");
        if (d.indexOf("54") === 0) d = d.slice(2);
        if (d.indexOf("0") === 0) d = d.slice(1);
        if (d.indexOf("9") === 0) d = d.slice(1);
        return "549" + d;
    }

    /* ---- Envío del formulario ---- */
    formulario.addEventListener("submit", async function (e) {
        e.preventDefault();
        clearError();

        var nombre = inputs.nombre.value.trim();
        var apellido = inputs.apellido.value.trim();
        var dni = inputs.dni.value.trim();
        var celular = inputs.celular.value.trim();
        var eventoId = selectEvento.value;
        var evento = EVENTOS[eventoId];

        // Validaciones (conservadas y reforzadas con feedback inline)
        if (!eventoId || !evento) {
            showError("Elegí el evento al que vas a asistir.");
            selectEvento.setAttribute("aria-invalid", "true");
            selectEvento.focus();
            return;
        }
        if (nombre.length < 2) { showError("Por favor ingresá tu nombre.", "nombre"); return; }
        if (apellido.length < 2) { showError("Por favor ingresá tu apellido.", "apellido"); return; }
        if (onlyDigits(dni).length < 7) { showError("Ingresá un DNI válido (sin puntos).", "dni"); return; }
        if (onlyDigits(celular).length < 8) { showError("Ingresá un celular válido.", "celular"); return; }

        var dniDigits = onlyDigits(dni);
        var celDigits = onlyDigits(celular);

        submitBtn.disabled = true;
        setLoading(true);

        try {
            // Evitar duplicados del MISMO DNI/celular en el MISMO evento
            // (consulta por campo simple + filtro local: sin índices compuestos)
            var dniSnapshot = await db.collection(COL).where("dni", "==", dniDigits).get();
            if (dniSnapshot.docs.some(function (d) { return d.data().eventoId === eventoId; })) {
                resetSubmit();
                showError("Ese DNI ya está inscripto en este evento.", "dni");
                return;
            }

            var celSnapshot = await db.collection(COL).where("celular", "==", celDigits).get();
            if (celSnapshot.docs.some(function (d) { return d.data().eventoId === eventoId; })) {
                resetSubmit();
                showError("Ese celular ya está inscripto en este evento.", "celular");
                return;
            }

            var codigo = await codigoUnico();
            await db.collection(COL).doc(codigo).set({
                codigo: codigo,
                nombre: nombre,
                apellido: apellido,
                dni: dniDigits,
                celular: celDigits,
                celularWhatsApp: aWhatsApp(celDigits),
                eventoId: eventoId,
                eventoLabel: etiquetaEvento(evento),
                eventoDia: evento.dia || "",
                eventoHora: evento.hora || "",
                eventoLugar: evento.lugar || "",
                eventoDireccion: evento.direccion || "",
                eventoBarrio: evento.barrio || "",
                eventoVendedor: evento.vendedor || "",
                vendedorId: VENDEDOR.id,
                vendedorNombre: VENDEDOR.nombre,
                asistio: false,
                asistioTimestamp: null,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            setLoading(false);
            await mostrarCredencial({
                codigo: codigo, nombre: nombre, apellido: apellido,
                dni: dniDigits, celDigits: celDigits, evento: evento
            });

        } catch (error) {
            console.error("Error al enviar los datos:", error);
            resetSubmit();
            showError("Hubo un error al enviar los datos. Por favor, intentá nuevamente.");
        }
    });

    /* ---- WhatsApp: avisa a TU backend (config.js) ---- */
    async function enviarWhatsApp(payload) {
        var wa = CFG.whatsapp || {};
        if (!wa.habilitado || !wa.endpoint) return { skipped: true };
        var headers = { "Content-Type": "application/json" };
        if (wa.authHeader) headers["Authorization"] = wa.authHeader;
        var resp = await fetch(wa.endpoint, {
            method: "POST", headers: headers, body: JSON.stringify(payload)
        });
        return { ok: resp.ok, status: resp.status };
    }

    /* ---- Mostrar credencial + acciones ---- */
    function openModal(nombre) {
        if (modalGreeting) modalGreeting.textContent = nombre ? "¡Felicitaciones, " + nombre + "!" : "";
        formulario.parentElement.style.display = "none";
        modalBackdrop.classList.add("is-active");
        modal.classList.add("is-active");
        modal.setAttribute("tabindex", "-1");
        modal.focus();
        celebrate();
    }

    async function mostrarCredencial(data) {
        openModal(data.nombre);

        var cred = null;
        try {
            cred = await Credencial.construir({
                codigo: data.codigo, nombre: data.nombre, apellido: data.apellido,
                dni: data.dni, evento: data.evento
            });
            var img = new Image();
            img.className = "cred-img";
            img.alt = "Credencial " + data.codigo;
            img.src = cred.pngDataUrl;
            credPreview.innerHTML = "";
            credPreview.appendChild(img);

            btnPdf.onclick = function () { Credencial.descargarPDF(cred.pdf, data.codigo); };
            btnShare.onclick = function () { Credencial.compartir(cred.pdf, data.codigo, (CFG.evento || {}).nombre); };
        } catch (err) {
            console.error("Error generando la credencial:", err);
            if (credSkeleton) credSkeleton.textContent =
                "Tu inscripción quedó registrada (código " + data.codigo + "), pero no pudimos dibujar la imagen.";
            btnPdf.style.display = "none";
            btnShare.style.display = "none";
        }

        // Aviso a tu backend para el envío por WhatsApp
        if (cred && waStatus) {
            waStatus.textContent = "Enviando tu credencial por WhatsApp…";
            try {
                var ev = data.evento || {};
                var res = await enviarWhatsApp({
                    codigo: data.codigo,
                    nombre: data.nombre,
                    apellido: data.apellido,
                    celular: data.celDigits,
                    celularWhatsApp: aWhatsApp(data.celDigits),
                    paquete: (CFG.evento || {}).nombre,
                    evento: {
                        id: selectEvento.value,
                        label: etiquetaEvento(ev),
                        dia: ev.dia || "", hora: ev.hora || "",
                        lugar: ev.lugar || "", direccion: ev.direccion || "",
                        barrio: ev.barrio || "", vendedor: ev.vendedor || ""
                    },
                    vendedor: { id: VENDEDOR.id, nombre: VENDEDOR.nombre },
                    credencialBase64: cred.pngDataUrl
                });
                if (res.skipped) waStatus.textContent = "Descargá o compartí tu credencial con los botones de arriba.";
                else if (res.ok) waStatus.textContent = "✓ Te enviamos la credencial por WhatsApp.";
                else waStatus.textContent = "No pudimos enviarla por WhatsApp. Descargala con el botón de arriba.";
            } catch (e) {
                waStatus.textContent = "No pudimos enviarla por WhatsApp. Descargala con el botón de arriba.";
            }
        }
    }

    /* =========================================================
       PARTÍCULAS — destellos dorados sobre el mar
       (reutiliza el canvas original, en clave náutica y sutil)
       ========================================================= */
    var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canvas = document.getElementById("fireworks-canvas");
    var ctx = canvas.getContext("2d");
    var motes = [];
    var bursts = [];
    var GOLD = ["#f6e4b0", "#e3c275", "#fff7df", "#c79a44", "#b8893f"];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    function rand(min, max) { return min + Math.random() * (max - min); }

    // Motas flotantes ascendentes, muy tenues
    function spawnMote() {
        motes.push({
            x: rand(0, canvas.width),
            y: canvas.height + 10,
            r: rand(0.6, 2.2),
            vy: rand(0.15, 0.6),
            drift: rand(-0.25, 0.25),
            life: 1,
            decay: rand(0.0012, 0.003),
            color: GOLD[Math.floor(Math.random() * GOLD.length)]
        });
    }

    // Estallido suave de bienvenida al confirmar
    function celebrate() {
        if (prefersReduced) return;
        for (var b = 0; b < 3; b++) {
            var cx = rand(canvas.width * 0.25, canvas.width * 0.75);
            var cy = rand(canvas.height * 0.2, canvas.height * 0.45);
            var count = 26;
            for (var i = 0; i < count; i++) {
                var angle = (Math.PI * 2 * i) / count;
                var speed = rand(1.4, 3.6);
                bursts.push({
                    x: cx, y: cy,
                    dx: Math.cos(angle) * speed,
                    dy: Math.sin(angle) * speed,
                    life: rand(40, 80),
                    r: rand(1.4, 2.6),
                    color: GOLD[Math.floor(Math.random() * GOLD.length)]
                });
            }
        }
    }

    function frame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "lighter";

        if (motes.length < 46 && Math.random() < 0.5) spawnMote();

        for (var i = motes.length - 1; i >= 0; i--) {
            var m = motes[i];
            m.y -= m.vy;
            m.x += m.drift;
            m.life -= m.decay;
            if (m.life <= 0 || m.y < -10) { motes.splice(i, 1); continue; }
            ctx.globalAlpha = Math.max(0, m.life) * 0.5;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fillStyle = m.color;
            ctx.fill();
        }

        for (var j = bursts.length - 1; j >= 0; j--) {
            var p = bursts[j];
            p.x += p.dx;
            p.y += p.dy;
            p.dy += 0.03;
            p.dx *= 0.99;
            p.life -= 1;
            if (p.life <= 0) { bursts.splice(j, 1); continue; }
            ctx.globalAlpha = Math.min(1, p.life / 60) * 0.85;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        rafId = requestAnimationFrame(frame);
    }

    var rafId = null;
    function start() { if (rafId === null) rafId = requestAnimationFrame(frame); }
    function stop() { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

    // Pausar cuando la pestaña no está visible (rendimiento)
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop(); else start();
    });

    if (!prefersReduced) {
        start();
    }
})();
