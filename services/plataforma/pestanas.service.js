/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Administración de pestañas y tipos de pestaña (Utilidades, CC-203; regla 19)
      Pestañas: obtener({ id }) / crear(body, usuario) / modificar(id, body, usuario) / inactivar({ id }, usuario)
      Tipos:    obtenerTipo({ id }) / crearTipo(body, usuario) / modificarTipo(id, body, usuario) / inactivarTipo({ id }, usuario)
    Reglas: el código no se repite ni cambia al editar; la suite es de la aplicación elegida; el tipo existe; una estrategia por tipo;
    un tipo con pestañas activas no se inactiva. Retirar = inactivar. Avisa por socket: pestanas-actualizados y
    tipos-pestanas-actualizados (los que ya escucha la web). Las lecturas del motor de tableros siguen en services/pestanas.service.js.
*/
const Repo = require('../../repositories/plataforma/pestanas.repository');
const N = require('../../utils/plataforma/pestanas');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const { PestanaSchema, TipoPestanaSchema, CodigoSchema } = require('../../models/plataforma/pestanas.model');

const invalido = (errores) => crearError(400, errores[0].mensaje, 'VALIDACION', errores);

class PestanasAdminService {
  constructor({ repo = Repo, emitir = null } = {}) {
    this.repo = repo;
    this.emitir = emitir || ((evento, d) => { try { require('../../helpers/socket.helper').getIO().emit(evento, d); } catch { /* sin socket */ } });
  }

  // ---------- Pestañas ----------
  async limpia(body) {
    const p = N.normalizarPestana(validarCon(PestanaSchema, body || {}));
    const errores = N.revisarPestana(p);
    if (errores.length) throw invalido(errores);
    if (!(await this.repo.obtenerTipo(p.codigoTipoPestana))) throw invalido([{ campo: 'codigoTipoPestana', mensaje: 'Ese tipo de pestaña no existe.' }]);
    if (!(await this.repo.suiteDeAplicacion(p.codigoSuite, p.codigoAplicacion))) {
      throw invalido([{ campo: 'codigoSuite', mensaje: 'La suite no es de la aplicación elegida.' }]);
    }
    return p;
  }

  async obtener(params) {
    const { id } = validarCon(CodigoSchema, params || {});
    const p = await this.repo.obtener(id);
    if (!p) throw crearError(404, 'No existe esa pestaña.', 'NO_EXISTE');
    return p;
  }

  async crear(body, usuario) {
    const p = await this.limpia(body);
    if (await this.repo.obtener(p.codigoPestana)) throw crearError(409, 'Ya existe una pestaña con ese código.', 'DUPLICADO');
    const conEstilo = await this.repo.crear(p, usuario);
    this.emitir('pestanas-actualizados', { action: 'create', id: p.codigoPestana });
    return { ...(await this.repo.obtener(p.codigoPestana)), estiloGuardado: conEstilo };
  }

  async modificar(id, body, usuario) {
    const actual = await this.obtener({ id });
    const p = await this.limpia({ ...body, codigoPestana: actual.codigoPestana });
    const conEstilo = await this.repo.modificar(actual.codigoPestana, p, usuario);
    this.emitir('pestanas-actualizados', { action: 'update', id: actual.codigoPestana });
    return { ...(await this.repo.obtener(actual.codigoPestana)), estiloGuardado: conEstilo };
  }

  async inactivar(params, usuario) {
    const actual = await this.obtener(params);
    await this.repo.inactivar(actual.codigoPestana, usuario);
    this.emitir('pestanas-actualizados', { action: 'update', id: actual.codigoPestana });
    return { codigoPestana: actual.codigoPestana, estado: false };
  }

  // ---------- Tipos de pestaña ----------
  limpioTipo(body) {
    const t = N.normalizarTipo(validarCon(TipoPestanaSchema, body || {}));
    const errores = N.revisarTipo(t);
    if (errores.length) throw invalido(errores);
    return t;
  }

  async obtenerTipo(params) {
    const { id } = validarCon(CodigoSchema, params || {});
    const t = await this.repo.obtenerTipo(id);
    if (!t) throw crearError(404, 'No existe ese tipo de pestaña.', 'NO_EXISTE');
    return t;
  }

  async estrategiaLibre(t) {
    const otro = await this.repo.tipoPorEstrategia(t.estrategia);
    if (otro && otro.codigoTipo !== t.codigoTipo) {
      throw crearError(409, `La estrategia ${t.estrategia} ya es del tipo ${otro.codigoTipo}.`, 'DUPLICADO', [{ campo: 'estrategia', mensaje: 'Estrategia ocupada.' }]);
    }
  }

  async crearTipo(body, usuario) {
    const t = this.limpioTipo(body);
    if (await this.repo.obtenerTipo(t.codigoTipo)) throw crearError(409, 'Ya existe un tipo de pestaña con ese código.', 'DUPLICADO');
    await this.estrategiaLibre(t);
    await this.repo.crearTipo(t, usuario);
    this.emitir('tipos-pestanas-actualizados', { action: 'create', id: t.codigoTipo });
    return this.repo.obtenerTipo(t.codigoTipo);
  }

  async modificarTipo(id, body, usuario) {
    const actual = await this.obtenerTipo({ id });
    const t = this.limpioTipo({ ...body, codigoTipo: actual.codigoTipo });
    await this.estrategiaLibre(t);
    if (!t.estado && (await this.repo.pestanasDelTipo(actual.codigoTipo))) {
      throw crearError(409, 'Lo usan pestañas activas: cámbielas de tipo antes de inactivarlo.', 'EN_USO');
    }
    await this.repo.modificarTipo(actual.codigoTipo, t, usuario);
    this.emitir('tipos-pestanas-actualizados', { action: 'update', id: actual.codigoTipo });
    return this.repo.obtenerTipo(actual.codigoTipo);
  }

  async inactivarTipo(params, usuario) {
    const actual = await this.obtenerTipo(params);
    const usos = await this.repo.pestanasDelTipo(actual.codigoTipo);
    if (usos) throw crearError(409, `Lo usan ${usos} pestaña(s) activa(s): cámbielas de tipo antes de inactivarlo.`, 'EN_USO');
    await this.repo.inactivarTipo(actual.codigoTipo, usuario);
    this.emitir('tipos-pestanas-actualizados', { action: 'update', id: actual.codigoTipo });
    return { codigoTipo: actual.codigoTipo, estado: false };
  }
}

module.exports = new PestanasAdminService();
module.exports.PestanasAdminService = PestanasAdminService;
