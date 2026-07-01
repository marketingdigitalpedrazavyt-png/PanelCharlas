/**
 * Puertos de persistencia (repositorios). El dominio depende de estas
 * interfaces; la infraestructura (MySQL) las implementa.
 */

class UsuarioRepository {
  /** @returns {Promise<object|null>} */ async buscarPorEmail(email) { noimpl(); }
  /** @returns {Promise<object>} */      async guardar(usuario) { noimpl(); }
  /** @returns {Promise<object[]>} */    async listar() { noimpl(); }
  /** @returns {Promise<number>} */      async contar() { noimpl(); }
}

class EventoRepository {
  async crear(evento) { noimpl(); }
  async actualizar(id, evento) { noimpl(); }
  async listar() { noimpl(); }
  async listarActivos() { noimpl(); }
  async buscarPorId(id) { noimpl(); }
  async eliminar(id) { noimpl(); }
}

class VendedorRepository {
  async crear(vendedor) { noimpl(); }
  async listar() { noimpl(); }
  async buscarPorSlug(slug) { noimpl(); }
  async eliminar(id) { noimpl(); }
}

class InscripcionRepository {
  async crear(inscripcion) { noimpl(); }        // devuelve la fila creada
  async listar(filtros) { noimpl(); }           // con datos del evento (join)
  async buscarPorCodigo(codigo) { noimpl(); }
  async marcarAsistencia(codigo) { noimpl(); }  // false→true; devuelve estado
  async eliminar(codigo) { noimpl(); }
  async contarAsistencias() { noimpl(); }
}

function noimpl() { throw new Error("Método de puerto no implementado."); }

module.exports = {
  UsuarioRepository, EventoRepository, VendedorRepository, InscripcionRepository,
};
