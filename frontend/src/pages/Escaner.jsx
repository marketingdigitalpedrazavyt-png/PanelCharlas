import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { api } from "../api.js";
import "../styles/admin.css";

const nombre = (i) => `${i?.nombre || ""} ${i?.apellido || ""}`.trim();

function beep(ok) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(), o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = ok ? 880 : 200; g.gain.value = 0.07;
    o.start(); setTimeout(() => { o.stop(); ctx.close?.(); }, ok ? 150 : 260);
  } catch (e) { /* sin sonido */ }
}

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

export default function Escaner() {
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);
  const last = useRef({ code: null, t: 0 });

  // Búsqueda manual por DNI (si el asistente llega sin QR)
  const [dni, setDni] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [manuales, setManuales] = useState(null); // null = sin buscar
  const [manualMsg, setManualMsg] = useState("");

  async function buscarManual(e) {
    e.preventDefault();
    const d = onlyDigits(dni);
    setManualMsg("");
    if (d.length < 7) { setManualMsg("Ingresá un DNI válido."); return; }
    setBuscando(true);
    try {
      const r = await api.buscarPorDni(d);
      setManuales((r || []).filter((x) => x.modalidad !== "zoom"));
    } catch (err) { setManualMsg("No se pudo buscar. Reintentá."); }
    finally { setBuscando(false); }
  }

  async function marcarManual(item) {
    try {
      const r = await api.marcarAsistencia(item.codigo);
      const asistio = r.estado === "ok" || r.estado === "ya";
      setManuales((l) => (l || []).map((x) => (x.codigo === item.codigo ? { ...x, asistio, _estado: r.estado } : x)));
      if (r.estado === "ok") setCount((c) => c + 1);
      beep(r.estado === "ok");
    } catch (e) { setManualMsg("No se pudo marcar. Reintentá."); beep(false); }
  }

  useEffect(() => {
    const html5 = new Html5Qrcode("reader");
    let activo = true;
    html5
      .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, onScan, () => {})
      .catch((err) => {
        const el = document.getElementById("reader");
        if (el) el.innerHTML = `<p class="scan-hint">No se pudo abrir la cámara. Verificá permisos y que la página esté en HTTPS.<br><small>${err}</small></p>`;
      });
    return () => { activo = false; html5.stop().catch(() => {}); };

    async function onScan(text) {
      const code = String(text || "").trim();
      if (!code || busy.current || !activo) return;
      const now = Date.now();
      if (code === last.current.code && now - last.current.t < 3000) return;
      last.current = { code, t: now }; busy.current = true;
      try {
        const r = await api.marcarAsistencia(code);
        if (r.estado === "no-existe") setResult({ type: "err", icon: "✕", name: "Código inválido", msg: "No corresponde a ninguna inscripción.", code });
        else if (r.estado === "ya") setResult({ type: "warn", icon: "!", name: nombre(r.inscripcion), msg: "Ya había ingresado.", code });
        else { setResult({ type: "ok", icon: "✓", name: nombre(r.inscripcion), msg: "¡Bienvenido/a! Asistencia registrada.", code }); setCount((c) => c + 1); }
        beep(r.estado === "ok");
      } catch (e) {
        setResult({ type: "err", icon: "✕", name: "Error", msg: "No se pudo registrar. Reintentá.", code });
        beep(false);
      }
      setTimeout(() => { busy.current = false; }, 1500);
    }
  }, []);

  return (
    <div className="shell">
      <div className="topbar">
        <div className="topbar__title">
          <span className="topbar__logo" />
          <div><h1>Escáner de ingreso</h1><span>Maravillas del Mediterráneo</span></div>
        </div>
        <nav className="pagenav"><a href="/panel">Panel</a><a href="/escaner" className="is-active">Escáner</a></nav>
      </div>

      <div className="card scanner">
        <div id="reader" />
        <p className="scan-hint">Apuntá la cámara al QR de la credencial. El escaneo es automático.</p>
        {result && (
          <div className={"scan-result show " + result.type}>
            <div className="res-icon">{result.icon}</div>
            <p className="res-name">{result.name}</p>
            <p className="res-msg">{result.msg}</p>
            <p className="res-code">{result.code}</p>
          </div>
        )}
        <p className="scan-count">Asistencias registradas: <strong>{count}</strong></p>
      </div>

      <div className="card scanner">
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>¿Llegó sin QR?</h2>
        <p className="scan-hint" style={{ marginTop: 0 }}>Buscá por DNI y marcá el ingreso manualmente.</p>
        <form onSubmit={buscarManual} className="toolbar" style={{ marginTop: 10 }}>
          <input className="input" type="text" inputMode="numeric" placeholder="DNI (sin puntos)"
            value={dni} onChange={(e) => setDni(onlyDigits(e.target.value).slice(0, 9))} />
          <button className="btn btn--primary btn--sm" disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button>
        </form>
        {manualMsg && <p className="scan-hint" style={{ color: "#ff9ea1" }}>{manualMsg}</p>}
        {manuales && (
          manuales.length ? (
            <div className="list" style={{ marginTop: 12 }}>
              {manuales.map((m) => (
                <div className="list-item" key={m.codigo}>
                  <div className="list-item__info">
                    <strong>{m.nombre} {m.apellido}</strong>
                    <span>{m.eventoLabel}</span>
                  </div>
                  {m.asistio
                    ? <span className="badge badge--yes">{m._estado === "ok" ? "¡Ingresó!" : "Ya ingresó"}</span>
                    : <button className="btn btn--primary btn--sm" onClick={() => marcarManual(m)}>Marcar ingreso</button>}
                </div>
              ))}
            </div>
          ) : <p className="scan-hint" style={{ marginTop: 12 }}>No hay inscriptos presenciales con ese DNI.</p>
        )}
      </div>
    </div>
  );
}
