const { VendedorRepository } = require("../../../domain/ports/repositories");
const { pool } = require("./pool");

function map(row) {
  return row ? { id: row.id, slug: row.slug, nombre: row.nombre, activo: !!row.activo } : null;
}

class MySqlVendedorRepository extends VendedorRepository {
  async crear(vendedor) {
    const [res] = await pool.query(
      "INSERT INTO vendedores (slug, nombre, activo) VALUES (:slug, :nombre, :activo)",
      { slug: vendedor.slug, nombre: vendedor.nombre, activo: vendedor.activo ? 1 : 0 }
    );
    return { ...vendedor, id: res.insertId };
  }

  async listar() {
    const [rows] = await pool.query("SELECT * FROM vendedores ORDER BY nombre");
    return rows.map(map);
  }

  async buscarPorSlug(slug) {
    const [rows] = await pool.query("SELECT * FROM vendedores WHERE slug = :slug LIMIT 1", { slug });
    return map(rows[0]);
  }

  async eliminar(id) {
    const [res] = await pool.query("DELETE FROM vendedores WHERE id = :id", { id });
    return res.affectedRows > 0;
  }
}

module.exports = { MySqlVendedorRepository };
