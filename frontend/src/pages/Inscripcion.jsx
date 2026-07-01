import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import "../styles/form.css";

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
function maskPhone(v) {
  const d = onlyDigits(v).slice(0, 13); // permite prefijo 15 (celular AR)
  if (d.length <= 2) return d;
  if (d.length <= 6) return d.slice(0, 2) + " " + d.slice(2);
  if (d.length <= 10) return d.slice(0, 2) + " " + d.slice(2, 6) + " " + d.slice(6);
  return d.slice(0, 2) + " " + d.slice(2, 4) + " " + d.slice(4, 8) + " " + d.slice(8);
}

export default function Inscripcion() {
  const [eventos, setEventos] = useState(null);      // null = cargando
  const [form, setForm] = useState({ eventoId: "", nombre: "", apellido: "", dni: "", celular: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [vendedor, setVendedor] = useState(null);
  const [result, setResult] = useState(null);         // { codigo, whatsapp }
  const [waMsg, setWaMsg] = useState("");
  const canvasRef = useRef(null);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  // Cargar eventos + resolver vendedor por link
  useEffect(() => {
    api.eventosPublicos().then(setEventos).catch(() => setEventos([]));
    const slug = (params.get("v") || params.get("vendedor") || "").trim().toLowerCase();
    if (slug) api.resolverVendedor(slug).then(setVendedor).catch(() => {});
  }, [params]);

  // Video: activar audio al primer click
  useEffect(() => {
    const onClick = () => {
      const v = document.getElementById("video-fondo");
      if (v) { v.muted = false; if (v.paused) v.play().catch(() => {}); }
    };
    document.body.addEventListener("click", onClick, { once: true });
    return () => document.body.removeEventListener("click", onClick);
  }, []);

  // Partículas doradas
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const GOLD = ["#f6e4b0", "#e3c275", "#fff7df", "#c79a44", "#b8893f"];
    let motes = [], raf = null;
    const rand = (a, b) => a + Math.random() * (b - a);
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    resize(); addEventListener("resize", resize);
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      if (motes.length < 46 && Math.random() < 0.5)
        motes.push({ x: rand(0, canvas.width), y: canvas.height + 10, r: rand(0.6, 2.2), vy: rand(0.15, 0.6), drift: rand(-0.25, 0.25), life: 1, decay: rand(0.0012, 0.003), color: GOLD[(Math.random() * GOLD.length) | 0] });
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]; m.y -= m.vy; m.x += m.drift; m.life -= m.decay;
        if (m.life <= 0 || m.y < -10) { motes.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, m.life) * 0.5;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fillStyle = m.color; ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); };
  }, []);

  const valido = {
    eventoId: !!form.eventoId,
    nombre: form.nombre.trim().length >= 2,
    apellido: form.apellido.trim().length >= 2,
    dni: onlyDigits(form.dni).length >= 7,
    celular: onlyDigits(form.celular).length >= 8,
  };

  function set(campo, valor) {
    if (campo === "celular") valor = maskPhone(valor);
    if (campo === "dni") valor = onlyDigits(valor).slice(0, 9);
    setForm((f) => ({ ...f, [campo]: valor }));
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!valido.eventoId) return setError("Elegí el evento al que vas a asistir.");
    if (!valido.nombre) return setError("Por favor ingresá tu nombre.");
    if (!valido.apellido) return setError("Por favor ingresá tu apellido.");
    if (!valido.dni) return setError("Ingresá un DNI válido (sin puntos).");
    if (!valido.celular) return setError("Ingresá un celular válido.");

    setLoading(true);
    try {
      const r = await api.crearInscripcion({
        nombre: form.nombre.trim(), apellido: form.apellido.trim(),
        dni: onlyDigits(form.dni), celular: onlyDigits(form.celular),
        eventoId: Number(form.eventoId), vendedorSlug: vendedor?.slug || null,
      });
      setResult(r);
      if (r.whatsapp?.ok) setWaMsg("✓ Te enviamos la credencial por WhatsApp.");
      else if (r.whatsapp?.skipped) setWaMsg("Descargá o compartí tu credencial con los botones.");
      else setWaMsg("No pudimos enviarla por WhatsApp. Descargala con el botón.");
    } catch (err) {
      setError(err.message || "Hubo un error. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  async function compartir() {
    if (!result) return;
    try {
      const resp = await fetch(api.credencialPdf(result.codigo));
      const blob = await resp.blob();
      const file = new File([blob], `credencial-${result.codigo}.pdf`, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Mi credencial", text: "Mi pase para la charla" });
      } else {
        window.open(api.credencialPdf(result.codigo), "_blank");
      }
    } catch (e) { window.open(api.credencialPdf(result.codigo), "_blank"); }
  }

  const field = (campo, label, extra = {}) => (
    <div className={"field" + (valido[campo] && form[campo] ? " valid" : "")}>
      <label htmlFor={campo}>{label}</label>
      <input id={campo} value={form[campo]} onChange={(e) => set(campo, e.target.value)} {...extra} />
      <svg className="field__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
    </div>
  );

  return (
    <>
      <video id="video-fondo" autoPlay muted loop playsInline aria-hidden="true" preload="metadata">
        <source src="/crucero.mp4" type="video/mp4" />
      </video>
      <div className="scene" aria-hidden="true">
        <div className="scene__stars" /><div className="scene__horizon" /><div className="scene__shimmer" />
      </div>
      <div className="waves" aria-hidden="true">
        <svg viewBox="0 0 1440 180" preserveAspectRatio="none">
          <defs>
            <linearGradient id="w1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d4e89" stopOpacity="0.5" /><stop offset="1" stopColor="#051933" stopOpacity="0.9" /></linearGradient>
            <linearGradient id="w2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#103a6b" stopOpacity="0.6" /><stop offset="1" stopColor="#03122a" stopOpacity="0.95" /></linearGradient>
            <linearGradient id="w3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#082244" /><stop offset="1" stopColor="#020c1b" /></linearGradient>
          </defs>
          <path className="wave-layer wave-1" fill="url(#w1)" d="M0,70 C180,30 360,110 720,70 C1080,30 1260,110 1440,70 C1620,30 1800,110 2160,70 C2520,30 2700,110 2880,70 L2880,180 L0,180 Z" />
          <path className="wave-layer wave-2" fill="url(#w2)" d="M0,100 C240,60 480,140 720,100 C960,60 1200,140 1440,100 C1680,60 1920,140 2160,100 C2400,60 2640,140 2880,100 L2880,180 L0,180 Z" />
          <path className="wave-layer wave-3" fill="url(#w3)" d="M0,130 C360,100 540,160 720,130 C900,100 1080,160 1440,130 C1800,100 1980,160 2160,130 C2340,100 2520,160 2880,130 L2880,180 L0,180 Z" />
        </svg>
      </div>
      <div className="scene__vignette" aria-hidden="true" />
      <canvas id="fireworks-canvas" ref={canvasRef} aria-hidden="true" />

      <main className="container">
        <section className="hero">
          <p className="brand"><span className="brand__line" /> Pedraza · Viajes &amp; Turismo</p>
          <span className="hero__eyebrow">Charla informativa</span>
          <h1 className="hero__title">Descubrí las<br /><span className="gilded">Maravillas</span> del Mediterráneo</h1>
          <p className="hero__subtitle">Inscribite a nuestra charla exclusiva y conocé los itinerarios: aguas cristalinas, puertos históricos y atardeceres inolvidables.</p>
          <ul className="trust">
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3 7.2 18.7l.9-5.4L4.2 8.7l5.4-.8Z" /></svg>Charla sin cargo</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3Z" /><path d="M9 4v13M15 7v13" /></svg>Itinerarios exclusivos</li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z" /><circle cx="12" cy="11" r="2.4" /></svg>Cupos limitados</li>
          </ul>
        </section>

        <section className="card-wrap">
          <span className="card-corner tl" /><span className="card-corner tr" /><span className="card-corner bl" /><span className="card-corner br" />
          <form className="formulario" onSubmit={onSubmit} noValidate>
            <div className="form-head">
              <span className="script">Inscribite a la</span>
              <span className="title">Charla</span>
              <span className="subtitle">Elegí el evento, completá tus datos y recibí tu credencial con QR</span>
              {vendedor && <span className="vendor-chip">Te invitó: {vendedor.nombre}</span>}
            </div>

            <div className="field">
              <label htmlFor="evento">Evento al que asistís</label>
              <select id="evento" value={form.eventoId} onChange={(e) => set("eventoId", e.target.value)} required>
                <option value="" disabled>{eventos === null ? "Cargando eventos…" : (eventos.length ? "Elegí un evento…" : "No hay eventos disponibles")}</option>
                {(eventos || []).map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
              </select>
            </div>

            <div className="field-row">
              {field("nombre", "Nombre", { type: "text", placeholder: "Tu nombre", autoComplete: "given-name" })}
              {field("apellido", "Apellido", { type: "text", placeholder: "Tu apellido", autoComplete: "family-name" })}
            </div>
            <div className="field-row">
              {field("dni", "DNI", { type: "text", placeholder: "Ej: 30123456", inputMode: "numeric" })}
              {field("celular", "Celular", { type: "tel", placeholder: "11 15 5555 5555", inputMode: "tel", maxLength: 17 })}
            </div>

            <div className={"form-error" + (error ? " show" : "")} role="alert" aria-live="assertive">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>
              <span>{error}</span>
            </div>

            <button type="submit" id="submitBtn" disabled={loading || (eventos && eventos.length === 0)}>
              Confirmar mi inscripción
            </button>
            <img src="/logopedraza.png" alt="Pedraza Viajes y Turismo" className="logo" />
          </form>
        </section>
      </main>

      {loading && (
        <div className="loading is-active" role="status" aria-live="polite">
          <div className="loading-content">
            <svg className="ship-loader" viewBox="0 0 140 110" aria-hidden="true">
              <g className="smoke"><circle className="puff p1" cx="92" cy="34" r="4" /><circle className="puff p2" cx="92" cy="34" r="3.4" /><circle className="puff p3" cx="92" cy="34" r="4.4" /></g>
              <g className="ship">
                <line className="mast" x1="46" y1="44" x2="46" y2="24" /><path className="flag" d="M46 25 H62 L58 28 L62 31 H46 Z" />
                <rect className="deck" x="52" y="40" width="20" height="11" rx="2" /><rect className="deck" x="40" y="50" width="50" height="14" rx="2" />
                <rect className="funnel" x="86" y="36" width="10" height="18" rx="2" /><rect className="band" x="86" y="40" width="10" height="4" />
                <circle className="port" cx="50" cy="57" r="2" /><circle className="port" cx="60" cy="57" r="2" /><circle className="port" cx="70" cy="57" r="2" /><circle className="port" cx="80" cy="57" r="2" />
                <path className="hull" d="M30 64 H104 L96 80 H40 Z" /><rect className="waterline" x="30" y="62" width="74" height="3.4" rx="1.7" />
              </g>
              <g className="loader-waves">
                <path className="wv wv1" d="M-20 86 q14 -7 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 V110 H-20 Z" />
                <path className="wv wv2" d="M-20 92 q14 -6 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 V110 H-20 Z" />
              </g>
            </svg>
            <div className="loading-text">Zarpando…</div>
          </div>
        </div>
      )}

      {result && (
        <>
          <div className="modal-backdrop is-active" />
          <div className="modal modal--cred is-active" role="dialog" aria-modal="true">
            <div className="cred-head">
              <span className="ticket__badge"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>Inscripción confirmada</span>
              <h2 className="ticket__title">¡Estás <span className="script">a bordo</span>!</h2>
              <p className="ticket__greeting">¡Felicitaciones, {form.nombre}!</p>
            </div>
            <div className="cred-preview">
              <img className="cred-img" src={api.credencialPng(result.codigo)} alt={"Credencial " + result.codigo} />
            </div>
            <div className="cred-actions">
              <a className="cred-btn cred-btn--gold" href={api.credencialPdf(result.codigo)} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Descargar PDF
              </a>
              <button className="cred-btn cred-btn--ghost" type="button" onClick={compartir}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>Compartir
              </button>
            </div>
            <p className="wa-status">{waMsg}</p>
          </div>
        </>
      )}
    </>
  );
}
