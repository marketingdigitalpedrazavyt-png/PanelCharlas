const { crearEvento, etiquetaEvento } = require("../domain/model/Evento");
const { NotFoundError } = require("../domain/errors");

/**
 * ¿El evento todavía es seleccionable? Se interpreta su día + hora en horario
 * de Argentina (UTC-3) y se le da 3 h de margen desde el inicio (para
 * inscripciones en la puerta / evento en curso). Pasado ese margen, se oculta
 * del formulario.
 */
const MARGEN_MS = 3 * 60 * 60 * 1000; // 3 horas
function eventoVigente(evento) {
  const t = Date.parse(`${evento.dia}T${evento.hora || "00:00"}:00-03:00`);
  return Number.isNaN(t) ? true : (t + MARGEN_MS) >= Date.now();
}

class CrearEvento {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(input) {
    const evento = crearEvento(input);
    const creado = await this.eventoRepo.crear(evento);
    return { ...creado, etiqueta: etiquetaEvento(creado) };
  }
}

class ActualizarEvento {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(id, input) {
    const evento = crearEvento(input); // reutiliza la validación del dominio
    const actualizado = await this.eventoRepo.actualizar(id, evento);
    if (!actualizado) throw new NotFoundError("No existe ese evento.");
    return { ...actualizado, etiqueta: etiquetaEvento(actualizado) };
  }
}

/** Activa o desactiva un evento (toggle desde el panel). */
class CambiarEstadoEvento {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(id, activo) {
    const ev = await this.eventoRepo.setActivo(id, !!activo);
    if (!ev) throw new NotFoundError("No existe ese evento.");
    return { ...ev, etiqueta: etiquetaEvento(ev) };
  }
}

class ListarEventos {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute() {
    const eventos = await this.eventoRepo.listar();
    return eventos.map((e) => ({ ...e, etiqueta: etiquetaEvento(e) }));
  }
}

/** Activos y NO vencidos (día+hora futuros, hora Argentina), para el
 *  desplegable del formulario público. Los que ya pasaron no aparecen. */
class ListarEventosPublicos {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(modalidad = "presencial") {
    const mod = modalidad === "zoom" ? "zoom" : "presencial";
    const eventos = await this.eventoRepo.listarActivos();
    return eventos
      .filter((e) => (e.modalidad || "presencial") === mod)
      .filter(eventoVigente)
      .map((e) => ({ id: e.id, etiqueta: etiquetaEvento(e) }));
  }
}

class EliminarEvento {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(id) { await this.eventoRepo.eliminar(id); return { ok: true }; }
}

module.exports = { CrearEvento, ActualizarEvento, CambiarEstadoEvento, ListarEventos, ListarEventosPublicos, EliminarEvento };
