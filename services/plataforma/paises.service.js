/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Países (Utilidades › Países, usuario 2026-11-10: código, moneda y demás datos de los países que se usan;
    Listas de precios elige el país de aquí y toma su moneda).
      listar() / obtener({ codigoPais }) / crear(body, usuario) / modificar(codigoPais, body, usuario) / eliminar({ codigoPais })
    Un país que usa alguna lista de precios no se elimina: se inactiva.
*/
const Repo = require('../../repositories/plataforma/paises.repository');
const N = require('../../utils/plataforma/paises');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const M = require('../../models/plataforma/paises.model');

class PaisesService {
  constructor({ repo = Repo, emitir = null } = {}) {
    this.repo = repo;
    this.emitir = emitir || ((d) => { try { require('../../helpers/socket.helper').getIO().emit('paises-actualizados', d); } catch { /* sin socket */ } });
  }

  limpio(body) {
    const p = N.normalizar(validarCon(M.PaisSchema, body));
    const errores = N.revisar(p);
    if (errores.length) throw { statusCode: 400, msg: errores[0].mensaje, codigo: 'VALIDACION', details: errores };
    return p;
  }

  listar() { return this.repo.listar(); }

  async obtener(params) {
    const { codigoPais } = validarCon(M.CodigoSchema, params);
    const p = await this.repo.obtener(codigoPais);
    if (!p) throw crearError(404, 'No existe ese país.', 'NO_EXISTE');
    return p;
  }

  async crear(body, usuario) {
    const p = this.limpio(body);
    if (await this.repo.obtener(p.codigoPais)) throw { statusCode: 409, msg: 'Ya existe un país con ese código.', codigo: 'DUPLICADO' };
    await this.repo.crear(p, usuario);
    this.emitir({ action: 'create', codigoPais: p.codigoPais });
    return this.repo.obtener(p.codigoPais);
  }

  async modificar(codigoPais, body, usuario) {
    const actual = await this.obtener({ codigoPais });
    const p = this.limpio({ ...body, codigoPais: actual.codigoPais });
    await this.repo.modificar(actual.codigoPais, p, usuario);
    this.emitir({ action: 'update', codigoPais: actual.codigoPais });
    return this.repo.obtener(actual.codigoPais);
  }

  async eliminar(params) {
    const actual = await this.obtener(params);
    const usos = await this.repo.listasQueLoUsan(actual.codigoPais);
    if (usos) throw { statusCode: 409, msg: `Lo usan ${usos} lista(s) de precios: inactívelo en lugar de eliminarlo.`, codigo: 'EN_USO' };
    await this.repo.eliminar(actual.codigoPais);
    this.emitir({ action: 'delete', codigoPais: actual.codigoPais });
    return { codigoPais: actual.codigoPais };
  }
}

module.exports = new PaisesService();
module.exports.PaisesService = PaisesService;
