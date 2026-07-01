/* =========================================================
   Maravillas del Mediterráneo · Panel de administración
   Login (Firebase Auth) + Inscriptos (tabla, PDF, borrar,
   CSV/XLSX) + Eventos + Vendedores + Usuarios (superadmin).
   ========================================================= */
(function () {
    "use strict";

    var CFG = window.APP_CONFIG || {};
    var db = window.Auth.db;
    var COL = CFG.coleccion || "inscripciones";
    var COL_EV = CFG.coleccionEventos || "eventos";
    var COL_V = CFG.coleccionVendedores || "vendedores";
    var COL_U = CFG.coleccionUsuarios || "usuarios";
    // URL base del formulario: usa config.siteUrl si está definida;
    // si no, la detecta según desde dónde se abre el panel.
    var BASE = (CFG.siteUrl && CFG.siteUrl.trim())
        ? CFG.siteUrl.trim()
        : location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }
    function fmtTime(ts) {
        try {
            var d = ts && ts.toDate ? ts.toDate() : null;
            return d ? d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
        } catch (e) { return ""; }
    }
    function formatFecha(dia) {
        if (!dia) return "";
        var p = String(dia).split("-");
        return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : dia;
    }
    function slugify(s) {
        return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    }

    /* =========================================================
       LOGIN / SESIÓN
       ========================================================= */
    var login = $("login"), shell = $("shell");
    var loginForm = $("loginForm"), loginError = $("loginError"), loginBtn = $("loginBtn");
    var started = false;

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        loginError.textContent = "";
        loginBtn.disabled = true; loginBtn.textContent = "Ingresando…";
        try {
            await window.Auth.login($("email").value, $("pass").value);
        } catch (err) {
            loginError.textContent = window.Auth.mensajeError(err);
        } finally {
            loginBtn.disabled = false; loginBtn.textContent = "Ingresar";
        }
    });

    $("logoutBtn").addEventListener("click", function () { window.Auth.logout(); });

    window.Auth.onChange(function (user) {
        if (user) {
            login.style.display = "none";
            shell.style.display = "block";
            $("whoami").innerHTML = "<b>" + esc(user.email) + "</b>";
            if (window.Auth.isSuper(user)) {
                $("tabUsuariosBtn").style.display = "";
                suscribirUsuarios();
            }
            if (!started) { started = true; suscribirInscriptos(); suscribirEventos(); suscribirVendedores(); }
        } else {
            shell.style.display = "none";
            login.style.display = "flex";
        }
    });

    /* ---- Tabs ---- */
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    var panels = Array.prototype.slice.call(document.querySelectorAll(".tab-panel"));
    tabs.forEach(function (t) {
        t.addEventListener("click", function () {
            tabs.forEach(function (x) { x.classList.remove("is-active"); });
            panels.forEach(function (p) { p.classList.remove("is-active"); });
            t.classList.add("is-active");
            $("tab-" + t.getAttribute("data-tab")).classList.add("is-active");
        });
    });

    /* =========================================================
       INSCRIPTOS
       ========================================================= */
    var registros = [];
    var tbody = $("tbody"), empty = $("empty");
    var search = $("search"), filterEvento = $("filterEvento"), filterVendedor = $("filterVendedor");

    function suscribirInscriptos() {
        db.collection(COL).onSnapshot(function (qs) {
            registros = qs.docs.map(function (d) { return d.data(); });
            registros.sort(function (a, b) {
                var ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
                var tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
                return tb - ta;
            });
            renderInscriptos();
        }, function (err) {
            console.error("Error al leer inscriptos:", err);
            empty.style.display = "block";
            empty.textContent = "No se pudieron cargar los datos.";
        });
    }

    function opciones(select, valores, todos) {
        var current = select.value;
        var html = "<option value=''>" + todos + "</option>";
        valores.forEach(function (v) { html += "<option value='" + esc(v) + "'>" + esc(v) + "</option>"; });
        select.innerHTML = html;
        if (current) select.value = current;
    }

    function filtrados() {
        var term = (search.value || "").trim().toLowerCase();
        var evF = filterEvento.value, veF = filterVendedor.value;
        return registros.filter(function (r) {
            if (evF && (r.eventoLabel || "") !== evF) return false;
            if (veF && (r.vendedorNombre || "Directo") !== veF) return false;
            if (!term) return true;
            return ((r.nombre || "") + " " + (r.apellido || "") + " " + (r.dni || "") + " " +
                (r.celular || "") + " " + (r.codigo || "") + " " + (r.eventoLabel || "") + " " +
                (r.vendedorNombre || "")).toLowerCase().indexOf(term) !== -1;
        });
    }

    function renderInscriptos() {
        var evs = {}, ves = {};
        registros.forEach(function (r) {
            if (r.eventoLabel) evs[r.eventoLabel] = true;
            ves[r.vendedorNombre || "Directo"] = true;
        });
        opciones(filterEvento, Object.keys(evs).sort(), "Todos los eventos");
        opciones(filterVendedor, Object.keys(ves).sort(), "Todos los vendedores");

        var total = registros.length;
        var asis = registros.filter(function (r) { return r.asistio; }).length;
        $("stTotal").textContent = total;
        $("stAsis").textContent = asis;
        $("stPend").textContent = total - asis;

        var list = filtrados();
        if (!list.length) {
            tbody.innerHTML = "";
            empty.style.display = "block";
            empty.textContent = total ? "Sin resultados para el filtro/búsqueda." : "Sin inscriptos todavía.";
            return;
        }
        empty.style.display = "none";

        var html = "";
        list.forEach(function (r) {
            var diaHora = (formatFecha(r.eventoDia) + (r.eventoHora ? " · " + r.eventoHora : "")) || "—";
            html += "<tr>" +
                "<td>" + esc((r.nombre || "") + " " + (r.apellido || "")) + "</td>" +
                "<td>" + esc(r.dni || "") + "</td>" +
                "<td>" + esc(r.celular || "") + "</td>" +
                "<td>" + esc(r.eventoLugar || r.eventoBarrio || r.eventoLabel || "") + "</td>" +
                "<td>" + esc(diaHora) + "</td>" +
                "<td>" + esc(r.vendedorNombre || "Directo") + "</td>" +
                "<td>" + esc(r.codigo || "") + "</td>" +
                "<td>" + (r.asistio ? "<span class='badge badge--yes'>Sí</span>" : "<span class='badge badge--no'>No</span>") + "</td>" +
                "<td><div class='td-actions'>" +
                "<button class='btn btn--ghost btn--sm cred-pdf' data-cod='" + esc(r.codigo) + "'>PDF</button>" +
                "<button class='btn btn--danger btn--sm ins-del' data-cod='" + esc(r.codigo) + "'>Borrar</button>" +
                "</div></td>" +
                "</tr>";
        });
        tbody.innerHTML = html;

        Array.prototype.forEach.call(tbody.querySelectorAll(".cred-pdf"), function (b) {
            b.addEventListener("click", function () { credencialPDF(this.getAttribute("data-cod"), this); });
        });
        Array.prototype.forEach.call(tbody.querySelectorAll(".ins-del"), function (b) {
            b.addEventListener("click", function () { borrarInscripto(this.getAttribute("data-cod"), this); });
        });
    }

    search.addEventListener("input", renderInscriptos);
    filterEvento.addEventListener("change", renderInscriptos);
    filterVendedor.addEventListener("change", renderInscriptos);

    function getReg(codigo) {
        for (var i = 0; i < registros.length; i++) if (registros[i].codigo === codigo) return registros[i];
        return null;
    }

    async function borrarInscripto(codigo, btn) {
        var r = getReg(codigo); if (!r) return;
        if (!confirm("¿Eliminar a " + (r.nombre || "") + " " + (r.apellido || "") + "?\nSe borra del panel y de la base de datos.")) return;
        btn.disabled = true; btn.textContent = "…";
        try {
            await db.collection(COL).doc(codigo).delete();
            // onSnapshot refresca la tabla automáticamente
        } catch (e) {
            console.error("Error al borrar:", e);
            alert("No se pudo eliminar.");
            btn.disabled = false; btn.textContent = "Borrar";
        }
    }

    async function credencialPDF(codigo, btn) {
        var r = getReg(codigo); if (!r) return;
        var prev = btn.textContent; btn.disabled = true; btn.textContent = "…";
        try {
            var cred = await Credencial.construir({
                codigo: r.codigo, nombre: r.nombre, apellido: r.apellido, dni: r.dni,
                evento: { dia: r.eventoDia, hora: r.eventoHora, lugar: r.eventoLugar, direccion: r.eventoDireccion, barrio: r.eventoBarrio }
            });
            Credencial.descargarPDF(cred.pdf, r.codigo);
        } catch (e) {
            console.error("Error al generar credencial:", e);
            alert("No se pudo generar la credencial.");
        } finally { btn.disabled = false; btn.textContent = prev; }
    }

    /* ---- Exportaciones ---- */
    function filasExport() {
        return filtrados().map(function (r) {
            return {
                Nombre: r.nombre || "", Apellido: r.apellido || "", DNI: r.dni || "",
                Celular: r.celular || "", Evento: r.eventoLabel || "",
                Dia: formatFecha(r.eventoDia) || "", Hora: r.eventoHora || "",
                Vendedor: r.vendedorNombre || "Directo", Codigo: r.codigo || "",
                Asistio: r.asistio ? "Si" : "No", HoraIngreso: r.asistio ? fmtTime(r.asistioTimestamp) : ""
            };
        });
    }
    $("csvBtn").addEventListener("click", function () {
        var filas = filasExport();
        var headers = Object.keys(filas[0] || { Nombre: "", Apellido: "", DNI: "", Celular: "", Evento: "", Dia: "", Hora: "", Vendedor: "", Codigo: "", Asistio: "", HoraIngreso: "" });
        var rows = [headers].concat(filas.map(function (f) { return headers.map(function (h) { return f[h]; }); }));
        var csv = rows.map(function (row) {
            return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
        }).join("\r\n");
        descargarBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), "inscriptos-maravillas.csv");
    });
    $("xlsxBtn").addEventListener("click", function () {
        if (!window.XLSX) { alert("No se pudo cargar el exportador de Excel."); return; }
        var ws = XLSX.utils.json_to_sheet(filasExport());
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inscriptos");
        XLSX.writeFile(wb, "inscriptos-maravillas.xlsx");
    });
    function descargarBlob(blob, nombre) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = nombre;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* =========================================================
       EVENTOS
       ========================================================= */
    var evForm = $("evForm"), evError = $("evError"), evList = $("evList");
    var evf = { dia: $("ev_dia"), hora: $("ev_hora"), lugar: $("ev_lugar"), direccion: $("ev_direccion"), barrio: $("ev_barrio"), vendedor: $("ev_vendedor") };
    function etiquetaEvento(ev) {
        var partes = [formatFecha(ev.dia)];
        if (ev.hora) partes.push(ev.hora + " hs");
        if (ev.barrio) partes.push(ev.barrio);
        var base = partes.join(" · ");
        if (ev.lugar) base += " — " + ev.lugar; else if (ev.direccion) base += " — " + ev.direccion;
        return base;
    }
    evForm.addEventListener("submit", async function (e) {
        e.preventDefault(); evError.textContent = "";
        if (!evf.dia.value) { evError.textContent = "El día es obligatorio."; return; }
        if (!evf.hora.value) { evError.textContent = "La hora es obligatoria."; return; }
        if (!evf.direccion.value.trim()) { evError.textContent = "La dirección es obligatoria."; return; }
        if (!evf.barrio.value.trim()) { evError.textContent = "El barrio es obligatorio."; return; }
        var btn = evForm.querySelector("button[type=submit]"); btn.disabled = true;
        try {
            await db.collection(COL_EV).add({
                dia: evf.dia.value, hora: evf.hora.value, lugar: evf.lugar.value.trim(),
                direccion: evf.direccion.value.trim(), barrio: evf.barrio.value.trim(),
                vendedor: evf.vendedor.value.trim(), activo: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            evForm.reset();
        } catch (err) { console.error(err); evError.textContent = "No se pudo crear el evento."; }
        finally { btn.disabled = false; }
    });
    function suscribirEventos() {
        db.collection(COL_EV).onSnapshot(function (qs) {
            var evs = qs.docs.map(function (d) { var x = d.data(); x._id = d.id; return x; });
            evs.sort(function (a, b) { return ((a.dia || "") + (a.hora || "")).localeCompare((b.dia || "") + (b.hora || "")); });
            var st = $("stEventos"); if (st) st.textContent = evs.filter(function (e) { return e.activo !== false; }).length;
            if (!evs.length) { evList.innerHTML = "<p class='empty'>Todavía no creaste ningún evento.</p>"; return; }
            var html = "";
            evs.forEach(function (ev) {
                html += "<div class='list-item'><div class='list-item__info'>" +
                    "<strong>" + esc(etiquetaEvento(ev)) + "</strong>" +
                    "<span>" + esc(ev.direccion || "") + (ev.barrio ? " · " + esc(ev.barrio) : "") +
                    (ev.vendedor ? " · A cargo: " + esc(ev.vendedor) : "") + "</span>" +
                    "</div><button class='icon-btn' data-id='" + esc(ev._id) + "' title='Eliminar'>✕</button></div>";
            });
            evList.innerHTML = html;
            borrado(evList, COL_EV, "¿Eliminar este evento? Los ya inscriptos conservan su credencial.");
        }, function (err) { console.error(err); evList.innerHTML = "<p class='empty'>No se pudieron cargar los eventos.</p>"; });
    }

    /* =========================================================
       VENDEDORES
       ========================================================= */
    var vForm = $("vForm"), vError = $("vError"), vList = $("vList");
    async function slugUnico(base) {
        var s = base, n = 1;
        while (n < 50) {
            var snap = await db.collection(COL_V).doc(s).get();
            if (!snap.exists) return s;
            n += 1; s = base + "-" + n;
        }
        return base + "-" + Date.now().toString(36);
    }
    vForm.addEventListener("submit", async function (e) {
        e.preventDefault(); vError.textContent = "";
        var nombre = $("v_nombre").value.trim();
        if (nombre.length < 2) { vError.textContent = "Ingresá el nombre del vendedor."; return; }
        var base = slugify($("v_slug").value || nombre);
        if (!base) { vError.textContent = "El código de link no es válido."; return; }
        var btn = vForm.querySelector("button[type=submit]"); btn.disabled = true;
        try {
            var slug = await slugUnico(base);
            await db.collection(COL_V).doc(slug).set({
                nombre: nombre, slug: slug, activo: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            vForm.reset();
        } catch (err) { console.error(err); vError.textContent = "No se pudo crear el vendedor."; }
        finally { btn.disabled = false; }
    });
    function suscribirVendedores() {
        db.collection(COL_V).onSnapshot(function (qs) {
            var vs = qs.docs.map(function (d) { var x = d.data(); x._id = d.id; return x; });
            vs.sort(function (a, b) { return (a.nombre || "").localeCompare(b.nombre || ""); });
            if (!vs.length) { vList.innerHTML = "<p class='empty'>Todavía no creaste ningún vendedor.</p>"; return; }
            var html = "";
            vs.forEach(function (v) {
                var link = BASE + "?v=" + encodeURIComponent(v.slug);
                html += "<div class='list-item'><div class='list-item__info'>" +
                    "<strong>" + esc(v.nombre) + "</strong>" +
                    "<span title='" + esc(link) + "'>" + esc(link) + "</span>" +
                    "</div>" +
                    "<button class='btn btn--ghost btn--sm vend-copy' data-link='" + esc(link) + "'>Copiar</button>" +
                    "<button class='icon-btn' data-id='" + esc(v._id) + "' title='Eliminar'>✕</button></div>";
            });
            vList.innerHTML = html;
            Array.prototype.forEach.call(vList.querySelectorAll(".vend-copy"), function (b) {
                b.addEventListener("click", function () {
                    var link = this.getAttribute("data-link"), self = this;
                    function ok() { self.textContent = "¡Copiado!"; setTimeout(function () { self.textContent = "Copiar"; }, 1500); }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(link).then(ok).catch(function () { prompt("Copiá el link:", link); });
                    } else { prompt("Copiá el link:", link); }
                });
            });
            borrado(vList, COL_V, "¿Eliminar este vendedor? Las inscripciones ya atribuidas no cambian.");
        }, function (err) { console.error(err); vList.innerHTML = "<p class='empty'>No se pudieron cargar los vendedores.</p>"; });
    }

    function borrado(cont, coleccion, msg) {
        Array.prototype.forEach.call(cont.querySelectorAll(".icon-btn"), function (b) {
            b.addEventListener("click", async function () {
                if (!confirm(msg)) return;
                try { await db.collection(coleccion).doc(this.getAttribute("data-id")).delete(); }
                catch (err) { console.error(err); alert("No se pudo eliminar."); }
            });
        });
    }

    /* =========================================================
       USUARIOS (solo superadmin)
       ========================================================= */
    var uForm = $("uForm"), uError = $("uError"), uOk = $("uOk"), uList = $("uList");
    var usuariosSuscrito = false;

    uForm.addEventListener("submit", async function (e) {
        e.preventDefault(); uError.textContent = ""; uOk.textContent = "";
        var email = $("u_email").value.trim();
        var pass = $("u_pass").value;
        if (!email) { uError.textContent = "Ingresá el email."; return; }
        if ((pass || "").length < 6) { uError.textContent = "La contraseña debe tener al menos 6 caracteres."; return; }
        var btn = uForm.querySelector("button[type=submit]"); btn.disabled = true;
        try {
            await window.Auth.createStaff(email, pass);
            uOk.textContent = "Usuario creado: " + email;
            uForm.reset();
        } catch (err) {
            console.error(err); uError.textContent = window.Auth.mensajeError(err);
        } finally { btn.disabled = false; }
    });

    function suscribirUsuarios() {
        if (usuariosSuscrito) return;
        usuariosSuscrito = true;
        db.collection(COL_U).onSnapshot(function (qs) {
            var us = qs.docs.map(function (d) { return d.data(); });
            us.sort(function (a, b) { return (a.email || "").localeCompare(b.email || ""); });
            $("stUsuarios").textContent = us.length;
            $("stSuper").textContent = us.filter(function (u) { return u.rol === "superadmin"; }).length || 1;
            if (!us.length) { uList.innerHTML = "<p class='empty'>Sin usuarios registrados.</p>"; return; }
            var html = "";
            us.forEach(function (u) {
                var badge = u.rol === "superadmin"
                    ? "<span class='badge badge--yes'>superadmin</span>"
                    : "<span class='badge badge--no'>staff</span>";
                html += "<div class='list-item'><div class='list-item__info'>" +
                    "<strong>" + esc(u.email) + "</strong></div>" + badge + "</div>";
            });
            uList.innerHTML = html;
        }, function (err) { console.error("Error usuarios:", err); uList.innerHTML = "<p class='empty'>No se pudieron cargar los usuarios.</p>"; });
    }
})();
