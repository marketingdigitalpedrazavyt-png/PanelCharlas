/**
 * Puertos de servicios externos (driven ports). La infraestructura
 * provee las implementaciones concretas.
 */

class PasswordHasher {
  /** @returns {Promise<string>} */  async hash(plain) { noimpl(); }
  /** @returns {Promise<boolean>} */ async compare(plain, hash) { noimpl(); }
}

class TokenService {
  /** @returns {string} */  sign(payload) { noimpl(); }
  /** @returns {object} */  verify(token) { noimpl(); }
}

class CredencialGenerator {
  /**
   * @returns {Promise<{ png: Buffer, pdf: Buffer }>}
   * data: { codigo, nombre, apellido, dni, evento:{dia,hora,lugar,direccion,barrio} }
   */
  async generar(data) { noimpl(); }
}

class WhatsAppSender {
  /**
   * Envía una imagen (credencial) por WhatsApp.
   * @returns {Promise<{ ok:boolean, skipped?:boolean, error?:string }>}
   */
  async enviarImagen({ celularWhatsApp, caption, png }) { noimpl(); }
}

function noimpl() { throw new Error("Método de puerto no implementado."); }

module.exports = { PasswordHasher, TokenService, CredencialGenerator, WhatsAppSender };
