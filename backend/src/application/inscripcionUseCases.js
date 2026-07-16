const { crearInscripcion, celularAWhatsApp } = require("../domain/model/Inscripcion");
const { etiquetaEvento } = require("../domain/model/Evento");
const { ValidationError, NotFoundError } = require("../domain/errors");

/** Mensaje con tono de recordatorio (no de reenvío/error). */
function recordatorioCredencial(insc) {
  return (
    `¡Hola ${insc.nombre}! Te recordamos que estás inscripto/a a la charla informativa ` +
    `sobre el paquete Las Maravillas del Mediterráneo. ` +
    `Te dejamos nuevamente tu credencial para el ingreso: presentá el código ${insc.codigo} ` +
    `o mostrá el QR de la credencial. ¡Te esperamos!`
  );
}

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

/** Reenvía la credencial por WhatsApp a un inscripto (acción manual del panel).
 *  Solo aplica a eventos presenciales (los Zoom no llevan credencial). */
class ReenviarCredencial {
  constructor({ inscripcionRepo, credencial, whatsapp }) {
    Object.assign(this, { inscripcionRepo, credencial, whatsapp });
  }
  async execute(codigo) {
    const insc = await this.inscripcionRepo.buscarPorCodigo(codigo);
    if (!insc) throw new NotFoundError("No existe esa inscripción.");
    const evento = insc.evento;
    if (evento && evento.modalidad === "zoom") {
      throw new ValidationError("Los eventos por Zoom no envían credencial por WhatsApp.");
    }
    const { png } = await this.credencial.generar(datosCredencial(insc, evento));
    const caption = recordatorioCredencial(insc);
    const r = await this.whatsapp.enviarImagen({
      celularWhatsApp: celularAWhatsApp(insc.celular), caption, png,
    });
    if (!r || r.ok === false) throw new ValidationError((r && r.error) || "No se pudo enviar por WhatsApp.");
    return { ok: true };
  }
}

/** Búsqueda pública por DNI (para recuperar credencial y para el escáner).
 *  Devuelve datos mínimos, no expone celular/email. */
class BuscarInscripcionesPorDni {
  constructor({ inscripcionRepo }) { this.inscripcionRepo = inscripcionRepo; }
  async execute(dni) {
    const d = String(dni || "").replace(/\D/g, "");
    if (d.length < 7) return [];
    const filas = await this.inscripcionRepo.buscarPorDni(d);
    return filas.map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      apellido: r.apellido,
      asistio: !!r.asistio,
      modalidad: r.evento?.modalidad || "presencial",
      eventoLabel: r.evento ? etiquetaEvento(r.evento) : "",
      dia: r.evento?.dia || "",
      hora: r.evento?.hora || "",
    }));
  }
}

/** Reenvía la credencial por WhatsApp a todos los inscriptos de un evento
 *  presencial (opcionalmente solo a los que aún no asistieron). */
class ReenviarCredencialesEvento {
  constructor({ inscripcionRepo, eventoRepo, credencial, whatsapp }) {
    Object.assign(this, { inscripcionRepo, eventoRepo, credencial, whatsapp });
    this._enCurso = new Set(); // eventoId con un reenvío en proceso
  }
  async execute(eventoId, { soloPendientes = true } = {}) {
    const evento = await this.eventoRepo.buscarPorId(eventoId);
    if (!evento) throw new NotFoundError("No existe ese evento.");
    if (evento.modalidad === "zoom") throw new ValidationError("Los eventos por Zoom no envían credencial por WhatsApp.");

    const key = String(eventoId);
    if (this._enCurso.has(key)) throw new ValidationError("Ya hay un reenvío en curso para este evento. Esperá a que termine.");

    const todas = await this.inscripcionRepo.listar();
    let objetivo = todas.filter((i) => i.evento && i.evento.id === evento.id);
    if (soloPendientes) objetivo = objetivo.filter((i) => !i.asistio);

    // Se envía en SEGUNDO PLANO y ESPACIADO. WAHA es un cliente no oficial:
    // mandar en ráfaga hace que WhatsApp detecte spam y banee el número.
    if (objetivo.length) {
      this._enCurso.add(key);
      this._enviarEspaciado(objetivo, evento).finally(() => this._enCurso.delete(key));
    }
    return { total: objetivo.length, encolados: objetivo.length };
  }

  async _enviarEspaciado(objetivo, evento) {
    const MIN_MS = 8000, MAX_MS = 15000; // pausa aleatoria 8–15 s entre mensajes
    let enviados = 0, fallidos = 0;
    for (let i = 0; i < objetivo.length; i++) {
      const insc = objetivo[i];
      try {
        const { png } = await this.credencial.generar(datosCredencial(insc, evento));
        const caption = recordatorioCredencial(insc);
        const r = await this.whatsapp.enviarImagen({
          celularWhatsApp: celularAWhatsApp(insc.celular), caption, png,
        });
        if (r && r.ok !== false) enviados++; else fallidos++;
      } catch (e) { fallidos++; }
      if (i < objetivo.length - 1) {
        await new Promise((res) => setTimeout(res, MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS))));
      }
    }
    console.log(`[reenvio-masivo] evento ${evento.id}: enviados ${enviados}, fallidos ${fallidos} de ${objetivo.length}`);
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
  MarcarAsistencia, CambiarAsistencia, ReenviarCredencial, ReenviarCredencialesEvento,
  BuscarInscripcionesPorDni, ObtenerCredencial,
};
