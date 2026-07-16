const mysql = require("mysql2/promise");
const config = require("../../config/env");

/** Pool de conexiones MySQL compartido por los repositorios. */
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4_unicode_ci",
  namedPlaceholders: true,
  dateStrings: true, // DATE/DATETIME como string (sin conversión de TZ)
});

/** Espera a que MySQL esté disponible (arranque del contenedor). */
async function esperarConexion(reintentos = 60, esperaMs = 2000) {
  for (let i = 1; i <= reintentos; i++) {
    try { await pool.query("SELECT 1"); return; }
    catch (e) {
      console.log(`[db] esperando MySQL (${i}/${reintentos})…`);
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
  throw new Error("No se pudo conectar a MySQL.");
}

module.exports = { pool, esperarConexion };
