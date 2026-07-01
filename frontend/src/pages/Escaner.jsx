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

export default function Escaner() {
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const busy = useRef(false);
  const last = useRef({ code: null, t: 0 });

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
    </div>
  );
}
