const { crearVendedor, slugify } = require("../domain/model/Vendedor");
const { ValidationError } = require("../domain/errors");

class CrearVendedor {
  constructor({ vendedorRepo }) { this.vendedorRepo = vendedorRepo; }
  async execute({ nombre, slug }) {
    const base = slugify(slug || nombre);
    if (!base) throw new ValidationError("El código de link no es válido.");
    // Garantiza slug único (base, base-2, base-3, …)
    let unico = base, n = 1;
    while (await this.vendedorRepo.buscarPorSlug(unico)) { n += 1; unico = `${base}-${n}`; }
    const vendedor = crearVendedor({ nombre, slug: unico });
    return this.vendedorRepo.crear(vendedor);
  }
}

class ListarVendedores {
  constructor({ vendedorRepo }) { this.vendedorRepo = vendedorRepo; }
  async execute() { return this.vendedorRepo.listar(); }
}

class EliminarVendedor {
  constructor({ vendedorRepo }) { this.vendedorRepo = vendedorRepo; }
  async execute(id) { await this.vendedorRepo.eliminar(id); return { ok: true }; }
}

/** Resuelve un slug a { slug, nombre } para atribución. Público. */
class ResolverVendedor {
  constructor({ vendedorRepo }) { this.vendedorRepo = vendedorRepo; }
  async execute(slug) {
    slug = slugify(slug);
    if (!slug) return null;
    const v = await this.vendedorRepo.buscarPorSlug(slug);
    return v ? { slug: v.slug, nombre: v.nombre } : { slug, nombre: slug };
  }
}

module.exports = { CrearVendedor, ListarVendedores, EliminarVendedor, ResolverVendedor };
