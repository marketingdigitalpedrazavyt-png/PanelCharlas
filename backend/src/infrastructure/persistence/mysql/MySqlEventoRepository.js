const { EventoRepository } = require("../../../domain/ports/repositories");
const { pool } = require("./pool");

function map(row) {
  if (!row) return null;
  return {
    id: row.id,
    dia: row.dia,          // 'yyyy-mm-dd' (dateStrings)
    hora: row.hora,
    lugar: row.lugar || "",
    direccion: row.direccion,
    barrio: row.barrio,
    vendedor: row.vendedor || "",
    activo: !!row.activo,
  };
}

class MySqlEventoRepository extends EventoRepository {
  async crear(evento) {
    const [res] = await pool.query(
      `INSERT INTO eventos (dia, hora, lugar, direccion, barrio, vendedor, activo)
       VALUES (:dia, :hora, :lugar, :direccion, :barrio, :vendedor, :activo)`,
      {
        dia: evento.dia, hora: evento.hora, lugar: evento.lugar || null,
        direccion: evento.direccion, barrio: evento.barrio,
        vendedor: evento.vendedor || null, activo: evento.activo ? 1 : 0,
      }
    );
    return { ...evento, id: res.insertId };
  }

  async actualizar(id, evento) {
    // No toca "activo" (se preserva el estado actual)
    const [res] = await pool.query(
      `UPDATE eventos SET dia = :dia, hora = :hora, lugar = :lugar,
              direccion = :direccion, barrio = :barrio, vendedor = :vendedor
       WHERE id = :id`,
      {
        id, dia: evento.dia, hora: evento.hora, lugar: evento.lugar || null,
        direccion: evento.direccion, barrio: evento.barrio, vendedor: evento.vendedor || null,
      }
    );
    return res.affectedRows > 0 ? { ...evento, id: Number(id) } : null;
  }

  async listar() {
    const [rows] = await pool.query("SELECT * FROM eventos ORDER BY dia, hora");
    return rows.map(map);
  }

  async listarActivos() {
    const [rows] = await pool.query("SELECT * FROM eventos WHERE activo = 1 ORDER BY dia, hora");
    return rows.map(map);
  }

  async buscarPorId(id) {
    const [rows] = await pool.query("SELECT * FROM eventos WHERE id = :id LIMIT 1", { id });
    return map(rows[0]);
  }

  async eliminar(id) {
    const [res] = await pool.query("DELETE FROM eventos WHERE id = :id", { id });
    return res.affectedRows > 0;
  }
}

module.exports = { MySqlEventoRepository };
