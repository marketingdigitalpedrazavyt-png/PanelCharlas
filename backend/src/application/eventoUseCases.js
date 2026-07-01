const { crearEvento, etiquetaEvento } = require("../domain/model/Evento");

class CrearEvento {
  constructor({ eventoRepo }) { this.eventoRepo = eventoRepo; }
  async execute(input) {
    const evento = crearEvento(input);
    const creado = await this.eventoRepo.crear(evento);
    return { ...creado, etiqueta: etiquetaEvento(creado) };
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

module.exports = { CrearEvento, ListarEventos, ListarEventosPublicos, EliminarEvento };
