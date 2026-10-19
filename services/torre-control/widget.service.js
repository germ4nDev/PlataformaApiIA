/*
    Author: German Valencia
    Pattern: PORTTOS Service - Catálogo heredado de widgets
    Description: CRUD de TLCCatalogo_Widgets (rutas /api/widgets de torre-control).
      Acceso a datos en catalogo-widgets.repository.js.
*/
const { CatalogoWidgetDTO } = require('../../models/torre-control/catalogo-widgets.model');
const repositorio = require('../../repositories/torre-control/catalogo-widgets.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { crearError } = require('../../helpers/errores.helper');

const EVENTO = 'widgets-actualizados';

class WidgetService {
  async getWidgets() {
    return { ok: true, data: await repositorio.listar(), statusCode: 200 };
  }

  async getWidgetByCode(codigo_widget) {
    const registro = await repositorio.obtener(codigo_widget);
    if (!registro) throw crearError(404, 'No existe el widget solicitado en el catálogo.', 'NO_ENCONTRADO');
    return registro;
  }

  async crearWidget(rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = CatalogoWidgetDTO(rawData, userContext);
    const nuevo = await conTransaccion((t) => repositorio.crear(dto, { transaction: t }));
    emitir(EVENTO, { action: 'create', msg: `Nuevo widget registrado: ${nuevo.nombre}` });
    return nuevo;
  }

  async updateWidget(codigo_widget, rawData, userContext = { codigoUsuario: 'SISTEMA_ADMIN' }) {
    const dto = CatalogoWidgetDTO(rawData, userContext);
    const actualizado = await conTransaccion(async (t) => {
      if (!(await repositorio.obtener(codigo_widget, { transaction: t }))) {
        throw crearError(404, 'No existe el widget para actualizar.', 'NO_ENCONTRADO');
      }
      return repositorio.actualizar(codigo_widget, dto, { transaction: t });
    });
    emitir(EVENTO, { action: 'update', msg: `Widget actualizado: ${actualizado.nombre}` });
    return actualizado;
  }

  async deleteWidget(codigo_widget) {
    const eliminado = await conTransaccion(async (t) => {
      const widget = await repositorio.obtener(codigo_widget, { transaction: t });
      if (!widget) throw crearError(404, 'No existe un widget con ese código.', 'NO_ENCONTRADO');
      await repositorio.eliminar(codigo_widget, { transaction: t });
      return widget;
    });
    emitir(EVENTO, { action: 'delete', msg: `Widget eliminado del catálogo: ${eliminado.nombre}` });
    return eliminado;
  }
}

module.exports = WidgetService;
