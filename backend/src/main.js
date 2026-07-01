/* =========================================================
   Composition root: cablea dominio + aplicación + infraestructura.
   ========================================================= */
const config = require("./infrastructure/config/env");
const { esperarConexion } = require("./infrastructure/persistence/mysql/pool");

const { MySqlUsuarioRepository } = require("./infrastructure/persistence/mysql/MySqlUsuarioRepository");
const { MySqlEventoRepository } = require("./infrastructure/persistence/mysql/MySqlEventoRepository");
const { MySqlVendedorRepository } = require("./infrastructure/persistence/mysql/MySqlVendedorRepository");
const { MySqlInscripcionRepository } = require("./infrastructure/persistence/mysql/MySqlInscripcionRepository");

const { BcryptPasswordHasher } = require("./infrastructure/auth/BcryptPasswordHasher");
const { JwtTokenService } = require("./infrastructure/auth/JwtTokenService");
const { WahaWhatsAppSender } = require("./infrastructure/whatsapp/WahaWhatsAppSender");
const { CanvasCredencialGenerator } = require("./infrastructure/credencial/CanvasCredencialGenerator");
const { seedSuperadmin } = require("./infrastructure/seed/seedSuperadmin");

const { LoginUsuario, CrearUsuario, ListarUsuarios } = require("./application/authUseCases");
const { CrearEvento, ListarEventos, ListarEventosPublicos, EliminarEvento } = require("./application/eventoUseCases");
const { CrearVendedor, ListarVendedores, EliminarVendedor, ResolverVendedor } = require("./application/vendedorUseCases");
const {
  CrearInscripcion, ListarInscripciones, EliminarInscripcion, MarcarAsistencia, ObtenerCredencial,
} = require("./application/inscripcionUseCases");

const { createServer } = require("./infrastructure/http/server");

async function main() {
  await esperarConexion();

  // Adaptadores (driven)
  const usuarioRepo = new MySqlUsuarioRepository();
  const eventoRepo = new MySqlEventoRepository();
  const vendedorRepo = new MySqlVendedorRepository();
  const inscripcionRepo = new MySqlInscripcionRepository();
  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtTokenService(config.jwtSecret);
  const whatsapp = new WahaWhatsAppSender(config.waha);
  const credencial = new CanvasCredencialGenerator({
    paqueteNombre: config.paqueteNombre, paqueteBajada: config.paqueteBajada,
  });

  await seedSuperadmin({ usuarioRepo, hasher, config });

  // Casos de uso (application)
  const uc = {
    tokens,
    login: new LoginUsuario({ usuarioRepo, hasher, tokens }),
    crearUsuario: new CrearUsuario({ usuarioRepo, hasher }),
    listarUsuarios: new ListarUsuarios({ usuarioRepo }),

    crearEvento: new CrearEvento({ eventoRepo }),
    listarEventos: new ListarEventos({ eventoRepo }),
    listarEventosPublicos: new ListarEventosPublicos({ eventoRepo }),
    eliminarEvento: new EliminarEvento({ eventoRepo }),

    crearVendedor: new CrearVendedor({ vendedorRepo }),
    listarVendedores: new ListarVendedores({ vendedorRepo }),
    eliminarVendedor: new EliminarVendedor({ vendedorRepo }),
    resolverVendedor: new ResolverVendedor({ vendedorRepo }),

    crearInscripcion: new CrearInscripcion({ inscripcionRepo, eventoRepo, vendedorRepo, credencial, whatsapp, config }),
    listarInscripciones: new ListarInscripciones({ inscripcionRepo }),
    eliminarInscripcion: new EliminarInscripcion({ inscripcionRepo }),
    marcarAsistencia: new MarcarAsistencia({ inscripcionRepo }),
    obtenerCredencial: new ObtenerCredencial({ inscripcionRepo, credencial }),
  };

  createServer(uc).listen(config.port, () => {
    console.log(`[http] API escuchando en :${config.port}`);
  });
}

main().catch((e) => { console.error("Fallo al iniciar el backend:", e); process.exit(1); });
