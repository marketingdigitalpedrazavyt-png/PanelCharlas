const { crearEvento, etiquetaEvento } = require("../domain/model/Evento");
const { NotFoundError } = require("../domain/errors");

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

class ListarEventos {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute() {
    const eventos = await this.eventoRepo.listar();
    return eventos.map((e) => ({ ...e, etiqueta: etiquetaEvento(e) }));
  }
}

/** Solo los activos, para el desplegable del formulario público. */
class ListarEventosPublicos {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute() {
    const eventos = await this.eventoRepo.listarActivos();
    return eventos.map((e) => ({ id: e.id, etiqueta: etiquetaEvento(e) }));
  }
}

class EliminarEvento {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(id) { await this.eventoRepo.eliminar(id); return { ok: true }; }
}

module.exports = { CrearEvento, ActualizarEvento, ListarEventos, ListarEventosPublicos, EliminarEvento };
