/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Sitios: catálogo de websites de las aplicaciones (OT-036 fase 2, CC-207)
      listar() / obtener({ id }) / crear(body, usuario) / modificar(id, body, usuario) / inactivar({ id }, usuario)
    Reglas: el código no se repite ni cambia; la aplicación existe; un sitio con enlaces activos no se inactiva; retirar = inactivar.
    Socket sitios-actualizados. El contenido de cada sitio lo administra su aplicación en rutaAdministracion (regla 26).
*/
const Repo = require('../../repositories/plataforma/sitios.repository');
const N = require('../../utils/plataforma/sitios');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const { SitioSchema, IdSchema } = require('../../models/plataforma/sitios.model');

const invalido = (errores) => crearError(400, errores[0].mensaje, 'VALIDACION', errores);

class SitiosService {
  constructor({ repo = Repo, emitir = null } = {}) {
    this.repo = repo;
    this.emitir = emitir || ((d) => { try { require('../../helpers/socket.helper').getIO().emit('sitios-actualizados', d); } catch { /* sin socket */ } });
  }

  async limpio(body, nuevo) {
    const s = N.normalizar(validarCon(SitioSchema, body || {}));
    const errores = N.revisar(s, { nuevo });
    if (errores.length) throw invalido(errores);
    if (!(await this.repo.aplicacion(s.codigoAplicacion))) throw invalido([{ campo: 'codigoAplicacion', mensaje: 'Esa aplicación no existe.' }]);
    return s;
  }

  listar() { return this.repo.listar(); }

  async obtener(params) {
    const { id } = validarCon(IdSchema, params || {});
    const s = await this.repo.obtener(id);
    if (!s) throw crearError(404, 'No existe ese sitio.', 'NO_EXISTE');
    return s;
  }

  async crear(body, usuario) {
    const s = await this.limpio(body, true);
    if (await this.repo.obtener(s.codigoSitio)) throw crearError(409, 'Ya existe un sitio con ese código.', 'DUPLICADO');
    await this.repo.crear(s, usuario);
    this.emitir({ action: 'create', id: s.codigoSitio });
    return this.repo.obtener(s.codigoSitio);
  }

  async modificar(id, body, usuario) {
    const actual = await this.obtener({ id });
    const s = await this.limpio({ ...body, codigoSitio: actual.codigoSitio }, false);
    if (!s.estadoSitio && actual.estadoSitio) await this.sinEnlaces(actual.codigoSitio);
    await this.repo.modificar(actual.codigoSitio, s, usuario);
    this.emitir({ action: 'update', id: actual.codigoSitio });
    return this.repo.obtener(actual.codigoSitio);
  }

  async sinEnlaces(codigo) {
    const n = await this.repo.enlacesDelSitio(codigo);
    if (n) throw crearError(409, `Tiene ${n} enlace(s) activo(s): inactívelos antes de inactivar el sitio.`, 'EN_USO');
  }

  async inactivar(params, usuario) {
    const actual = await this.obtener(params);
    await this.sinEnlaces(actual.codigoSitio);
    await this.repo.inactivar(actual.codigoSitio, usuario);
    this.emitir({ action: 'update', id: actual.codigoSitio });
    return { codigoSitio: actual.codigoSitio, estadoSitio: false, msg: 'Sitio inactivado.' };
  }
}

module.exports = new SitiosService();
module.exports.SitiosService = SitiosService;
