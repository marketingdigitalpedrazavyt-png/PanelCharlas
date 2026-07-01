const { UsuarioRepository } = require("../../../domain/ports/repositories");
const { pool } = require("./pool");

function map(row) {
  return row ? { id: row.id, email: row.email, passwordHash: row.password_hash, rol: row.rol } : null;
}

class MySqlUsuarioRepository extends UsuarioRepository {
  async buscarPorEmail(email) {
    const [rows] = await pool.query("SELECT * FROM usuarios WHERE email = :email LIMIT 1", { email });
    return map(rows[0]);
  }

  async guardar(usuario) {
    // Upsert: sirve para crear staff y para sembrar el superadmin al arrancar.
    await pool.query(
      `INSERT INTO usuarios (email, password_hash, rol) VALUES (:email, :hash, :rol)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), rol = VALUES(rol)`,
      { email: usuario.email, hash: usuario.passwordHash, rol: usuario.rol }
    );
    return this.buscarPorEmail(usuario.email);
  }

  async listar() {
    const [rows] = await pool.query("SELECT id, email, rol FROM usuarios ORDER BY email");
    return rows.map((r) => ({ id: r.id, email: r.email, rol: r.rol }));
  }

  async contar() {
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM usuarios");
    return rows[0].n;
  }
}

module.exports = { MySqlUsuarioRepository };
