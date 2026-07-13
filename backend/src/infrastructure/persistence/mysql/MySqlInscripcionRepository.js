const { InscripcionRepository } = require("../../../domain/ports/repositories");
const { ConflictError } = require("../../../domain/errors");
const { pool } = require("./pool");

/** Mapea una fila del JOIN inscripciones + eventos a un DTO. */
function map(row) {
  if (!row) return null;
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    apellido: row.apellido,
    dni: row.dni,
    celular: row.celular,
    cjp: row.cjp || "",
    vendedorSlug: row.vendedor_slug || null,
    vendedorNombre: row.vendedor_nombre || "Directo",
    asistio: !!row.asistio,
    asistioAt: row.asistio_at || null,
    createdAt: row.created_at,
    evento: row.evento_id
      ? {
          id: row.evento_id, dia: row.e_dia, hora: row.e_hora, lugar: row.e_lugar || "",
          direccion: row.e_direccion, barrio: row.e_barrio,
        }
      : null,
  };
}

const SELECT_JOIN = `
  SELECT i.*, e.dia AS e_dia, e.hora AS e_hora, e.lugar AS e_lugar,
         e.direccion AS e_direccion, e.barrio AS e_barrio
  FROM inscripciones i
  LEFT JOIN eventos e ON e.id = i.evento_id`;

class MySqlInscripcionRepository extends InscripcionRepository {
  async crear(insc) {
    try {
      const [res] = await pool.query(
        `INSERT INTO inscripciones
           (codigo, nombre, apellido, dni, celular, cjp, evento_id, vendedor_slug, vendedor_nombre, asistio)
         VALUES (:codigo, :nombre, :apellido, :dni, :celular, :cjp, :eventoId, :vendedorSlug, :vendedorNombre, 0)`,
        {
          codigo: insc.codigo, nombre: insc.nombre, apellido: insc.apellido,
          dni: insc.dni, celular: insc.celular, cjp: insc.cjp || "",
          eventoId: insc.eventoId,
          vendedorSlug: insc.vendedorSlug, vendedorNombre: insc.vendedorNombre,
        }
      );
      return { ...insc, id: res.insertId };
    } catch (e) {
      if (e && e.code === "ER_DUP_ENTRY") {
        const m = String(e.message || "");
        if (m.includes("uq_evento_dni")) throw new ConflictError("Ese DNI ya está inscripto en este evento.");
        if (m.includes("uq_evento_celular")) throw new ConflictError("Ese celular ya está inscripto en este evento.");
        throw new ConflictError("La inscripción ya existe.");
      }
      throw e;
    }
  }

  async actualizar(codigo, datos) {
    const existe = await this.buscarPorCodigo(codigo);
    if (!existe) return null;
    try {
      await pool.query(
        `UPDATE inscripciones
            SET nombre = :nombre, apellido = :apellido, dni = :dni,
                celular = :celular, cjp = :cjp, evento_id = :eventoId
          WHERE codigo = :codigo`,
        {
          codigo, nombre: datos.nombre, apellido: datos.apellido, dni: datos.dni,
          celular: datos.celular, cjp: datos.cjp || "", eventoId: datos.eventoId,
        }
      );
    } catch (e) {
      if (e && e.code === "ER_DUP_ENTRY") {
        const m = String(e.message || "");
        if (m.includes("uq_evento_dni")) throw new ConflictError("Ese DNI ya está inscripto en este evento.");
        if (m.includes("uq_evento_celular")) throw new ConflictError("Ese celular ya está inscripto en este evento.");
        throw new ConflictError("Datos duplicados.");
      }
      throw e;
    }
    return this.buscarPorCodigo(codigo);
  }

  async listar() {
    const [rows] = await pool.query(`${SELECT_JOIN} ORDER BY i.created_at DESC`);
    return rows.map(map);
  }

  async buscarPorCodigo(codigo) {
    const [rows] = await pool.query(`${SELECT_JOIN} WHERE i.codigo = :codigo LIMIT 1`, { codigo });
    return map(rows[0]);
  }

  async marcarAsistencia(codigo) {
    const actual = await this.buscarPorCodigo(codigo);
    if (!actual) return { estado: "no-existe" };
    if (actual.asistio) return { estado: "ya", inscripcion: actual };
    const [res] = await pool.query(
      "UPDATE inscripciones SET asistio = 1, asistio_at = CURRENT_TIMESTAMP WHERE codigo = :codigo AND asistio = 0",
      { codigo }
    );
    if (res.affectedRows === 1) return { estado: "ok", inscripcion: await this.buscarPorCodigo(codigo) };
    return { estado: "ya", inscripcion: await this.buscarPorCodigo(codigo) };
  }

  async setAsistencia(codigo, asistio) {
    const [res] = await pool.query(
      asistio
        ? "UPDATE inscripciones SET asistio = 1, asistio_at = CURRENT_TIMESTAMP WHERE codigo = :codigo"
        : "UPDATE inscripciones SET asistio = 0, asistio_at = NULL WHERE codigo = :codigo",
      { codigo }
    );
    if (res.affectedRows === 0) return null;
    return this.buscarPorCodigo(codigo);
  }

  async eliminar(codigo) {
    const [res] = await pool.query("DELETE FROM inscripciones WHERE codigo = :codigo", { codigo });
    return res.affectedRows > 0;
  }

  async contarAsistencias() {
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM inscripciones WHERE asistio = 1");
    return rows[0].n;
  }
}

module.exports = { MySqlInscripcionRepository };
