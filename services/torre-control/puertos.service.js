/*
    Author: German Valencia
    Pattern: PORTTOS Service - Maestro de puertos
    Description: Reglas del maestro de puertos. El acceso a datos está en puertos.repository.js;
      las geometrías se devuelven como FeatureCollection GeoJSON.
*/
const { PuertoDTO } = require('../../models/torre-control/puerto.model');
const repositorio = require('../../repositories/torre-control/puertos.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { wktAGeoJson } = require('../../helpers/wkt.helper');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');

const EVENTO = 'puertos-actualizados';
const fechaIso = (dto) => (dto.fecha_cargue instanceof Date ? { ...dto, fecha_cargue: dto.fecha_cargue.toISOString() } : dto);

class PuertosService {
  _mapearRegistro(fila) {
    const { ubicacion_text, geocerca_text, ...puerto } = fila;
    return {
      ...puerto,
      ubicacion_geo: wrapToFeatureCollection(wktAGeoJson(ubicacion_text)),
      geocerca_geo: wrapToFeatureCollection(wktAGeoJson(geocerca_text)),
    };
  }

  async getPuertos() {
    const registros = await repositorio.listar();
    return { ok: true, data: registros.map((p) => this._mapearRegistro(p)), statusCode: 200 };
  }

  async getPuertoById(id) {
    const puerto = await repositorio.obtener(id);
    if (!puerto) return { ok: false, statusCode: 404 };
    return { ok: true, data: this._mapearRegistro(puerto), statusCode: 200 };
  }

  async crearPuerto(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(PuertoDTO(rawData, userContext));
    const nuevo = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create' });
    return nuevo;
  }

  async updatePuerto(id_puerto, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(PuertoDTO(rawData, userContext));
    const actualizado = await conTransaccion((t) => repositorio.actualizar(id_puerto, dto, { transaction: t }));
    emitir(EVENTO, { action: 'update' });
    return actualizado;
  }

  async deletePuerto(id_puerto) {
    await conTransaccion((t) => repositorio.eliminar(id_puerto, { transaction: t }));
    emitir(EVENTO, { action: 'delete' });
    return { success: true };
  }
}

module.exports = PuertosService;
