/*
    Author: German Valencia
    Pattern: PORTTOS Service - Maestro de infraestructura
    Description: Muelles, bodegas, silos, patios y demás elementos de cada terminal.
      Acceso a datos en infraestructura.repository.js.
*/
const { InfraestructuraDTO } = require('../../models/torre-control/infraestructura.model.js');
const repositorio = require('../../repositories/torre-control/infraestructura.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { wktAGeoJson } = require('../../helpers/wkt.helper');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');

const EVENTO = 'infraestructura-actualizada';
const fechaIso = (dto) => (dto.fecha_cargue instanceof Date ? { ...dto, fecha_cargue: dto.fecha_cargue.toISOString() } : dto);

class InfraestructuraService {
  _mapearRegistro(fila) {
    const { ubicacion_text, geocerca_text, ...infra } = fila;
    return {
      ...infra,
      ubicacion_geo: wrapToFeatureCollection(wktAGeoJson(ubicacion_text)),
      geocerca_geo: wrapToFeatureCollection(wktAGeoJson(geocerca_text)),
    };
  }

  async getInfraestructuras() {
    const registros = await repositorio.listar();
    return { ok: true, data: registros.map((i) => this._mapearRegistro(i)), statusCode: 200 };
  }

  async getInfraestructuraById(id) {
    const infra = await repositorio.obtener(id);
    if (!infra) return { ok: false, statusCode: 404 };
    return { ok: true, data: this._mapearRegistro(infra), statusCode: 200 };
  }

  async crearInfraestructura(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = InfraestructuraDTO(rawData, userContext);
    const nueva = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create' });
    return nueva;
  }

  async updateInfraestructura(id_infraestructura, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(InfraestructuraDTO(rawData, userContext));
    const actualizada = await conTransaccion(async (t) => {
      await repositorio.actualizar(id_infraestructura, dto, { transaction: t });
      return repositorio.obtener(id_infraestructura, { transaction: t });
    });
    emitir(EVENTO, { action: 'update' });
    return actualizada;
  }

  async deleteInfraestructura(id_infraestructura) {
    await conTransaccion((t) => repositorio.eliminar(id_infraestructura, { transaction: t }));
    emitir(EVENTO, { action: 'delete' });
    return { success: true };
  }
}

module.exports = InfraestructuraService;
