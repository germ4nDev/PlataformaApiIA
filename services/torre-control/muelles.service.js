/*
    Author: German Valencia
    Pattern: PORTTOS Service - Maestro de muelles
    Description: Reglas del maestro de muelles. El acceso a datos está en muelles.repository.js.
*/
const { MuelleDTO } = require('../../models/torre-control/muelle.model.js');
const repositorio = require('../../repositories/torre-control/muelles.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { crearError } = require('../../helpers/errores.helper');
const { wktAGeoJson } = require('../../helpers/wkt.helper');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');

const EVENTO = 'muelles-actualizados';

class MuellesService {
  _mapearRegistro(fila) {
    const { geocerca_text, ...muelle } = fila;
    return { ...muelle, geocerca_geo: wrapToFeatureCollection(wktAGeoJson(geocerca_text)) };
  }

  async getMuelles() {
    const registros = await repositorio.listar();
    return { ok: true, data: registros.map((m) => this._mapearRegistro(m)), statusCode: 200 };
  }

  async getMuelleById(id_interno) {
    const muelle = await repositorio.obtener(id_interno);
    if (!muelle) return { ok: false, statusCode: 404 };
    return { ok: true, data: this._mapearRegistro(muelle), statusCode: 200 };
  }

  async crearMuelle(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = MuelleDTO(rawData, userContext);
    const nuevo = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create', msg: `Nuevo muelle registrado: ${nuevo.codigo_muelle}` });
    return nuevo;
  }

  async updateMuelle(id_interno, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = MuelleDTO(rawData, userContext);
    const actualizado = await conTransaccion(async (t) => {
      if (!(await repositorio.obtener(id_interno, { transaction: t }))) {
        throw crearError(404, 'No existe el muelle para actualizar.', 'NO_ENCONTRADO');
      }
      await repositorio.actualizar(id_interno, dto, { transaction: t });
      return repositorio.obtener(id_interno, { transaction: t });
    });
    emitir(EVENTO, { action: 'update' });
    return this._mapearRegistro(actualizado);
  }

  async deleteMuelle(id_interno) {
    const eliminado = await conTransaccion(async (t) => {
      const muelle = await repositorio.obtener(id_interno, { transaction: t });
      if (!muelle) throw crearError(404, 'No existe un muelle con ese id.', 'NO_ENCONTRADO');
      await repositorio.eliminar(id_interno, { transaction: t });
      return muelle;
    });
    emitir(EVENTO, { action: 'delete', msg: `Muelle eliminado: ${eliminado.codigo_muelle}` });
    const { geocerca_text, ...muelle } = eliminado;
    return muelle;
  }
}

module.exports = MuellesService;
