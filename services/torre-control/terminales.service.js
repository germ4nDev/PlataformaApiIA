/*
    Author: German Valencia
    Pattern: PORTTOS Service - Maestro de terminales
    Description: Reglas del maestro de terminales. El acceso a datos está en terminales.repository.js.
*/
const { TerminalDTO } = require('../../models/torre-control/terminal.model.js');
const repositorio = require('../../repositories/torre-control/terminales.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { wktAGeoJson } = require('../../helpers/wkt.helper');
const { wrapToFeatureCollection } = require('../../utils/geoJsonHelper.js');

const EVENTO = 'terminales-actualizados';
const fechaIso = (dto) => (dto.fecha_cargue instanceof Date ? { ...dto, fecha_cargue: dto.fecha_cargue.toISOString() } : dto);

class TerminalsService {
  _mapearRegistro(fila) {
    const { geocerca_text, ...terminal } = fila;
    return { ...terminal, geocerca_geo: wrapToFeatureCollection(wktAGeoJson(geocerca_text)) };
  }

  async getTerminales() {
    const registros = await repositorio.listar();
    return { ok: true, data: registros.map((t) => this._mapearRegistro(t)), statusCode: 200 };
  }

  async getTerminalById(id_terminal) {
    const terminal = await repositorio.obtener(id_terminal);
    if (!terminal) return { ok: false, statusCode: 404 };
    return { ok: true, data: this._mapearRegistro(terminal), statusCode: 200 };
  }

  async crearTerminal(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(TerminalDTO(rawData, userContext));
    const nuevo = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create' });
    return nuevo;
  }

  async updateTerminal(id_terminal, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = fechaIso(TerminalDTO(rawData, userContext));
    const actualizado = await conTransaccion((t) => repositorio.actualizar(id_terminal, dto, { transaction: t }));
    emitir(EVENTO, { action: 'update' });
    return actualizado;
  }

  async deleteTerminal(id_terminal) {
    await conTransaccion((t) => repositorio.eliminar(id_terminal, { transaction: t }));
    emitir(EVENTO, { action: 'delete' });
    return { success: true };
  }
}

module.exports = TerminalsService;
