const { InscripcionRepository } = require("../../../domain/ports/repositories");
const { ConflictError } = require("../../../domain/errors");
const { pool } = require("./pool");

/** Mapea una fila a un DTO. El evento sale del SNAPSHOT guardado en la
 *  inscripción (persiste aunque el evento se borre); si está vacío
 *  (inscripciones viejas), cae al JOIN con la tabla eventos. */
function map(row) {
  if (!row) return null;
  const dia = row.evento_dia || row.e_dia || "";
  const hora = row.evento_hora || row.e_hora || "";
  const lugar = row.evento_lugar || row.e_lugar || "";
  const direccion = row.evento_direccion || row.e_direccion || "";
  const barrio = row.evento_barrio || row.e_barrio || "";
  const hayEvento = dia || hora || lugar || direccion || barrio || row.evento_id;
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
    evento: hayEvento ? { id: row.evento_id || null, dia, hora, lugar, direccion, barrio } : null,
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
      const ev = insc.evento || {};
      const [res] = await pool.query(
        `INSERT INTO inscripciones
           (codigo, nombre, apellido, dni, celular, cjp, evento_id,
            evento_dia, evento_hora, evento_lugar, evento_direccion, evento_barrio,
            vendedor_slug, vendedor_nombre, asistio)
         VALUES (:codigo, :nombre, :apellido, :dni, :celular, :cjp, :eventoId,
            :edia, :ehora, :elugar, :edireccion, :ebarrio,
            :vendedorSlug, :vendedorNombre, 0)`,
        {
          codigo: insc.codigo, nombre: insc.nombre, apellido: insc.apellido,
          dni: insc.dni, celular: insc.celular, cjp: insc.cjp || "",
          eventoId: insc.eventoId,
          edia: ev.dia || "", ehora: ev.hora || "", elugar: ev.lugar || "",
          edireccion: ev.direccion || "", ebarrio: ev.barrio || "",
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
