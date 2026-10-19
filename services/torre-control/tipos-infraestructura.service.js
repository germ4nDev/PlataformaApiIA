/*
    Author: German Valencia
    Pattern: PORTTOS Service - Tipos de infraestructura
    Description: Catálogo de tipos de infraestructura. Acceso a datos en tipos-infraestructura.repository.js.
*/
const { TipoInfraestructuraDTO } = require('../../models/torre-control/tipo-infraestructura.model');
const repositorio = require('../../repositories/torre-control/tipos-infraestructura.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { crearError } = require('../../helpers/errores.helper');

const EVENTO = 'tipos-infraestructura-actualizados';

class TipoInfraestructurasService {
  async getTipoInfraestructuraes() {
    return { ok: true, data: await repositorio.listar(), statusCode: 200 };
  }

  async getTipoInfraestructuraById(id_tipo) {
    const registro = await repositorio.obtener(id_tipo);
    if (!registro) throw crearError(404, 'No existe el tipo de infraestructura por su Id.', 'NO_ENCONTRADO');
    return registro;
  }

  async crearTipoInfraestructura(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = TipoInfraestructuraDTO(rawData, userContext);
    const nuevo = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create', msg: `Nuevo tipo infraestructura registrado: ${nuevo.nombre}` });
    return nuevo;
  }

  async updateTipoInfraestructura(id_tipo, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    // La auditoría de creación no se toca al actualizar.
    const { usuario_cargue, fecha_cargue, ...dto } = TipoInfraestructuraDTO(rawData, userContext);
    const actualizado = await conTransaccion(async (t) => {
      if (!(await repositorio.obtener(id_tipo, { transaction: t }))) {
        throw crearError(404, `No existe un tipo de infraestructura con el ID: ${id_tipo}`, 'NO_ENCONTRADO');
      }
      return repositorio.actualizar(id_tipo, dto, { transaction: t });
    });
    emitir(EVENTO, { action: 'update', msg: `Tipo de Infraestructura actualizado: ${actualizado.nombre}` });
    return actualizado;
  }

  async deleteTipoInfraestructura(id_tipo) {
    const eliminado = await conTransaccion(async (t) => {
      const registro = await repositorio.obtener(id_tipo, { transaction: t });
      if (!registro) throw crearError(404, 'No existe un tipo de infraestructura con ese id.', 'NO_ENCONTRADO');
      await repositorio.eliminar(id_tipo, { transaction: t });
      return registro;
    });
    emitir(EVENTO, { action: 'delete', msg: `TipoInfraestructura eliminado: ${eliminado.nombre}` });
    return eliminado;
  }
}

module.exports = TipoInfraestructurasService;
