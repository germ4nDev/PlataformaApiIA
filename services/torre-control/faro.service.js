/*
    Author: German Valencia
    Pattern: PORTTOS Service - Maestro de faros
    Description: Faros = geocercas de control (peajes, zonas terrestres y marítimas). Se desactivan, no se borran.
      Acceso a datos en faros.repository.js.
*/
const { FaroDTO } = require('../../models/torre-control/faro.model');
const repositorio = require('../../repositories/torre-control/faros.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { crearError } = require('../../helpers/errores.helper');
const { wktAGeoJson } = require('../../helpers/wkt.helper');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper');

const EVENTO = 'faros-actualizados';
const fechaIso = (dto) => (dto.fecha_cargue instanceof Date ? { ...dto, fecha_cargue: dto.fecha_cargue.toISOString() } : dto);

class FarosService {
  /** Parser WKT común (wellknown): soporta huecos y MULTIPOLYGON. */
  _parseWkt(wkt) {
    return wktAGeoJson(wkt == null ? null : String(wkt));
  }

  _mapearRegistro(fila) {
    const { geocerca_text, ...faro } = fila;
    const geometria = this._parseWkt(geocerca_text);
    const propiedades = {
      id_faro: faro.id_faro,
      nombre_faro: faro.nombre_faro,
      color_ui: faro.color_ui,
      tipo_faro: faro.tipo_faro,
      descripcion: faro.descripcion,
      genera_alerta_toast: faro.genera_alerta_toast,
    };
    return { ...faro, geocerca_geo: geometria ? wrapToFeatureCollection(geometria, propiedades) : null };
  }

  async getFaros() {
    const faros = await repositorio.listar({ where: { estado: true } });
    return { statusCode: 200, ok: true, data: faros.map((f) => this._mapearRegistro(f)) };
  }

  async getFaroById(id_faro) {
    const faro = await repositorio.obtener(id_faro);
    if (!faro) return { statusCode: 404, ok: false, data: null };
    return { statusCode: 200, ok: true, data: this._mapearRegistro(faro) };
  }

  async crearFaro(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(FaroDTO(rawData, userContext));
    const nuevo = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create' });
    return nuevo;
  }

  async updateFaro(id_faro, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(FaroDTO(rawData, userContext));
    const actualizado = await conTransaccion(async (t) => {
      if (!(await repositorio.obtener(id_faro, { transaction: t }))) {
        throw crearError(404, 'Faro no encontrado para actualizar', 'NO_ENCONTRADO');
      }
      return repositorio.actualizar(id_faro, dto, { transaction: t });
    });
    emitir(EVENTO, { action: 'update' });
    return actualizado;
  }

  async deleteFaro(id_faro) {
    const faro = await conTransaccion(async (t) => {
      const existente = await repositorio.obtener(id_faro, { transaction: t });
      if (!existente) throw crearError(404, 'Faro no encontrado', 'NO_ENCONTRADO');
      await repositorio.actualizar(id_faro, { estado: false }, { transaction: t });
      return existente;
    });
    emitir(EVENTO, { action: 'delete' });
    return { mensaje: 'Faro desactivado correctamente', id_faro: faro.id_faro };
  }
}

module.exports = new FarosService();
