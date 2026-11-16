/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Catálogos simples (Utilidades › Catálogos, CC-204; regla 19 y regla 10: una pieza para todos)
      listar(clave) / obtener(clave, { id }) / crear(clave, body, usuario) / modificar(clave, id, body, usuario) / eliminar(clave, { id }, usuario)
    Reglas: el código no se repite ni cambia al editar; los campos marcados únicos no se repiten (número del tipo de estado, nombre del
    estado); un registro que otras tablas usan no se inactiva ni se elimina (ni cambia el número por el que lo usan). Retirar = inactivar
    en los catálogos con estado; los estados (sin columna de estado) se eliminan si nadie los usa. Avisa por socket con el evento de
    siempre de cada catálogo y con catalogos-actualizados { catalogo, action, id } (el que escucha la pantalla).
*/
const Repo = require('../../repositories/plataforma/catalogos.repository');
const N = require('../../utils/plataforma/catalogos');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const { esquemaDe, IdSchema } = require('../../models/plataforma/catalogos.model');

const invalido = (errores) => crearError(400, errores[0].mensaje, 'VALIDACION', errores);
const enUso = (lista) => lista.filter((u) => u.n > 0).map((u) => `${u.n} ${u.que}`).join(', ');

class CatalogosService {
  constructor({ repo = Repo, emitir = null } = {}) {
    this.repo = repo;
    this.emitir = emitir || ((evento, d) => { try { require('../../helpers/socket.helper').getIO().emit(evento, d); } catch { /* sin socket */ } });
  }

  def(clave) {
    const d = N.catalogo(clave);
    if (!d) throw crearError(404, 'No existe ese catálogo.', 'NO_EXISTE');
    return d;
  }

  avisar(clave, action, id) {
    const d = this.def(clave);
    this.emitir(d.evento, { action, id });
    this.emitir('catalogos-actualizados', { catalogo: clave, action, id });
  }

  limpio(d, body, nuevo) {
    const p = N.normalizar(d, validarCon(esquemaDe(d), body || {}));
    const errores = N.revisar(d, p, { nuevo });
    if (errores.length) throw invalido(errores);
    return p;
  }

  async unicos(d, p, idActual) {
    for (const c of d.campos.filter((x) => x.unico)) {
      const otro = await this.repo.porValor(d, c.nombre, p[c.nombre]);
      if (otro && String(otro[d.llave]) !== String(idActual)) {
        throw crearError(409, `Ya existe un ${d.nombre} con ese valor.`, 'DUPLICADO', [{ campo: c.nombre, mensaje: 'Valor repetido.' }]);
      }
    }
  }

  listar(clave) { return this.repo.listar(this.def(clave)); }

  async obtener(clave, params) {
    const d = this.def(clave);
    const { id } = validarCon(IdSchema, params || {});
    if (d.autonumerica && !/^\d+$/.test(id)) throw crearError(404, `No existe ese ${d.nombre}.`, 'NO_EXISTE');
    const r = await this.repo.obtener(d, id);
    if (!r) throw crearError(404, `No existe ese ${d.nombre}.`, 'NO_EXISTE');
    return r;
  }

  async crear(clave, body, usuario) {
    const d = this.def(clave);
    const p = this.limpio(d, body, true);
    if (!d.autonumerica && (await this.repo.obtener(d, p[d.llave]))) throw crearError(409, `Ya existe un ${d.nombre} con ese código.`, 'DUPLICADO');
    await this.unicos(d, p, null);
    const id = await this.repo.crear(d, p, usuario);
    this.avisar(clave, 'create', id);
    return this.repo.obtener(d, id);
  }

  async modificar(clave, id, body, usuario) {
    const d = this.def(clave);
    const actual = await this.obtener(clave, { id });
    const p = this.limpio(d, { ...body, ...(d.autonumerica ? {} : { [d.llave]: actual[d.llave] }) }, false);
    if (!d.autonumerica) p[d.llave] = actual[d.llave];
    await this.unicos(d, p, actual[d.llave]);
    const sale = d.estado && !p[d.estado] && actual[d.estado] !== false && actual[d.estado] !== 0;
    const cambiaPropia = d.usos.some((u) => u.propia && String(p[u.propia]) !== String(actual[u.propia]));
    if (sale || cambiaPropia) {
      const usado = enUso(await this.repo.usos(d, actual));
      if (usado) {
        throw crearError(409, sale ? `Lo usan ${usado}: no se puede inactivar.` : `Lo usan ${usado}: no se puede cambiar el número.`, 'EN_USO');
      }
    }
    await this.repo.modificar(d, actual[d.llave], p, usuario);
    this.avisar(clave, 'update', actual[d.llave]);
    return this.repo.obtener(d, actual[d.llave]);
  }

  async eliminar(clave, params, usuario) {
    const d = this.def(clave);
    const actual = await this.obtener(clave, params);
    const usado = enUso(await this.repo.usos(d, actual));
    if (usado) throw crearError(409, `Lo usan ${usado}: ${d.estado ? 'no se puede inactivar' : 'no se puede eliminar'}.`, 'EN_USO');
    if (d.estado) {
      await this.repo.inactivar(d, actual[d.llave], usuario);
      this.avisar(clave, 'update', actual[d.llave]);
      return { id: actual[d.llave], estado: false, msg: `${d.nombre[0].toUpperCase()}${d.nombre.slice(1)} inactivado.` };
    }
    await this.repo.eliminar(d, actual[d.llave]);
    this.avisar(clave, 'delete', actual[d.llave]);
    return { id: actual[d.llave], eliminado: true, msg: `${d.nombre[0].toUpperCase()}${d.nombre.slice(1)} eliminado.` };
  }
}

module.exports = new CatalogosService();
module.exports.CatalogosService = CatalogosService;
