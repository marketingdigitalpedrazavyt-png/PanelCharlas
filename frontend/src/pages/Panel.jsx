import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api, setToken, clearToken, hasToken } from "../api.js";
import "../styles/admin.css";

const fmtFecha = (d) => { const p = String(d || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (d || ""); };
const fmtHoraIng = (s) => { if (!s) return ""; const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : String(s); };

export default function Panel() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("inscriptos");

  // login
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // datos
  const [inscriptos, setInscriptos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [usuarios, setUsuarios] = useState({ total: 0, usuarios: [] });

  // filtros inscriptos
  const [search, setSearch] = useState("");
  const [fEvento, setFEvento] = useState("");
  const [fVendedor, setFVendedor] = useState("");
  const [fAsistencia, setFAsistencia] = useState(""); // "", "si", "no"
  const [soloDup, setSoloDup] = useState(false);
  const [orden, setOrden] = useState({ col: "creado", dir: "desc" });

  // La pestaña define la modalidad: "inscriptos" = presencial, "zoom" = zoom
  const modTab = tab === "zoom" ? "zoom" : "presencial";

  // edición de inscripto
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState("");
  const [waSending, setWaSending] = useState(null); // código enviándose por WhatsApp

  const esSuper = user?.rol === "superadmin";
  const linkBase = window.location.origin + "/";

  useEffect(() => {
    if (!hasToken()) { setAuthChecked(true); return; }
    api.me().then(setUser).catch(() => { clearToken(); }).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => { if (user) cargarTodo(); }, [user]);

  // Al cambiar de pestaña, los filtros arrancan limpios
  useEffect(() => { setSearch(""); setFEvento(""); setFVendedor(""); setFAsistencia(""); setSoloDup(false); }, [tab]);

  async function cargarTodo() {
    try {
      const [ins, evs, vds] = await Promise.all([api.listarInscripciones(), api.listarEventos(), api.listarVendedores()]);
      setInscriptos(ins); setEventos(evs); setVendedores(vds);
      if (user?.rol === "superadmin") api.listarUsuarios().then(setUsuarios).catch(() => {});
    } catch (e) { if (String(e.message).includes("401")) logout(); }
  }

  async function login(e) {
    e.preventDefault(); setLoginError(""); setLoginLoading(true);
    try {
      const r = await api.login(email.trim(), pass);
      setToken(r.token); setUser(r.usuario);
    } catch (err) { setLoginError(err.message || "No se pudo iniciar sesión."); }
    finally { setLoginLoading(false); }
  }
  function logout() { clearToken(); setUser(null); }

  /* ---------- Inscriptos: filtros / export ---------- */
  // Duplicados: DNI o celular que aparecen en más de una inscripción (varios eventos)
  const dupInfo = useMemo(() => {
    const dniC = {}, celC = {};
    for (const i of inscriptos) {
      if (i.dni) dniC[i.dni] = (dniC[i.dni] || 0) + 1;
      if (i.celular) celC[i.celular] = (celC[i.celular] || 0) + 1;
    }
    return {
      dni: new Set(Object.keys(dniC).filter((k) => dniC[k] > 1)),
      cel: new Set(Object.keys(celC).filter((k) => celC[k] > 1)),
    };
  }, [inscriptos]);
  const esDup = (r) => dupInfo.dni.has(r.dni) || dupInfo.cel.has(r.celular);

  // Base según la pestaña (presencial o zoom)
  const baseModalidad = useMemo(
    () => inscriptos.filter((i) => (i.evento?.modalidad || "presencial") === modTab),
    [inscriptos, modTab]
  );
  const eventosDistintos = useMemo(() => [...new Set(baseModalidad.map((i) => i.eventoLabel).filter(Boolean))].sort(), [baseModalidad]);
  const vendedoresDistintos = useMemo(() => [...new Set(baseModalidad.map((i) => i.vendedorNombre || "Directo"))].sort(), [baseModalidad]);
  const filtrados = useMemo(() => {
    const t = search.trim().toLowerCase();
    const arr = baseModalidad.filter((r) => {
      if (fEvento && (r.eventoLabel || "") !== fEvento) return false;
      if (fVendedor && (r.vendedorNombre || "Directo") !== fVendedor) return false;
      if (fAsistencia === "si" && !r.asistio) return false;
      if (fAsistencia === "no" && r.asistio) return false;
      if (soloDup && !(dupInfo.dni.has(r.dni) || dupInfo.cel.has(r.celular))) return false;
      if (!t) return true;
      return `${r.nombre} ${r.apellido} ${r.dni} ${r.celular} ${r.cjp} ${r.email} ${r.codigo} ${r.eventoLabel} ${r.vendedorNombre}`.toLowerCase().includes(t);
    });
    const mul = orden.dir === "asc" ? 1 : -1;
    const val = (r) => {
      switch (orden.col) {
        case "nombre": return `${r.nombre} ${r.apellido}`.toLowerCase();
        case "dni": return Number(r.dni) || 0;
        case "evento": return (r.eventoLabel || "").toLowerCase();
        case "fecha": return `${r.evento?.dia || ""} ${r.evento?.hora || ""}`;
        case "vendedor": return (r.vendedorNombre || "").toLowerCase();
        case "asistio": return r.asistio ? 1 : 0;
        default: return r.createdAt || ""; // "creado"
      }
    };
    return [...arr].sort((a, b) => { const va = val(a), vb = val(b); return va < vb ? -mul : va > vb ? mul : 0; });
  }, [baseModalidad, search, fEvento, fVendedor, fAsistencia, soloDup, dupInfo, orden]);

  function ordenarPor(col) {
    setOrden((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));
  }
  const flecha = (col) => (orden.col === col ? (orden.dir === "asc" ? " ▲" : " ▼") : "");

  // Stats reflejan el filtro/búsqueda activos (ej: al filtrar por evento, el total es el de ese evento)
  const asis = filtrados.filter((i) => i.asistio).length;
  const hayFiltro = !!(fEvento || fVendedor || search.trim() || soloDup);
  const dupCount = baseModalidad.filter((r) => dupInfo.dni.has(r.dni) || dupInfo.cel.has(r.celular)).length;

  function filasExport() {
    if (tab === "zoom") {
      return filtrados.map((r) => ({
        Nombre: r.nombre, Apellido: r.apellido, DNI: r.dni, Celular: r.celular, Email: r.email || "",
      }));
    }
    return filtrados.map((r) => ({
      Nombre: r.nombre, Apellido: r.apellido, DNI: r.dni, Celular: r.celular, Institucion: r.cjp || "", Email: r.email || "",
      Evento: r.eventoLabel || "", Dia: fmtFecha(r.evento?.dia), Hora: r.evento?.hora || "",
      Vendedor: r.vendedorNombre || "Directo", Codigo: r.codigo,
      Asistio: r.asistio ? "Si" : "No", HoraIngreso: r.asistio ? fmtHoraIng(r.asistioAt) : "",
    }));
  }
  function exportCSV() {
    const filas = filasExport();
    const headers = Object.keys(filas[0] || { Nombre: "" });
    const csv = [headers, ...filas.map((f) => headers.map((h) => f[h]))]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = "inscriptos-maravillas.csv"; a.click(); URL.revokeObjectURL(url);
  }
  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(filasExport());
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Inscriptos");
    XLSX.writeFile(wb, "inscriptos-maravillas.xlsx");
  }
  async function borrarInscripto(r) {
    if (!confirm(`¿Eliminar a ${r.nombre} ${r.apellido}? Se borra del panel y de la base de datos.`)) return;
    try { await api.eliminarInscripcion(r.codigo); setInscriptos((l) => l.filter((i) => i.codigo !== r.codigo)); }
    catch (e) { alert("No se pudo eliminar."); }
  }
  async function toggleAsistencia(r) {
    try {
      const upd = await api.cambiarAsistencia(r.codigo, !r.asistio);
      setInscriptos((l) => l.map((i) => (i.codigo === r.codigo ? { ...i, asistio: upd.asistio, asistioAt: upd.asistioAt } : i)));
    } catch (e) { alert("No se pudo actualizar la asistencia."); }
  }
  async function reenviarWhatsApp(r) {
    if (waSending) return;
    setWaSending(r.codigo);
    try {
      await api.reenviarCredencial(r.codigo);
      alert(`Credencial reenviada por WhatsApp a ${r.nombre} ${r.apellido}.`);
    } catch (e) { alert("No se pudo reenviar por WhatsApp:\n" + (e.message || "")); }
    finally { setWaSending(null); }
  }

  function abrirEdicion(r) {
    setEditando(r);
    setEditForm({ nombre: r.nombre, apellido: r.apellido, dni: r.dni, celular: r.celular, cjp: r.cjp || "", email: r.email || "", eventoId: r.evento?.id || "" });
    setEditError("");
  }
  const setEd = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });
  async function guardarEdicion(e) {
    e.preventDefault(); setEditError("");
    if (!editForm.eventoId) return setEditError("Elegí un evento.");
    try {
      await api.actualizarInscripcion(editando.codigo, {
        nombre: editForm.nombre, apellido: editForm.apellido, dni: editForm.dni,
        celular: editForm.celular, cjp: editForm.cjp, email: editForm.email, eventoId: Number(editForm.eventoId),
      });
      setEditando(null);
      cargarTodo();
    } catch (err) { setEditError(err.message); }
  }

  if (!authChecked) return <div className="login"><div className="login-card">Cargando…</div></div>;

  /* ---------- LOGIN ---------- */
  if (!user) {
    return (
      <div className="login">
        <form className="login-card" onSubmit={login}>
          <p className="login-brand">Pedraza · Panel</p>
          <h1>Iniciar sesión</h1>
          <p className="sub">Acceso exclusivo del equipo.</p>
          <div className="field"><label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@pedraza.com.ar" autoComplete="username" /></div>
          <div className="field"><label>Contraseña</label>
            <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></div>
          <p className="msg-error">{loginError}</p>
          <button className="btn btn--primary btn--block" disabled={loginLoading}>{loginLoading ? "Ingresando…" : "Ingresar"}</button>
        </form>
      </div>
    );
  }

  /* ---------- APP ---------- */
  return (
    <div className="shell">
      <div className="topbar">
        <div className="topbar__title"><span className="topbar__logo" /><div><h1>Panel de administración</h1><span>Maravillas del Mediterráneo</span></div></div>
        <div className="topbar__user">
          <nav className="pagenav"><a href="/panel" className="is-active">Panel</a><a href="/escaner">Escáner</a></nav>
          <span><b>{user.email}</b></span>
          <button className="btn btn--ghost btn--sm" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="tabs">
        {["resumen", "inscriptos", "zoom", "eventos", "vendedores"].concat(esSuper ? ["usuarios"] : []).map((t) => (
          <button key={t} className={"tab" + (tab === t ? " is-active" : "")} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "resumen" && (
        <ResumenTab
          inscriptos={inscriptos.filter((i) => (i.evento?.modalidad || "presencial") !== "zoom")}
          eventos={eventos.filter((e) => (e.modalidad || "presencial") !== "zoom")}
        />
      )}

      {(tab === "inscriptos" || tab === "zoom") && (
        <div className="tab-panel is-active">
          <div className="stats">
            <div className="stat stat--accent"><b>{filtrados.length}</b><span>{hayFiltro ? (tab === "zoom" ? "Inscriptos Zoom (filtrado)" : "Inscriptos (filtrado)") : (tab === "zoom" ? "Inscriptos Zoom" : "Inscriptos")}</span></div>
            {tab !== "zoom" && <div className="stat"><b>{asis}</b><span>Asistieron</span></div>}
            {tab !== "zoom" && <div className="stat"><b>{filtrados.length - asis}</b><span>Pendientes</span></div>}
            <div className="stat"><b>{eventos.filter((e) => e.activo && (e.modalidad || "presencial") === modTab).length}</b><span>{tab === "zoom" ? "Charlas Zoom activas" : "Eventos activos"}</span></div>
          </div>
          <div className="toolbar">
            <input className="input" type="search" placeholder="Buscar por nombre, DNI, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {tab !== "zoom" && <select className="input select" value={fEvento} onChange={(e) => setFEvento(e.target.value)}>
              <option value="">Todos los eventos</option>{eventosDistintos.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>}
            {tab !== "zoom" && <select className="input select" value={fVendedor} onChange={(e) => setFVendedor(e.target.value)}>
              <option value="">Todos los vendedores</option>{vendedoresDistintos.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>}
            {tab !== "zoom" && <select className="input select" value={fAsistencia} onChange={(e) => setFAsistencia(e.target.value)}>
              <option value="">Asistencia: todos</option>
              <option value="si">Solo asistieron</option>
              <option value="no">Solo pendientes</option>
            </select>}
            <button className={"btn btn--sm " + (soloDup ? "btn--primary" : "btn--ghost")} onClick={() => setSoloDup((v) => !v)} title="Mostrar solo DNI/celular repetidos en varios eventos">Duplicados{dupCount ? ` (${dupCount})` : ""}</button>
            <button className="btn btn--ghost btn--sm" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn btn--ghost btn--sm" onClick={exportXLSX}>Exportar Excel</button>
          </div>
          <div className="table-wrap">
            <table className={"data" + (tab === "zoom" ? " data--narrow" : "")}>
              <thead><tr>
                <th className="th-sort" onClick={() => ordenarPor("nombre")}>Nombre{flecha("nombre")}</th>
                <th className="th-sort" onClick={() => ordenarPor("dni")}>DNI{flecha("dni")}</th>
                <th>Celular</th>{tab === "zoom" ? <th>Email</th> : <th>Institución</th>}
                {tab !== "zoom" && <>
                  <th className="th-sort" onClick={() => ordenarPor("evento")}>Evento{flecha("evento")}</th>
                  <th className="th-sort" onClick={() => ordenarPor("fecha")}>Día / Hora{flecha("fecha")}</th>
                  <th className="th-sort" onClick={() => ordenarPor("vendedor")}>Vendedor{flecha("vendedor")}</th>
                  <th>Código</th>
                  <th className="th-sort" onClick={() => ordenarPor("asistio")}>Asistió{flecha("asistio")}</th>
                </>}
                <th>Acciones</th>
              </tr></thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.codigo}>
                    <td>{r.nombre} {r.apellido}{esDup(r) && <span className="badge badge--dup" style={{ marginLeft: 6 }} title="Mismo DNI o celular en otra inscripción">dup</span>}</td><td>{r.dni}</td><td>{r.celular}</td>
                    {tab === "zoom" ? <td>{r.email}</td> : <td>{r.cjp}</td>}
                    {tab !== "zoom" && <>
                      <td>{r.evento?.modalidad === "zoom" ? "Online (Zoom)" : (r.evento?.lugar || r.evento?.barrio || r.eventoLabel)}</td>
                      <td>{fmtFecha(r.evento?.dia)}{r.evento?.hora ? " · " + r.evento.hora : ""}</td>
                      <td>{r.vendedorNombre || "Directo"}</td><td>{r.codigo}</td>
                      <td>{r.asistio ? <span className="badge badge--yes">Sí</span> : <span className="badge badge--no">No</span>}</td>
                    </>}
                    <td><div className="td-actions">
                      {tab !== "zoom" && (
                        <button className={"btn btn--sm " + (r.asistio ? "btn--ghost" : "btn--primary")} onClick={() => toggleAsistencia(r)}>
                          {r.asistio ? "Quitar asist." : "Marcar asist."}
                        </button>
                      )}
                      <button className="btn btn--ghost btn--sm" onClick={() => abrirEdicion(r)}>Editar</button>
                      {tab !== "zoom" && <a className="btn btn--ghost btn--sm" href={api.credencialPdf(r.codigo)} target="_blank" rel="noreferrer">PDF</a>}
                      {tab !== "zoom" && <button className="btn btn--ghost btn--sm" disabled={waSending === r.codigo} onClick={() => reenviarWhatsApp(r)}>{waSending === r.codigo ? "Enviando…" : "WhatsApp"}</button>}
                      <button className="btn btn--danger btn--sm" onClick={() => borrarInscripto(r)}>Borrar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtrados.length && <p className="empty">{baseModalidad.length ? "Sin resultados." : (tab === "zoom" ? "Sin inscriptos de Zoom todavía." : "Sin inscriptos todavía.")}</p>}
        </div>
      )}

      {editando && (
        <div className="modal-ov" onClick={(e) => { if (e.target === e.currentTarget) setEditando(null); }}>
          <form className="modal-box" onSubmit={guardarEdicion}>
            <h2>Editar inscripto</h2>
            <div className="form-grid">
              <div className="form-2">
                <label>Nombre <span className="req">*</span><input className="input" value={editForm.nombre} onChange={setEd("nombre")} /></label>
                <label>Apellido <span className="req">*</span><input className="input" value={editForm.apellido} onChange={setEd("apellido")} /></label>
              </div>
              <div className="form-2">
                <label>DNI <span className="req">*</span><input className="input" value={editForm.dni} onChange={setEd("dni")} /></label>
                <label>Celular <span className="req">*</span><input className="input" value={editForm.celular} onChange={setEd("celular")} /></label>
              </div>
              <div className="form-2">
                <label>Institución <span className="hint">(presencial)</span><input className="input" value={editForm.cjp} onChange={setEd("cjp")} /></label>
                <label>Correo <span className="hint">(zoom)</span><input className="input" type="email" value={editForm.email} onChange={setEd("email")} /></label>
              </div>
              <label>Evento <span className="req">*</span>
                <select className="input" value={editForm.eventoId} onChange={setEd("eventoId")}>
                  <option value="">Elegí un evento…</option>
                  {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.etiqueta}</option>)}
                </select>
              </label>
            </div>
            <p className="msg-error">{editError}</p>
            <div className="modal-actions">
              <button className="btn btn--primary" type="submit">Guardar cambios</button>
              <button className="btn btn--ghost" type="button" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {tab === "eventos" && <EventosTab eventos={eventos} inscriptos={inscriptos} onChange={cargarTodo} />}
      {tab === "vendedores" && <VendedoresTab vendedores={vendedores} linkBase={linkBase} onChange={cargarTodo} />}
      {tab === "usuarios" && esSuper && <UsuariosTab usuarios={usuarios} onChange={cargarTodo} />}
    </div>
  );
}

/* ================= Resumen (dashboard) ================= */
function ResumenTab({ inscriptos, eventos }) {
  const total = inscriptos.length;
  const asist = inscriptos.filter((i) => i.asistio).length;
  const tasa = total ? Math.round((asist / total) * 100) : 0;
  const activos = eventos.filter((e) => e.activo).length;

  const porEvento = useMemo(() => {
    const m = new Map();
    for (const ev of eventos) m.set(ev.id, { label: ev.etiqueta || ev.lugar || ev.barrio, total: 0, asist: 0 });
    let sinEvento = 0;
    for (const i of inscriptos) {
      const id = i.evento?.id;
      if (id && m.has(id)) { const o = m.get(id); o.total++; if (i.asistio) o.asist++; }
      else sinEvento++;
    }
    const arr = [...m.values()].filter((o) => o.total > 0);
    if (sinEvento) arr.push({ label: "Sin evento", total: sinEvento, asist: 0 });
    return arr.sort((a, b) => b.total - a.total);
  }, [inscriptos, eventos]);

  const porVendedor = useMemo(() => {
    const m = new Map();
    for (const i of inscriptos) { const k = i.vendedorNombre || "Directo"; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n);
  }, [inscriptos]);

  const maxEv = Math.max(1, ...porEvento.map((o) => o.total));
  const maxVe = Math.max(1, ...porVendedor.map((o) => o.n));

  return (
    <div className="tab-panel is-active">
      <div className="stats">
        <div className="stat stat--accent"><b>{total}</b><span>Inscriptos totales</span></div>
        <div className="stat"><b>{asist}</b><span>Asistieron ({tasa}%)</span></div>
        <div className="stat"><b>{total - asist}</b><span>Pendientes</span></div>
        <div className="stat"><b>{activos}/{eventos.length}</b><span>Eventos activos</span></div>
      </div>

      <div className="card">
        <h2>Inscriptos por evento</h2>
        {porEvento.length ? (
          <div className="barlist">
            {porEvento.map((o, idx) => (
              <div className="barrow" key={idx}>
                <div className="barrow__label" title={o.label}>{o.label}</div>
                <div className="bar"><div className="bar__fill" style={{ width: (o.total / maxEv) * 100 + "%" }} /></div>
                <div className="barrow__val">{o.total}<span className="muted"> · {o.asist} asist.</span></div>
              </div>
            ))}
          </div>
        ) : <p className="empty">Sin datos todavía.</p>}
      </div>

      <div className="card">
        <h2>Ranking de vendedores</h2>
        {porVendedor.length ? (
          <div className="barlist">
            {porVendedor.map((o, idx) => (
              <div className="barrow" key={idx}>
                <div className="barrow__label" title={o.nombre}>{idx + 1}. {o.nombre}</div>
                <div className="bar"><div className="bar__fill" style={{ width: (o.n / maxVe) * 100 + "%" }} /></div>
                <div className="barrow__val">{o.n}</div>
              </div>
            ))}
          </div>
        ) : <p className="empty">Sin datos todavía.</p>}
      </div>
    </div>
  );
}

/* ================= Eventos ================= */
function EventosTab({ eventos, inscriptos, onChange }) {
  const VACIO = { dia: "", hora: "", lugar: "", direccion: "", barrio: "", vendedor: "", modalidad: "presencial", enlace: "" };
  const [f, setF] = useState(VACIO);
  const esZoom = f.modalidad === "zoom";
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Conteo de inscriptos (y asistencias) por evento
  const conteo = useMemo(() => {
    const m = {};
    for (const i of inscriptos || []) {
      const id = i.evento?.id;
      if (!id) continue;
      if (!m[id]) m[id] = { total: 0, asist: 0 };
      m[id].total++; if (i.asistio) m[id].asist++;
    }
    return m;
  }, [inscriptos]);

  const eventosFiltrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return eventos;
    return eventos.filter((ev) =>
      `${ev.etiqueta} ${ev.lugar || ""} ${ev.direccion || ""} ${ev.barrio || ""} ${ev.vendedor || ""}`.toLowerCase().includes(t)
    );
  }, [eventos, q]);

  const [reenviando, setReenviando] = useState(null);

  async function toggleActivo(ev) {
    try { await api.cambiarEstadoEvento(ev.id, !ev.activo); onChange(); }
    catch (e) { alert("No se pudo cambiar el estado del evento."); }
  }
  async function reenviarEvento(ev) {
    if (reenviando) return;
    if (!confirm(`¿Reenviar la credencial por WhatsApp a los inscriptos PENDIENTES de:\n${ev.etiqueta}?`)) return;
    setReenviando(ev.id);
    try {
      const r = await api.reenviarEvento(ev.id, true);
      alert(`Reenvío terminado.\nEnviadas: ${r.enviados}\nFallidas: ${r.fallidos}\nTotal pendientes: ${r.total}`);
    } catch (e) { alert("No se pudo reenviar: " + (e.message || "")); }
    finally { setReenviando(null); }
  }

  function editar(ev) {
    setEditId(ev.id);
    setF({ dia: ev.dia || "", hora: ev.hora || "", lugar: ev.lugar || "", direccion: ev.direccion || "", barrio: ev.barrio || "", vendedor: ev.vendedor || "", modalidad: ev.modalidad || "presencial", enlace: ev.enlace || "" });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelar() { setEditId(null); setF(VACIO); setError(""); }

  async function guardar(e) {
    e.preventDefault(); setError("");
    try {
      if (editId) await api.actualizarEvento(editId, f);
      else await api.crearEvento(f);
      cancelar(); onChange();
    } catch (err) { setError(err.message); }
  }
  async function borrar(id) {
    if (!confirm("¿Eliminar este evento?")) return;
    await api.eliminarEvento(id); if (editId === id) cancelar(); onChange();
  }

  return (
    <div className="tab-panel is-active">
      <div className="card">
        <h2>{editId ? "Editar evento" : "Crear evento"}</h2>
        <form className="form-grid" onSubmit={guardar}>
          <div className="form-2">
            <label>Modalidad <span className="req">*</span>
              <select className="input select" value={f.modalidad} onChange={set("modalidad")}>
                <option value="presencial">Presencial</option>
                <option value="zoom">Online (Zoom)</option>
              </select>
            </label>
            <label>Vendedor a cargo <span className="hint">(opcional)</span><input className="input" value={f.vendedor} onChange={set("vendedor")} /></label>
          </div>
          <div className="form-2">
            <label>Día <span className="req">*</span><input className="input" type="date" value={f.dia} onChange={set("dia")} /></label>
            <label>Hora <span className="req">*</span><input className="input" type="time" value={f.hora} onChange={set("hora")} /></label>
          </div>
          {esZoom ? (
            <label>Link de Zoom <span className="hint">(opcional · solo para el panel)</span>
              <input className="input" value={f.enlace} onChange={set("enlace")} placeholder="https://zoom.us/j/…" />
            </label>
          ) : (
            <>
              <label>Lugar <span className="hint">(opcional)</span><input className="input" value={f.lugar} onChange={set("lugar")} placeholder="Ej: Hotel Alvear" /></label>
              <div className="form-2">
                <label>Dirección <span className="req">*</span><input className="input" value={f.direccion} onChange={set("direccion")} placeholder="Ej: Av. Alvear 1891" /></label>
                <label>Barrio <span className="req">*</span><input className="input" value={f.barrio} onChange={set("barrio")} placeholder="Ej: Recoleta" /></label>
              </div>
            </>
          )}
          <p className="msg-error">{error}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn--primary">{editId ? "Guardar cambios" : "Crear evento"}</button>
            {editId && <button type="button" className="btn btn--ghost" onClick={cancelar}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <h2>Eventos creados</h2>
        {eventos.length > 0 && (
          <div className="toolbar">
            <input className="input" type="search" placeholder="Buscar por lugar, dirección, barrio o vendedor…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div className="list">
          {eventosFiltrados.length ? eventosFiltrados.map((ev) => {
            const c = conteo[ev.id] || { total: 0, asist: 0 };
            return (
            <div className={"list-item" + (ev.activo ? "" : " list-item--off")} key={ev.id} style={editId === ev.id ? { borderColor: "rgba(255,255,255,0.5)" } : null}>
              <div className="list-item__info">
                <strong>
                  {ev.modalidad === "zoom" && <span className="badge badge--zoom" style={{ marginRight: 8 }}>Zoom</span>}
                  {ev.etiqueta}
                </strong>
                <span>{ev.modalidad === "zoom"
                  ? (ev.enlace ? "Link: " + ev.enlace : "Online por Zoom") + (ev.vendedor ? " · A cargo: " + ev.vendedor : "")
                  : `${ev.direccion}${ev.barrio ? " · " + ev.barrio : ""}${ev.vendedor ? " · A cargo: " + ev.vendedor : ""}`}</span>
              </div>
              <span className="count-pill" title={`${c.asist} asistieron`}>{c.total} insc.{c.total ? ` · ${c.asist} asist.` : ""}</span>
              <button className={"btn btn--sm " + (ev.activo ? "btn--ghost" : "btn--primary")} onClick={() => toggleActivo(ev)} title="Activar / desactivar para el formulario">
                {ev.activo ? "● Activo" : "○ Inactivo"}
              </button>
              {ev.modalidad !== "zoom" && (
                <button className="btn btn--ghost btn--sm" disabled={reenviando === ev.id} onClick={() => reenviarEvento(ev)} title="Reenviar credencial por WhatsApp a los pendientes">
                  {reenviando === ev.id ? "Enviando…" : "Reenviar WA"}
                </button>
              )}
              <button className="btn btn--ghost btn--sm" onClick={() => editar(ev)}>Editar</button>
              <button className="icon-btn" onClick={() => borrar(ev.id)}>✕</button>
            </div>
            );
          }) : <p className="empty">{eventos.length ? "Sin resultados." : "Todavía no creaste ningún evento."}</p>}
        </div>
      </div>
    </div>
  );
}

/* ================= Vendedores ================= */
function VendedoresTab({ vendedores, linkBase, onChange }) {
  const [f, setF] = useState({ nombre: "", slug: "" });
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const vendedoresFiltrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return vendedores;
    return vendedores.filter((v) => `${v.nombre} ${v.slug}`.toLowerCase().includes(t));
  }, [vendedores, q]);
  async function crear(e) {
    e.preventDefault(); setError("");
    try { await api.crearVendedor(f); setF({ nombre: "", slug: "" }); onChange(); }
    catch (err) { setError(err.message); }
  }
  async function borrar(id) { if (confirm("¿Eliminar este vendedor?")) { await api.eliminarVendedor(id); onChange(); } }
  const copiar = (link, ev) => {
    navigator.clipboard?.writeText(link).then(() => { const b = ev.target; b.textContent = "¡Copiado!"; setTimeout(() => (b.textContent = "Copiar"), 1500); }).catch(() => prompt("Copiá el link:", link));
  };
  return (
    <div className="tab-panel is-active">
      <div className="card">
        <h2>Crear vendedor</h2>
        <p className="sub" style={{ color: "var(--muted)", margin: "-6px 0 14px", fontSize: 13 }}>Cada vendedor tiene un link propio. Quien se inscribe desde ese link queda atribuido automáticamente.</p>
        <form className="form-grid" onSubmit={crear}>
          <label>Nombre del vendedor <span className="req">*</span><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: María González" /></label>
          <label>Código de link <span className="hint">(opcional)</span><input className="input" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="maria-gonzalez" /></label>
          <p className="msg-error">{error}</p>
          <button className="btn btn--primary">Crear vendedor</button>
        </form>
      </div>
      <div className="card">
        <h2>Vendedores y sus links</h2>
        {vendedores.length > 0 && (
          <div className="toolbar">
            <input className="input" type="search" placeholder="Buscar por nombre o código de link…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <div className="list">
          {vendedoresFiltrados.length ? vendedoresFiltrados.map((v) => {
            const link = `${linkBase}?v=${encodeURIComponent(v.slug)}`;
            return (
              <div className="list-item" key={v.id}>
                <div className="list-item__info"><strong>{v.nombre}</strong><span>{link}</span></div>
                <button className="btn btn--ghost btn--sm" onClick={(e) => copiar(link, e)}>Copiar</button>
                <button className="icon-btn" onClick={() => borrar(v.id)}>✕</button>
              </div>
            );
          }) : <p className="empty">{vendedores.length ? "Sin resultados." : "Todavía no creaste ningún vendedor."}</p>}
        </div>
      </div>
    </div>
  );
}

/* ================= Usuarios (superadmin) ================= */
function UsuariosTab({ usuarios, onChange }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function crear(e) {
    e.preventDefault(); setError(""); setOk("");
    try { await api.crearUsuario(f); setOk("Usuario creado: " + f.email); setF({ email: "", password: "" }); onChange(); }
    catch (err) { setError(err.message); }
  }
  return (
    <div className="tab-panel is-active">
      <div className="stats" style={{ gridTemplateColumns: "repeat(2,1fr)", maxWidth: 420 }}>
        <div className="stat stat--accent"><b>{usuarios.total}</b><span>Usuarios</span></div>
        <div className="stat"><b>{usuarios.usuarios.filter((u) => u.rol === "superadmin").length || 1}</b><span>Superadmin</span></div>
      </div>
      <div className="card">
        <h2>Crear usuario</h2>
        <form className="form-grid" onSubmit={crear}>
          <div className="form-2">
            <label>Email <span className="req">*</span><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="persona@pedraza.com.ar" /></label>
            <label>Contraseña <span className="req">*</span><input className="input" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></label>
          </div>
          <p className="msg-error">{error}</p><p className="msg-ok">{ok}</p>
          <button className="btn btn--primary">Crear usuario</button>
        </form>
      </div>
      <div className="card">
        <h2>Usuarios del equipo</h2>
        <div className="list">
          {usuarios.usuarios.length ? usuarios.usuarios.map((u) => (
            <div className="list-item" key={u.email}>
              <div className="list-item__info"><strong>{u.email}</strong></div>
              <span className={"badge " + (u.rol === "superadmin" ? "badge--yes" : "badge--no")}>{u.rol}</span>
            </div>
          )) : <p className="empty">Sin usuarios.</p>}
        </div>
      </div>
    </div>
  );
}
