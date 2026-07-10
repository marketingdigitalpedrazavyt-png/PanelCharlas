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

  // edición de inscripto
  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState("");

  const esSuper = user?.rol === "superadmin";
  const linkBase = window.location.origin + "/";

  useEffect(() => {
    if (!hasToken()) { setAuthChecked(true); return; }
    api.me().then(setUser).catch(() => { clearToken(); }).finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => { if (user) cargarTodo(); }, [user]);

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
  const eventosDistintos = useMemo(() => [...new Set(inscriptos.map((i) => i.eventoLabel).filter(Boolean))].sort(), [inscriptos]);
  const vendedoresDistintos = useMemo(() => [...new Set(inscriptos.map((i) => i.vendedorNombre || "Directo"))].sort(), [inscriptos]);
  const filtrados = useMemo(() => {
    const t = search.trim().toLowerCase();
    return inscriptos.filter((r) => {
      if (fEvento && (r.eventoLabel || "") !== fEvento) return false;
      if (fVendedor && (r.vendedorNombre || "Directo") !== fVendedor) return false;
      if (!t) return true;
      return `${r.nombre} ${r.apellido} ${r.dni} ${r.celular} ${r.cjp} ${r.codigo} ${r.eventoLabel} ${r.vendedorNombre}`.toLowerCase().includes(t);
    });
  }, [inscriptos, search, fEvento, fVendedor]);

  // Stats reflejan el filtro/búsqueda activos (ej: al filtrar por evento, el total es el de ese evento)
  const asis = filtrados.filter((i) => i.asistio).length;
  const hayFiltro = !!(fEvento || fVendedor || search.trim());

  function filasExport() {
    return filtrados.map((r) => ({
      Nombre: r.nombre, Apellido: r.apellido, DNI: r.dni, Celular: r.celular, Institucion: r.cjp || "",
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
  async function borrarInscripto(codigo) {
    if (!confirm("¿Eliminar este inscripto? Se borra del panel y de la base de datos.")) return;
    try { await api.eliminarInscripcion(codigo); setInscriptos((l) => l.filter((i) => i.codigo !== codigo)); }
    catch (e) { alert("No se pudo eliminar."); }
  }

  function abrirEdicion(r) {
    setEditando(r);
    setEditForm({ nombre: r.nombre, apellido: r.apellido, dni: r.dni, celular: r.celular, cjp: r.cjp || "", eventoId: r.evento?.id || "" });
    setEditError("");
  }
  const setEd = (k) => (e) => setEditForm({ ...editForm, [k]: e.target.value });
  async function guardarEdicion(e) {
    e.preventDefault(); setEditError("");
    if (!editForm.eventoId) return setEditError("Elegí un evento.");
    try {
      await api.actualizarInscripcion(editando.codigo, {
        nombre: editForm.nombre, apellido: editForm.apellido, dni: editForm.dni,
        celular: editForm.celular, cjp: editForm.cjp, eventoId: Number(editForm.eventoId),
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
        {["inscriptos", "eventos", "vendedores"].concat(esSuper ? ["usuarios"] : []).map((t) => (
          <button key={t} className={"tab" + (tab === t ? " is-active" : "")} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "inscriptos" && (
        <div className="tab-panel is-active">
          <div className="stats">
            <div className="stat stat--accent"><b>{filtrados.length}</b><span>{hayFiltro ? "Inscriptos (filtrado)" : "Inscriptos"}</span></div>
            <div className="stat"><b>{asis}</b><span>Asistieron</span></div>
            <div className="stat"><b>{filtrados.length - asis}</b><span>Pendientes</span></div>
            <div className="stat"><b>{eventos.filter((e) => e.activo).length}</b><span>Eventos activos</span></div>
          </div>
          <div className="toolbar">
            <input className="input" type="search" placeholder="Buscar por nombre, DNI, código…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input select" value={fEvento} onChange={(e) => setFEvento(e.target.value)}>
              <option value="">Todos los eventos</option>{eventosDistintos.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="input select" value={fVendedor} onChange={(e) => setFVendedor(e.target.value)}>
              <option value="">Todos los vendedores</option>{vendedoresDistintos.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <button className="btn btn--ghost btn--sm" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn btn--ghost btn--sm" onClick={exportXLSX}>Exportar Excel</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Nombre</th><th>DNI</th><th>Celular</th><th>Institución</th><th>Evento</th><th>Día / Hora</th><th>Vendedor</th><th>Código</th><th>Asistió</th><th>Acciones</th></tr></thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.codigo}>
                    <td>{r.nombre} {r.apellido}</td><td>{r.dni}</td><td>{r.celular}</td>
                    <td>{r.cjp}</td>
                    <td>{r.evento?.lugar || r.evento?.barrio || r.eventoLabel}</td>
                    <td>{fmtFecha(r.evento?.dia)}{r.evento?.hora ? " · " + r.evento.hora : ""}</td>
                    <td>{r.vendedorNombre || "Directo"}</td><td>{r.codigo}</td>
                    <td>{r.asistio ? <span className="badge badge--yes">Sí</span> : <span className="badge badge--no">No</span>}</td>
                    <td><div className="td-actions">
                      <button className="btn btn--ghost btn--sm" onClick={() => abrirEdicion(r)}>Editar</button>
                      <a className="btn btn--ghost btn--sm" href={api.credencialPdf(r.codigo)} target="_blank" rel="noreferrer">PDF</a>
                      <button className="btn btn--danger btn--sm" onClick={() => borrarInscripto(r.codigo)}>Borrar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtrados.length && <p className="empty">{inscriptos.length ? "Sin resultados." : "Sin inscriptos todavía."}</p>}
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
              <label>Institución <span className="req">*</span><input className="input" value={editForm.cjp} onChange={setEd("cjp")} /></label>
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

      {tab === "eventos" && <EventosTab eventos={eventos} onChange={cargarTodo} />}
      {tab === "vendedores" && <VendedoresTab vendedores={vendedores} linkBase={linkBase} onChange={cargarTodo} />}
      {tab === "usuarios" && esSuper && <UsuariosTab usuarios={usuarios} onChange={cargarTodo} />}
    </div>
  );
}

/* ================= Eventos ================= */
function EventosTab({ eventos, onChange }) {
  const VACIO = { dia: "", hora: "", lugar: "", direccion: "", barrio: "", vendedor: "" };
  const [f, setF] = useState(VACIO);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function editar(ev) {
    setEditId(ev.id);
    setF({ dia: ev.dia || "", hora: ev.hora || "", lugar: ev.lugar || "", direccion: ev.direccion || "", barrio: ev.barrio || "", vendedor: ev.vendedor || "" });
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
            <label>Día <span className="req">*</span><input className="input" type="date" value={f.dia} onChange={set("dia")} /></label>
            <label>Hora <span className="req">*</span><input className="input" type="time" value={f.hora} onChange={set("hora")} /></label>
          </div>
          <label>Lugar <span className="hint">(opcional)</span><input className="input" value={f.lugar} onChange={set("lugar")} placeholder="Ej: Hotel Alvear" /></label>
          <label>Dirección <span className="req">*</span><input className="input" value={f.direccion} onChange={set("direccion")} placeholder="Ej: Av. Alvear 1891" /></label>
          <div className="form-2">
            <label>Barrio <span className="req">*</span><input className="input" value={f.barrio} onChange={set("barrio")} placeholder="Ej: Recoleta" /></label>
            <label>Vendedor a cargo <span className="hint">(opcional)</span><input className="input" value={f.vendedor} onChange={set("vendedor")} /></label>
          </div>
          <p className="msg-error">{error}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn--primary">{editId ? "Guardar cambios" : "Crear evento"}</button>
            {editId && <button type="button" className="btn btn--ghost" onClick={cancelar}>Cancelar</button>}
          </div>
        </form>
      </div>
      <div className="card">
        <h2>Eventos creados</h2>
        <div className="list">
          {eventos.length ? eventos.map((ev) => (
            <div className="list-item" key={ev.id} style={editId === ev.id ? { borderColor: "rgba(255,255,255,0.5)" } : null}>
              <div className="list-item__info"><strong>{ev.etiqueta}</strong><span>{ev.direccion}{ev.barrio ? " · " + ev.barrio : ""}{ev.vendedor ? " · A cargo: " + ev.vendedor : ""}</span></div>
              <button className="btn btn--ghost btn--sm" onClick={() => editar(ev)}>Editar</button>
              <button className="icon-btn" onClick={() => borrar(ev.id)}>✕</button>
            </div>
          )) : <p className="empty">Todavía no creaste ningún evento.</p>}
        </div>
      </div>
    </div>
  );
}

/* ================= Vendedores ================= */
function VendedoresTab({ vendedores, linkBase, onChange }) {
  const [f, setF] = useState({ nombre: "", slug: "" });
  const [error, setError] = useState("");
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
        <div className="list">
          {vendedores.length ? vendedores.map((v) => {
            const link = `${linkBase}?v=${encodeURIComponent(v.slug)}`;
            return (
              <div className="list-item" key={v.id}>
                <div className="list-item__info"><strong>{v.nombre}</strong><span>{link}</span></div>
                <button className="btn btn--ghost btn--sm" onClick={(e) => copiar(link, e)}>Copiar</button>
                <button className="icon-btn" onClick={() => borrar(v.id)}>✕</button>
              </div>
            );
          }) : <p className="empty">Todavía no creaste ningún vendedor.</p>}
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
