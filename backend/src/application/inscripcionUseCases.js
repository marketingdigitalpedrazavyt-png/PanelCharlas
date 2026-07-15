const { crearInscripcion, celularAWhatsApp } = require("../domain/model/Inscripcion");
const { etiquetaEvento } = require("../domain/model/Evento");
const { ValidationError, NotFoundError } = require("../domain/errors");

function datosCredencial(insc, evento) {
  return {
    codigo: insc.codigo,
    nombre: insc.nombre,
    apellido: insc.apellido,
    dni: insc.dni,
    evento: evento
      ? { dia: evento.dia, hora: evento.hora, lugar: evento.lugar, direccion: evento.direccion, barrio: evento.barrio }
      : {},
  };
}

class CrearInscripcion {
  constructor({ inscripcionRepo, eventoRepo, vendedorRepo, credencial, whatsapp, config }) {
    Object.assign(this, { inscripcionRepo, eventoRepo, vendedorRepo, credencial, whatsapp, config });
  }
  async execute({ nombre, apellido, dni, celular, cjp, email, eventoId, vendedorSlug }) {
    const evento = await this.eventoRepo.buscarPorId(eventoId);
    if (!evento || !evento.activo) throw new ValidationError("El evento elegido no está disponible.");

    // Atribución de vendedor por link
    let vendedorNombre = "Directo", slug = null;
    if (vendedorSlug) {
      const v = await this.vendedorRepo.buscarPorSlug(String(vendedorSlug).toLowerCase());
      slug = v ? v.slug : String(vendedorSlug).toLowerCase();
      vendedorNombre = v ? v.nombre : slug;
    }

    const inscripcion = crearInscripcion({
      nombre, apellido, dni, celular, cjp, email, modalidad: evento.modalidad,
      eventoId: evento.id, vendedorSlug: slug, vendedorNombre,
    });
    const creada = await this.inscripcionRepo.crear(inscripcion); // puede lanzar ConflictError

    // Envío por WhatsApp (best-effort, no bloquea el alta).
    // Los eventos por Zoom NO envían credencial por WhatsApp.
    let whatsapp = { skipped: true };
    if (this.config.whatsappEnabled && evento.modalidad !== "zoom") {
      try {
        const { png } = await this.credencial.generar(datosCredencial(creada, evento));
        const caption =
          `¡Hola ${creada.nombre}! Te dejamos tu credencial para la charla informativa ` +
          `sobre el paquete: Las Maravillas del Mediterráneo. ` +
          `Presentá este código en el ingreso: ${creada.codigo} o mostrá el QR de la credencial. ` +
          `¡Te esperamos!`;
        whatsapp = await this.whatsapp.enviarImagen({
          celularWhatsApp: celularAWhatsApp(creada.celular), caption, png,
        });
      } catch (e) { whatsapp = { ok: false, error: e.message }; }
    }
    return { codigo: creada.codigo, whatsapp, modalidad: evento.modalidad || "presencial" };
  }
}

class ListarInscripciones {
  constructor({ inscripcionRepo }) { this.inscripcionRepo = inscripcionRepo; }
  async execute(filtros = {}) {
    const filas = await this.inscripcionRepo.listar(filtros);
    return filas.map((r) => ({ ...r, eventoLabel: r.evento ? etiquetaEvento(r.evento) : "" }));
  }
}

class EliminarInscripcion {
  constructor({ inscripcionRepo }) { this.inscripcionRepo = inscripcionRepo; }
  async execute(codigo) {
    const ok = await this.inscripcionRepo.eliminar(codigo);
    if (!ok) throw new NotFoundError("No existe esa inscripción.");
    return { ok: true };
  }
}

/** Edita los datos de un inscripto (no cambia código ni asistencia). */
class ActualizarInscripcion {
  constructor({ inscripcionRepo, eventoRepo }) {
    this.inscripcionRepo = inscripcionRepo; this.eventoRepo = eventoRepo;
  }
  async execute(codigo, input) {
    const evento = await this.eventoRepo.buscarPorId(input.eventoId);
    if (!evento) throw new ValidationError("El evento elegido no existe.");
    // Reutiliza la validación del dominio (limpia dni/celular, valida cjp/email según modalidad)
    const v = crearInscripcion({
      nombre: input.nombre, apellido: input.apellido, dni: input.dni,
      celular: input.celular, cjp: input.cjp, email: input.email,
      modalidad: evento.modalidad, eventoId: evento.id,
    });
    const actualizada = await this.inscripcionRepo.actualizar(codigo, {
      nombre: v.nombre, apellido: v.apellido, dni: v.dni,
      celular: v.celular, cjp: v.cjp, email: v.email, eventoId: evento.id,
    });
    if (!actualizada) throw new NotFoundError("No existe esa inscripción.");
    return { ...actualizada, eventoLabel: actualizada.evento ? etiquetaEvento(actualizada.evento) : "" };
  }
}

/** Usado por el escáner (abierto). */
class MarcarAsistencia {
  constructor({ inscripcionRepo }) { this.inscripcionRepo = inscripcionRepo; }
  async execute(codigo) { return this.inscripcionRepo.marcarAsistencia(codigo); }
}

/** Marca o desmarca la asistencia manualmente desde el panel. */
class CambiarAsistencia {
  constructor({ inscripcionRepo }) { this.inscripcionRepo = inscripcionRepo; }
  async execute(codigo, asistio) {
    const row = await this.inscripcionRepo.setAsistencia(codigo, !!asistio);
    if (!row) throw new NotFoundError("No existe esa inscripción.");
    return { ...row, eventoLabel: row.evento ? etiquetaEvento(row.evento) : "" };
  }
}

class ObtenerCredencial {
  constructor({ inscripcionRepo, credencial }) { this.inscripcionRepo = inscripcionRepo; this.credencial = credencial; }
  async execute(codigo, formato = "png") {
    const row = await this.inscripcionRepo.buscarPorCodigo(codigo);
    if (!row) throw new NotFoundError("No existe esa inscripción.");
    const { png, pdf } = await this.credencial.generar(datosCredencial(row, row.evento));
    return formato === "pdf"
      ? { buffer: pdf, mime: "application/pdf", filename: `credencial-${codigo}.pdf` }
      : { buffer: png, mime: "image/png", filename: `credencial-${codigo}.png` };
  }
}

module.exports = {
  CrearInscripcion, ListarInscripciones, EliminarInscripcion, ActualizarInscripcion,
  MarcarAsistencia, CambiarAsistencia, ObtenerCredencial,
};
