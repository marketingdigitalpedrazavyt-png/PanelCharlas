/** Configuración leída de variables de entorno (una sola fuente de verdad). */
module.exports = {
  port: parseInt(process.env.PORT || "4000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",

  db: {
    host: process.env.DB_HOST || "mysql",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    database: process.env.DB_NAME || "maravillas",
    user: process.env.DB_USER || "maravillas",
    password: process.env.DB_PASSWORD || "maravillas",
  },

  superadmin: {
    email: (process.env.SUPERADMIN_EMAIL || "cm@pedraza.com.ar").trim().toLowerCase(),
    password: process.env.SUPERADMIN_PASSWORD || "",
  },

  paqueteNombre: process.env.PAQUETE_NOMBRE || "Maravillas del Mediterráneo",
  paqueteBajada: process.env.PAQUETE_BAJADA || "Charla informativa exclusiva",

  whatsappEnabled: String(process.env.WHATSAPP_ENABLED || "false") === "true",
  waha: {
    url: process.env.WAHA_URL || "http://waha:3000",
    apiKey: process.env.WAHA_API_KEY || "",
    session: process.env.WAHA_SESSION || "default",
  },
};
