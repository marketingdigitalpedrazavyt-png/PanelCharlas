import { useState } from "react";
import { api } from "../api.js";
import "../styles/form.css";

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

export default function Credencial() {
  const [dni, setDni] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | loading | done
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState("");

  async function buscar(e) {
    e.preventDefault();
    setError("");
    const d = onlyDigits(dni);
    if (d.length < 7) { setError("Ingresá un DNI válido (sin puntos)."); return; }
    setEstado("loading");
    try {
      const r = await api.buscarPorDni(d);
      // Solo presenciales: los eventos por Zoom no tienen credencial.
      setResultados((r || []).filter((x) => x.modalidad !== "zoom"));
      setEstado("done");
    } catch (err) { setError(err.message || "No se pudo buscar."); setEstado("idle"); }
  }

  return (
    <main className="container recuperar">
      <section className="hero">
        <img src="/logopedraza.png" alt="Pedraza Viajes y Turismo" className="hero__logo" />
        <span className="hero__eyebrow">Charla informativa</span>
        <h1 className="hero__title">Recuperá tu <span className="gilded">credencial</span></h1>
        <p className="hero__subtitle">Ingresá tu DNI y te mostramos tu credencial para presentar en el ingreso.</p>
      </section>

      <section className="card-wrap">
        <span className="card-corner tl" /><span className="card-corner tr" /><span className="card-corner bl" /><span className="card-corner br" />
        <form className="formulario" onSubmit={buscar} noValidate>
          <div className="form-head">
            <span className="title">Tu credencial</span>
            <span className="subtitle">Buscá por tu número de documento</span>
          </div>
          <div className="field">
            <label htmlFor="dni">DNI</label>
            <input id="dni" type="text" inputMode="numeric" value={dni}
              onChange={(e) => setDni(onlyDigits(e.target.value).slice(0, 9))} placeholder="Ej: 30123456" />
          </div>
          <div className={"form-error" + (error ? " show" : "")} role="alert" aria-live="assertive">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>
            <span>{error}</span>
          </div>
          <button type="submit" disabled={estado === "loading"}>{estado === "loading" ? "Buscando…" : "Buscar mi credencial"}</button>
        </form>

        {estado === "done" && (
          resultados.length ? (
            <div className="recuperar__list">
              {resultados.map((r) => (
                <div className="recuperar__item" key={r.codigo}>
                  <p className="recuperar__ev">{r.eventoLabel}</p>
                  <img className="cred-img" src={api.credencialPng(r.codigo)} alt={"Credencial " + r.codigo} />
                  <a className="cred-btn cred-btn--gold" href={api.credencialPdf(r.codigo)} target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Descargar PDF
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="recuperar__empty">No encontramos inscripciones presenciales con ese DNI. Revisá el número o volvé a inscribirte.</p>
          )
        )}
      </section>
    </main>
  );
}
