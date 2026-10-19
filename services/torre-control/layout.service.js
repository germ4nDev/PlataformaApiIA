/*
    Author: German Valencia
    Pattern: PORTTOS Service - Layouts heredados de torre de control
    Description: Tableros por usuario de las tablas TLC* (anteriores a PTLLayouts). Sin filas propias se devuelve
      el layout de SISTEMA_DEFAULT. Acceso a datos en layout-legado.repository.js.
*/
const { LayoutUsuarioDTO } = require('../../models/torre-control/layout-usuario.model');
const { DashboardLayoutDTO } = require('../../models/torre-control/dashboard-layout.model');
const LayoutLegado = require('../../repositories/torre-control/layout-legado.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { crearError } = require('../../helpers/errores.helper');

const USUARIO_POR_DEFECTO = 'SISTEMA_DEFAULT';

const aWidgetAngular = (fila) => ({
  x: fila.pos_x,
  y: fila.pos_y,
  cols: fila.cols,
  rows: fila.rows,
  type: fila.codigo_widget,
  visible: fila.visible,
  ...(fila.instancia !== 'UNICA' ? { data: { nombreTerminal: fila.instancia } } : {}),
});

async function tableroConDefecto(codigoUsuario, codigoDashboard) {
  let filas = await LayoutLegado.widgetsDeUsuario(codigoUsuario, codigoDashboard);
  let esPorDefecto = false;
  if (!filas.length) {
    filas = await LayoutLegado.widgetsDeUsuario(USUARIO_POR_DEFECTO, codigoDashboard);
    esPorDefecto = true;
  }
  return { success: true, esLayoutPorDefecto: esPorDefecto, data: filas.map(aWidgetAngular) };
}

class LayoutService {
  obtenerTablero(codigoUsuario) {
    return tableroConDefecto(codigoUsuario);
  }

  obtenerTableroUsuario(codigoUsuario, tablero) {
    return tableroConDefecto(codigoUsuario, tablero);
  }

  async guardarTablero(codigoUsuario, layoutArray) {
    const filas = layoutArray.map((item) => LayoutUsuarioDTO({
      codigo_usuario: codigoUsuario,
      codigo_widget: (item.type || item.codigo_widget).toUpperCase(),
      instancia: (item.data?.nombreTerminal || item.instancia || 'UNICA').toUpperCase(),
      pos_x: item.x !== undefined ? item.x : item.pos_x,
      pos_y: item.y !== undefined ? item.y : item.pos_y,
      cols: item.cols,
      rows: item.rows,
      visible: item.visible !== undefined ? item.visible : true,
    }, { codigoUsuario }));
    try {
      await conTransaccion((t) => LayoutLegado.reemplazarWidgetsDeUsuario(codigoUsuario, filas, { transaction: t }));
    } catch (error) {
      throw crearError(500, 'Error al persistir la configuración en BD', 'ERROR_PERSISTENCIA', error.message);
    }
    return { success: true, message: 'Tablero guardado exitosamente', widgetsGuardados: filas.length };
  }

  /** Tablero guardado por código (TLCUserDashboardLayout). */
  tableroGuardado(codigoUsuario, codigoTablero) {
    return LayoutLegado.tableroGuardado(codigoUsuario, codigoTablero);
  }

  /**
   * Reemplaza el tablero guardado del usuario.
   * Corregido 2026-10-18: antes borraba por una columna inexistente y mapeaba campos que el DTO no conoce,
   * así que el guardado fallaba siempre.
   */
  async guardarTableroGuardado(codigoUsuario, codigoTablero, widgets = []) {
    const contexto = { codigoUsuario };
    const filas = widgets.map((w) => DashboardLayoutDTO({
      codigoUsuario,
      codigoDashboard: codigoTablero,
      widget_id: w.id,
      config: w.config,
      posicion_x: w.posicion?.x,
      posicion_y: w.posicion?.y,
    }, contexto));
    await conTransaccion((t) => LayoutLegado.reemplazarTableroGuardado(codigoUsuario, codigoTablero, filas, { transaction: t }));
  }
}

module.exports = new LayoutService();
